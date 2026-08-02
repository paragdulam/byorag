# Research: Golden Dataset Creation (Manual & LLM-Generated)

## 1. Candidate-chunk search: reuse the existing cosine strategy, twice, merged

**Decision**: Call the already-registered `RETRIEVAL_STRATEGIES["cosine-similarity"]`
(`backend/app/retrieval/strategies/cosine_similarity.py`) exactly as Playground already does —
once with the question's embedding, once with the answer's embedding (when present), each via
`.search(db, document_id, model, query_vector, limit)` or `.search_corpus(...)` depending on scope
— then merge the two `list[tuple[ChunkRow, embedding_id, score]]` results with Reciprocal Rank
Fusion (RRF): for each chunk, `1/(rank_in_question_list + 60) + 1/(rank_in_answer_list + 60)`,
summed across whichever list(s) it appears in, ranked descending, top ~10 returned.

**Rationale**: No new retrieval code — the same `EMBEDDING_MODELS["bert"].embed([text])` →
`RETRIEVAL_STRATEGIES["cosine-similarity"].search(...)` call Playground's `create_turn` already
makes is reused verbatim, twice. RRF (not raw-score fusion) is used because answer-text queries
score systematically higher against their source chunks than question-text queries do (embeddings
of answer-like text land closer to source passages than question-like text — the same asymmetry
HyDE exploits), so merging by raw score would silently bias toward answer-search results. RRF
works off rank position, not score magnitude, sidestepping that bias entirely, and its "sum across
lists" structure naturally rewards a chunk that ranks well in *both* searches — exactly the
strongest evidence signal (spec FR-005: "matched both" pre-checked).

**Alternatives considered**: Raw-score summation/max fusion — rejected per the scale-bias issue
above. A brand-new hybrid retrieval strategy registered into `RETRIEVAL_STRATEGIES` — rejected as
unnecessary; this is a one-off merge of two existing strategy calls specific to this feature's
candidate-search endpoint, not a new pluggable retrieval mode other features would select.

## 2. What gets persisted vs. what stays transient

**Decision**: Only the *selected* evidence chunks are persisted (as `GoldenDatasetEntryChunk` rows
— snapshotted content, per FR-016). The candidate search's full merged list, each candidate's
question/answer-embedding, and which search(es) a candidate matched are **not** persisted anywhere
— they exist only in the request/response of the candidate-search endpoint and the creation-time
UI state.

**Rationale**: Nothing in the spec's functional requirements or success criteria depends on this
data surviving past entry creation — FR-004's "indicate whether it matched" is a creation-time UI
behavior, not a stored attribute of the finished entry. Persisting it anyway (question/answer
embeddings on the entry, a `matched_via` column on the chunk snapshot) would be speculative
schema for a use nothing in this version reads back, working against this project's general
preference for building only what's asked for.

**Alternatives considered**: Persisting `question_embedding`/`answer_embedding` on the entry,
mirroring how `ConversationTurn` persists `query_embedding` — considered since the precedent
exists and the future "reference-scoring in Metrics" use (spec Assumptions, explicitly deferred)
would eventually want something like this. Rejected for *this* version: nothing here reads it, and
adding it now is exactly the "designing for a hypothetical future requirement" this project's
conventions steer away from. If/when that future work is scoped, it's a cheap, additive column to
add then.

## 3. Single-entry generation: a plain endpoint, not a streaming one

**Decision**: `POST /api/golden-dataset/generate` is a normal synchronous JSON endpoint (like
Playground's `generate_answer`), not a Server-Sent-Events stream (unlike
`embeddings/generate/stream`).

**Rationale**: This codebase's existing streaming endpoints (`embeddings/generate/stream`,
`chunking`'s equivalent) stream because they process *many* chunks in one document and a progress
bar meaningfully helps. One golden-dataset generation call does a small, bounded amount of work —
pick a chunk (or a few), one embedding call (for the picked chunk's content, to run the same
merged candidate search a human would see, so the generated entry's evidence set is chosen the
same way), one Anthropic call — comparable in cost/shape to Playground's already-non-streaming
`generate_answer`. Streaming here would add protocol complexity (SSE framing, `EventSource`
auth-via-query-param handling — `backend/app/auth/dependencies.py`'s documented reason those two
endpoints need it) for no real UX benefit at this scale.

**Alternatives considered**: SSE per generation call, matching `embeddings/generate/stream` — 
rejected as disproportionate to the amount of work being streamed.

## 4. Batch generation: client-driven, reusing `batchRunner.ts` — no new server endpoint

**Decision**: "Generate a Batch…" (spec User Story 3) is implemented entirely on the frontend as a
sequential loop over `N` calls to the same `POST /api/golden-dataset/generate` endpoint from
decision 3, using the existing `runSequentialBatch` helper
(`frontend/src/lib/batchRunner.ts`) — the same mechanism Embeddings' "Entire Corpus" flow already
uses to fan out one document-scoped SSE call across many documents. There is no server-side batch
endpoint.

**Rationale**: `runSequentialBatch` already provides exactly what spec FR-010/FR-010b need:
strictly sequential execution (never concurrent, so it doesn't hammer the single-worker BERT model
or the user's Anthropic rate limit), continues past a failed item rather than aborting the batch,
and reports combined progress via its existing `BatchProgress`/`onProgress` callback shape. This
codebase has *no* precedent for a server-side multi-item background job (grep for `/stream` routes
turns up only single-document endpoints) — introducing one here would be new infrastructure this
feature doesn't actually need, when a client-side loop over the already-built single-item endpoint
satisfies every acceptance scenario in User Story 3 (visible progress; partial results kept;
progress survives a component remount as long as the loop's owning component stays mounted, or is
otherwise persisted — see Edge Cases below).

**Edge case — navigating away mid-batch**: Spec Acceptance Scenario (US3 #3) requires progress to
still be visible after navigating away and back. Since `runSequentialBatch` is a plain async
function tied to whatever component calls it, the batch-generation UI must be driven from
component state that survives the screen switch — practically, this means kicking off the batch
from a small persistent piece of state (e.g., tracked in `GoldenDatasetScreen`'s own state re-read
on mount, or a lightweight module-level "batch in progress" tracker) rather than local state
scoped to a modal that unmounts when the user navigates away. This is a task-level UI-state
decision, not a new backend concern — the loop itself doesn't change.

## 5. Generating a question from a chunk, not a question in search of chunks

**Decision**: For LLM-generated entries, pick the evidence chunk(s) *first* (one chunk, or a small
random handful from the document/corpus scope), then prompt the model to produce a question that
chunk answers plus a draft answer grounded in it — never the reverse (generate a question first,
then search for supporting evidence afterward).

**Rationale**: Generating evidence-first guarantees grounding by construction — the chunk(s) fed to
the model *are* the entry's evidence chunks, no separate retrieval/matching step needed, and no
risk of the model inventing a plausible-sounding question that no real chunk actually supports well
(FR-009's "grounded in real chunk content" is satisfied structurally, not just aspirationally).
It also reuses the exact same "prompt with numbered `[CHUNK n]` context blocks, ask a question
about it" shape Playground's `_build_prompt` already establishes, just inverted (source chunk(s) →
question+answer, instead of question+chunks → answer).

**Alternatives considered**: Generate-question-then-retrieve (mirroring how a human might work
backward) — rejected: two LLM calls instead of one, and no guarantee the retrieval step actually
surfaces a chunk that supports the model's invented question well.

**Chunk sampling for batch runs**: pick chunks that don't already have an approved or pending
golden entry pointing at them where practical (a simple exclusion query against existing
`GoldenDatasetEntryChunk.chunk_id` for the scope), so repeated batch generations build variety
rather than repeatedly regenerating near-duplicate questions about the same passage. This is a
reasonable implementation default, not a hard requirement from the spec.

**Addendum, discovered during implementation**: `/generate`'s request scope is *not* the same
exactly-one-of-documentId/corpusId XOR that `/candidates` uses. `GoldenDatasetEntry.corpus_id` is
always required (data-model.md), so `corpusId` is always required on this request too;
`documentId`, when given, only narrows which document within that corpus to sample a chunk from.
(The frontend originally passed the same `{corpusId, documentId}` shape to both endpoints
unchanged, which is correct for `/entries` — create also always requires `corpusId` — but wrong
for `/candidates`, which does need the strict XOR since it's a search operation, not an entry
scope. `GoldenEntryEditor.tsx` now translates its `{corpusId, documentId}` prop into the correct
XOR shape specifically before calling `searchCandidates`, matching how
`usePlaygroundConversation.ts` already does the same translation for Playground's own
`search`/`search_corpus` split. Caught by the real backend's validation in `/speckit-implement`'s
own e2e pass, not by the mocked-fetch integration test — that test's mock has since been
strengthened to replicate the same validation so this class of regression fails there too.)

## 6. Deletion cascades

**Decision**: `GoldenDatasetEntry.document_id` uses `ondelete="CASCADE"` (deleting a `Document`
deletes its golden entries — spec FR-019, explicit). `GoldenDatasetEntry.corpus_id` also uses
`ondelete="CASCADE"`, symmetrically. `GoldenDatasetEntryChunk.entry_id` uses `ondelete="CASCADE"`
(a snapshot row dies with its parent entry, exactly like `ConversationTurnChunk.turn_id` today).
`GoldenDatasetEntryChunk.chunk_id` uses `ondelete="SET NULL"` (a best-effort, nullable live link
back to the source `Chunk` row — mirrors `ConversationTurnChunk.chunk_id` exactly; the row's own
`content`/`chunk_index` snapshot is the durable source of truth per FR-016, so losing this soft
link when a document is re-chunked doesn't invalidate the entry).

**Rationale**: FR-019 only states document deletion explicitly, but corpus deletion is symmetric in
spirit — an entry scoped to a corpus with no evidence document to fall back on has nothing left to
be a reference *for* once that corpus is gone. Note this is largely moot in practice: this
codebase's existing `delete_corpus` (`backend/app/corpora/service.py`) already refuses to delete a
non-empty corpus (`CorpusNotEmptyError`), so by the time a corpus is actually deletable, every
document-scoped entry under it is already gone via the document-cascade rule above; the
corpus-level cascade only matters for entries scoped to the corpus as a whole (no specific
document).

**Alternatives considered**: `SET NULL` on `document_id`/`corpus_id`, orphaning entries instead of
deleting them — rejected: FR-019 says "removed," and an orphaned entry with no owning
corpus/document is unreachable from any scoped list view anyway (spec FR-015's list is always
per-corpus), so keeping it around as a zombie row serves no one.

## 7. Draft-answer-from-selected-chunks

**Decision**: `POST /api/golden-dataset/draft-answer` builds a prompt structurally identical to
Playground's private `_build_prompt(question, chunks)` (`backend/app/playground/service.py`) —
numbered `[CHUNK n]` blocks joined with the question — but fed the *currently selected* evidence
chunks from the in-progress editor (which may not match what any retrieval call would have
surfaced), then calls `GENERATION_PROVIDERS[provider].generate(prompt, api_key)` the same way
`generate_answer` does. The result is returned directly in the response, never auto-saved — the
spec (FR-007) requires the user to be able to freely edit or replace it before saving.

**Rationale**: Reuses an already-proven prompt shape and provider call rather than inventing a new
one; the only difference from Playground's flow is the source of the chunk list (manually curated
selection vs. a fresh retrieval's top-K).

## 8. Module layout and API surface

**Decision**: New `backend/app/golden_dataset/` module (`router.py`/`schemas.py`/`service.py`, no
`strategies/` subfolder — this version only ever resolves `"cosine-similarity"`), registered via
one `include_router(...)` call in `main.py`, following the exact shape of `corpora/`/`playground/`.
Ownership checks reuse the existing `backend/app/db/lookups.py` helpers
(`get_corpus_owned_by`, `get_document_owned_by`) plus one new
`get_golden_dataset_entry_owned_by`, added to that same shared module rather than duplicated
locally, matching how every other feature's ownership check is centralized there.

**Rationale**: Consistency with every other feature module in this codebase — a new contributor (or
future you) finds the same three files in the same shape regardless of which feature they're
reading.

## 9. Anthropic key requirement

**Decision**: Both generation-touching capabilities (draft-answer, single/batch LLM generation)
require the corpus owner's own Anthropic key, resolved via
`profile_service.resolve_decrypted_key(db, user_id)` — identical to how
`playground/service.py::generate_answer` already requires it, raising the same class of
`NoApiKeyError` the router already knows how to translate to an HTTP error. The "Golden Dataset"
sidebar nav entry is gated with `requiresAnthropicKey: true` (`SidebarNav.tsx`), the same way
Playground and Metrics already are. Manual creation *without* ever touching the draft-answer or
LLM-generation buttons does not require a key at all (FR-001–FR-008 only need embeddings +
retrieval, never generation) — so gating the whole nav entry behind a key is slightly stricter
than strictly necessary, but matches this app's existing UX precedent (Playground is fully gated
even though, e.g., viewing past turns wouldn't strictly need a key either) rather than introducing
a new, more granular gating pattern for this one feature.

**Alternatives considered**: Ungate the screen entirely, only blocking the specific
generation-touching actions — rejected as an inconsistent new pattern relative to how
Playground/Metrics already gate at the nav level.

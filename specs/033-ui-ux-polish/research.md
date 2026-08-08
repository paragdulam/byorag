# Phase 0 Research: UI/UX Polish Across Corpora, Sources, Chunking, Embeddings, Vector View, and Playground

## 1. Corpus↔document relationship: many-to-many → one-to-many

**Decision**: Replace the `document_corpora` join table with a direct, required
`documents.corpus_id` foreign key. Migrate existing data by keeping, per document, its
**earliest** (`MIN(added_at)`, tie-broken by `corpus_id`) `document_corpora` association as the
new sole owner and dropping the rest — via this codebase's existing idempotent-startup-migration
convention (`backend/app/db/schema_migrations.py`, raw guarded SQL run on every startup, not
Alembic). Also move `documents`' content-hash dedup uniqueness from `(user_id, content_hash)` to
`(user_id, corpus_id, content_hash)`, so uploading the same PDF bytes into a *different* corpus
creates its own row instead of being deduped against another corpus's copy — this is what makes
"the same doc in two different corpora" (per your clarification) possible as two independent
rows, now that there's no shared reference to reuse.

**Rationale**: This repo has no Alembic — `ensure_schema_migrations()` already handles exactly
this shape of change (add column, backfill, replace a unique constraint) for two prior features
(024-user-authentication's `user_id` scoping, `corpora.name`/`documents.content_hash`
uniqueness), so extending that same function is the established, lowest-risk path, not a new
migration mechanism. Picking the earliest association as the resolved owner is arbitrary but
deterministic and requires no user interaction, matching the spec's Assumption that "the exact
migration approach is a planning-phase decision, not a product-behavior question" — and since
this app has no production deployment yet, silently dropping a document's *other* corpus
associations (while keeping the document and its content fully intact under one corpus) is an
acceptable one-time resolution.

**Alternatives considered**:
- *Duplicate the document row per corpus it's currently attached to* — rejected: turns a
  same-content document that's attached to N corpora into N physically separate rows with
  separately re-computed chunks/embeddings at migration time, which is more invasive and slower
  than picking one owner; a user who actually wants the same PDF in two corpora can just upload
  it again post-migration (now supported per Decision above).
- *Block the migration and require manual resolution* — rejected: this app has no admin/manual
  migration UI, and forcing a human decision for what's likely zero-to-few affected rows in
  practice isn't worth the operational complexity.

## 2. Removing the "attach to another corpus" feature

**Decision**: Remove both the UI entry points (Corpora screen's "attach an existing document"
`<select>`, `DocumentList.tsx`'s "add to another corpus" combobox) *and* their backend endpoints
(`POST /api/sources/{document_id}/corpora`, `DELETE /api/sources/{document_id}/corpora/{corpus_id}`
in `backend/app/sources/router.py`/`service.py`) rather than leaving unreachable dead endpoints.

**Rationale**: Once a document belongs to exactly one corpus (Decision 1), "attach an existing
document, owned by corpus A, to corpus B" has no valid target — there is no such document to
attach, since every document already has its one owner. Leaving the endpoints in place would
either need to be repurposed (attach implies re-ownership, a different, unrequested feature) or
just silently 404/error, which is worse than removing them.

## 3. Corpora-screen per-document delete: confirmation modal + real deletion

**Decision**: Reuse `backend/app/sources/router.py`'s existing `POST /api/sources/delete` (already
used by the Sources screen's own delete flow — real deletion, cascades chunks/embeddings/turns/
golden-dataset-entries via existing FK `ondelete="CASCADE"` relationships, confirmed in
`db/models.py`) for the new Corpora-screen delete action — no new backend deletion endpoint.
For the confirmation UI, add a small reusable `ConfirmModal` component modeled directly on the
existing `ComparisonModal.tsx` dialog structure (backdrop `<div onClick={onClose}>` behind an
inner `role="dialog" aria-modal="true"` panel with `onClick` `stopPropagation`), since that's
already this codebase's one precedent for an in-app modal (as opposed to `window.confirm()`,
used elsewhere for lower-stakes confirmations like corpus deletion today).

**Rationale**: Every deletion cascade this feature needs already exists at the database level —
confirmed `GoldenDatasetEntry.document_id` already has `ondelete="CASCADE"`, and
`Document.chunks`/`Document.conversation_turns` already cascade via SQLAlchemy relationship
config. This is purely "expose an already-correct delete capability from a new place in the UI,"
not new deletion logic. Corpus deletion itself stays unchanged (still blocked while the corpus
has any documents, via `document_corpora`'s current `ondelete="RESTRICT"` on the corpus FK,
which becomes `documents.corpus_id`'s `ondelete="RESTRICT"` post-migration) — now naturally
satisfied by deleting each document individually first, since there's no more "unlink" escape
hatch.

**Alternatives considered**:
- *`window.confirm()` for the new delete action, matching corpus deletion's existing pattern* —
  rejected: the spec explicitly asks for "a confirmation modal," and native browser confirms
  can't carry the clearer "this permanently deletes the document" wording a real modal can.

## 4. Fixed Size Chunking per-chunk "Copy Link"

**Decision**: Reuse `buildChunkingChunkLink(corpusId, documentId, chunkIndex)`, already built in
`frontend/src/router/urlScheme.ts` (034-more-deep-links) — add a small "Copy Link" button to each
chunk row's top-right corner that calls it and writes the result to the clipboard, exactly
mirroring the existing pattern already used for Golden Dataset entries
(`GoldenEntryList.tsx`'s `handleCopyLink`) and Playground turns
(`PlaygroundTurnDetail.tsx`'s `handleCopyLink`).

**Rationale**: No new routing/link-building work is needed — this is purely wiring an existing,
already-tested URL builder to a new visible button. Consistent with how the same "Copy Link"
pattern was already added twice elsewhere.

## 5. Typography parity ("match the Corpora screen")

**Decision**: The Corpora screen's scale is: page `h1` → `text-4xl font-bold tracking-tight
text-on-surface`; section `h2` → `text-xl font-semibold text-on-surface`; secondary/metadata text
(badges, buttons, preview lists) → `text-sm`; tertiary labels (e.g. "Show more/less") →
`text-xs`; body/list text (document names, etc.) → no explicit size class (the base/default
size). Audit each of Sources, Fixed Size Chunking, Embeddings, Vector View, and Playground
against this scale and reduce anything sized larger than its Corpora-screen equivalent.
Confirmed via direct inspection: Embeddings' and Vector View's page `h1`s and `CHUNK_N` labels
already match exactly (`text-4xl ...` / `font-mono text-xs text-tertiary`); the one confirmed
oversized element is Sources' `UploadDropzone`'s `"Upload PDF Documents"` heading at `text-2xl`
(moot once that card is removed per US2). The remaining screens need a line-by-line audit during
implementation rather than a pre-enumerated list here, since this research phase found no other
systematic oversizing beyond what's already covered by US2's card removal — implementers should
still check every heading/label while touching each screen's file for its own story.

**Rationale**: Establishing the concrete reference scale up front (rather than a vague "smaller")
makes FR-013 and SC-005 objectively checkable, and the spot-check above shows most of the
worked already largely complies — this is a small alignment pass, not a redesign.

## 6. Playground Actions popover + dismiss-on-outside-click

**Decision**: Add a small, generic `useClickOutside(ref, onOutside)` hook in
`frontend/src/hooks/` (attaches a `mousedown` listener on `document`, checks
`!ref.current?.contains(event.target)`), since no such utility exists yet in this codebase. The
Actions control becomes an icon button (`aria-label="Actions"`, `aria-haspopup="menu"`,
`aria-expanded`) toggling a `role="menu"` popover positioned via normal in-flow
`absolute`/`relative` CSS (no portal/floating-UI library needed at this scale — the popover is
always anchored to its own turn, never needs to escape a scroll container in a special way).
"Copy Link" and "Query Embedding" render as `role="menuitem"` buttons.

**Rationale**: A `mousedown`-on-`document` listener is the standard, dependency-free way to
implement click-outside-to-dismiss and matches this codebase's general preference (per its
constitution and prior features) for hand-rolled solutions over new dependencies at this scale —
this is a single, contained interaction, not a case needing a floating-UI/positioning library.

**Alternatives considered**:
- *A dependency like `@floating-ui/react` or `react-aria`'s popover* — rejected: this repo has
  taken the "no new dependency for a contained, well-understood interaction" position before
  (032-deep-linking's research.md §1 reached the same conclusion about routing); a fixed-position
  turn-anchored popover doesn't need floating-UI's collision/flip logic.

## 7. Answer citation markers

**Decision**: Change the shared prompt template in `backend/app/playground/service.py` (already
shared across every `GenerationProvider`, per `anthropic_provider.py`'s own docstring) to instruct
the model to cite retrieved chunks inline using plain bracketed ordinals — `[1]`, `[2]`, ...,
referencing the 1-based position of each chunk in that turn's *retrieved-chunks* list (the same
order already shown in the existing chunk list / new Retrieved Chunks group) — placed
immediately after the claim/sentence they support. No change to `GenerationResult` or the
`GenerationProvider` protocol; `Turn.answer` stays a plain string, now simply containing this
marker syntax as part of its text. The frontend (`AnswerCitations.tsx`, new) splits the answer
string on `/\[(\d+)\]/g`, renders each text segment through the existing `ReactMarkdown`, and
inserts an info-icon button after each marker, mapped back to `turn.chunks[N-1]`.

**Rationale**: `[1]` in isolation (not followed by `(url)` or a matching link-reference
definition elsewhere in the text) is not link syntax in CommonMark — it renders as plain literal
text — so this marker doesn't need any Markdown-escaping and survives `ReactMarkdown` unmodified,
letting the frontend regex-split it out cleanly. Keeping `answer` a plain string (vs. adding a
structured citations field/table) avoids any new persisted schema for citations — the mapping
from marker number to chunk is fully derivable at render time from data (`turn.chunks`) that's
already sent to the client.

**Alternatives considered**:
- *Markdown footnote syntax (`[^1]`)* — rejected: requires a `remark-gfm`-family plugin this
  project doesn't currently depend on, and footnotes render as a batch list at the document
  end, not as inline elements — the wrong shape for "info icon right where the claim is."
  Also, `remark-gfm` (or similar) would be a new frontend dependency.
- *A custom remark plugin that parses `[N]` into a dedicated AST node inside a single
  `ReactMarkdown` tree* — rejected for v1: more robust against markdown split at odd boundaries
  (e.g. mid-emphasis-run), but meaningfully more machinery than the segment-splitting approach
  for a first version; worth revisiting only if the simpler approach produces visibly broken
  markdown in practice.
- *Backend-side structured citations* (a citations table or a citations array beside `answer`) —
  rejected: adds persisted schema and a new response field for information that's fully
  recoverable from the existing `answer` text plus the existing `chunks` array; no product
  requirement needs citations to be queryable independent of a specific turn's render.

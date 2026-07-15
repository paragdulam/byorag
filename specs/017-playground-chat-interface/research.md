# Research: Playground Split-Screen Chat Interface

No `NEEDS CLARIFICATION` markers remain in the spec (resolved during `/speckit-clarify`:
persistence, concurrent-request blocking, per-turn retrieval revisit, conversation reload on
return, single-block answer delivery, same-turn retry). This document records the technical
decisions needed to implement it, verified against this repo's installed dependencies and existing
patterns before being written down.

## Decision 1: Conversation turns are snapshotted, not live-referenced, chunk data

**Problem**: FR-018 requires every past answer to remain inspectable — its retrieved chunks, the
matched embedding, the query embedding, the LLM used, and the exact prompt — indefinitely. But
saving a new chunk set for a document (012-save-chunks-button / 016 data-model assumption)
**deletes and replaces** that document's prior `Chunk` rows (`Chunk.document` cascade, and the
`UniqueConstraint("document_id", "index")` that a re-save must not violate). A `ConversationTurn`
that only foreign-keys to `Chunk.id` would silently lose its evidence — or cascade-delete along
with it — the first time the user re-chunks the document, breaking FR-018 and Constitution
Principle V for every turn asked before that point.

**Decision**: `conversation_turn_chunks` copies (`snapshots`) each retrieved chunk's `index` and
`content` at the moment of retrieval, alongside a *nullable, best-effort* `chunk_id` FK
(`ondelete="SET NULL"`) for any future "jump to the live chunk" feature. The snapshot fields are
the source of truth for display; the FK is not required to render a past turn.

**Rationale**: Matches how the spec already treats a turn as a permanent record ("store relevant
chunks... its embedding... its response") rather than a live view over mutable chunk state. Keeps
turn history correct regardless of what happens to the document's chunks afterward.

**Alternatives considered**: A hard FK to `Chunk.id` with `ondelete="CASCADE"` — rejected, it
would delete conversation history as a side effect of an unrelated action (re-chunking) on a
different screen, which is surprising and destroys exactly the audit trail this feature exists to
provide. A single JSON blob column per turn holding all chunk data — rejected, loses the ability
to reuse existing relational tooling (indexed lookups, joins) for any future feature that queries
across turns' chunks.

## Decision 2: Replace `POST /api/playground/search` with a persisted `Turn` resource

**Problem**: 016 built `POST /api/playground/search` as explicitly ephemeral — "nothing is
persisted by this endpoint... pure read + compute" (016 contracts/playground-api.md). This spec's
Clarifications require every submitted question to be persisted, including its retrieved chunks,
query embedding, and (once requested) its generation record.

**Decision**: Retire `POST /api/playground/search` in favor of three endpoints scoped to a new
`Turn` resource:
- `GET /api/playground/turns?documentId=...` — list a document's persisted turns, oldest first
  (powers FR-017's auto-reload).
- `POST /api/playground/turns` — same request shape as the old `/search` body
  (`documentId`, `model`, `query`); performs the same retrieval as before, but now **persists** the
  turn and its retrieved-chunk snapshots before returning it.
- `POST /api/playground/turns/{turnId}/generate` — builds the prompt from the turn's already-
  persisted question and chunk snapshots, calls the configured `GenerationProvider`, and persists
  the resulting `llmProvider`/`llmModel`/`prompt`/`answer` (or `error`) onto that same turn. Calling
  it again on a turn that previously failed is exactly FR-014's "retry the same turn."

`GET /api/playground/context` is unchanged from 016.

**Rationale**: Silently making the old `/search` endpoint start writing to the database would be a
surprising, undocumented side effect for an endpoint whose contract explicitly promised the
opposite. A resource-oriented `Turn` shape also makes retry (re-POST to the same `generate` URL)
and revisiting (`GET` the list, already includes each turn's own generation record) fall out
naturally, rather than needing bespoke persistence bolted onto a "search" verb.

**Alternatives considered**: Keep `/search` and add a separate `POST /playground/persist` call
after it — rejected, two round trips for one user action, with a window where a turn could be lost
if the second call never fires (e.g., tab closed). A single endpoint that does retrieval *and*
generation in one call — rejected, it directly contradicts FR-004/FR-007's "Generate is a distinct,
user-triggered action separate from Send," and would make "review chunks before spending on
generation" (User Story 2) impossible.

## Decision 3: Generation behind a `GenerationProvider` registry, mirroring existing pluggable stages

**Decision**: Add `app/generation/providers/base.py`:

```python
class GenerationResult(NamedTuple):
    model: str
    prompt: str
    answer: str

class GenerationProvider(Protocol):
    def generate(self, question: str, chunks: list[str]) -> GenerationResult: ...

class GenerationError(RuntimeError):
    pass

GENERATION_PROVIDERS: dict[str, GenerationProvider] = {}
```

`app/generation/providers/anthropic_provider.py` registers `"anthropic"`, using the official
`anthropic` Python SDK (`Anthropic(api_key=...).messages.create(...)`). `app/playground/service.py`
looks up `GENERATION_PROVIDERS[settings.generation_provider]` — never branches on a provider name
itself — exactly mirroring how it already looks up `EMBEDDING_MODELS[model]` and
`RETRIEVAL_STRATEGIES["cosine-similarity"]`.

**Rationale**: Constitution Principle I explicitly names generation as a RAG pipeline stage that
MUST be pluggable. The user asked for Anthropic now with OpenAI, Gemini, Hugging Face, and Ollama
addable later without touching the router, service, or frontend — a registry keyed by a single
`GENERATION_PROVIDER` setting is exactly how the codebase already solves this for chunking,
embedding, and retrieval. Adding a second provider later is: write a new module implementing
`GenerationProvider`, register it under a new key, done.

**Alternatives considered**: A general-purpose abstraction library (e.g. LiteLLM/LangChain model
wrappers) — rejected for now: pulls in a dependency and abstraction surface wider than this
project's one-provider-at-a-time need, and the existing codebase already has a proven, lighter
pattern (Protocol + dict registry) for exactly this shape of problem — introducing a second pattern
for the same kind of decision would violate the project's own consistency, not just add a
dependency. Hardcoding the Anthropic SDK call inline in `playground/service.py` — rejected, direct
Principle I violation and contradicts the explicit multi-provider-future ask.

## Decision 4: LLM configuration via environment variables, failing only at generate-time

**Decision**: `Settings` gains `generation_provider` (env `GENERATION_PROVIDER`, default
`"anthropic"`), `anthropic_api_key` (env `ANTHROPIC_API_KEY`, default `""`), and `anthropic_model`
(env `ANTHROPIC_MODEL`, default a current Claude model id — confirm the exact id against
Anthropic's model list at implementation time rather than trusting this document). A missing or
invalid API key raises `GenerationError` only when `POST /turns/{id}/generate` is actually called;
it does **not** block app startup or any other endpoint.

**Rationale**: Matches the existing `DATABASE_URL`/`PDFS_DIR` env-var pattern in `config.py`.
Failing hard at startup (like `check_database_connection`) would make retrieval-only usage —
everything this app already shipped before this feature (chunking, embeddings, similarity search)
— unusable just because generation isn't configured yet, a disproportionate blast radius for one
new, optional capability.

**Alternatives considered**: Crash at startup if `ANTHROPIC_API_KEY` is unset — rejected for the
blast-radius reason above. Storing the key in the database instead of an env var — rejected,
inconsistent with this single-local-user project's existing secret-handling (there is none yet;
env vars are the established mechanism) and adds needless complexity for one user.

## Decision 5: Prompt is a single deterministic template, persisted verbatim

**Decision**: `app/playground/service.py` builds the prompt server-side from the turn's question
and its retrieved-chunk snapshots (each labeled by chunk index), passes it to the
`GenerationProvider`, and persists exactly that string as `Turn.prompt` — never reconstructed
after the fact from other fields.

**Rationale**: FR-018 requires the prompt shown when revisiting a turn to be "the prompt sent," not
an approximation. Persisting the literal string sent to the provider is the only way to guarantee
that.

**Alternatives considered**: Reconstructing a display-only prompt from `question` +
`chunks` at read time — rejected, risks drifting from what was actually sent if the template
changes in a future release, silently rewriting history.

## Decision 6: Frontend turn/request lifecycle mirrors existing status-enum pattern

**Decision**: `usePlaygroundConversation` exposes a per-turn `status` (`'retrieving' | 'ready' |
'generating' | 'answered' | 'failed'`) plus a screen-level `isBusy` flag (true while any
retrieval/generation request is in flight) that disables Send and Generate (FR-013), directly
mirroring `useChunkEmbeddings`'s existing `generateStatus`/`saveStatus` pattern and 016's
`usePlaygroundSearch`'s `searchStatus` pattern already proven in this codebase.

**Rationale**: Reuses an established, tested pattern instead of inventing a new one; keeps FR-013's
"disable while in flight" logic in one obvious place (`isBusy`) rather than scattered per-turn
checks.

**Alternatives considered**: A generic `isLoading: boolean` per turn with no screen-level lock —
rejected, doesn't by itself prevent starting a *second* turn's retrieval while the first is still
in flight (FR-013 is a screen-level constraint, not a per-turn one).

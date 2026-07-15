# Phase 0 Research: Generate and Save Chunk Embeddings

No open `NEEDS CLARIFICATION` markers remain from the spec or Technical Context. This document
records the technical decisions made while turning the spec into a concrete plan, including one
deliberate, user-directed deviation from the project's stated fixed stack (see §2 and the plan's
Constitution Check / Complexity Tracking).

## 1. How BERT embeddings are computed

**Decision**: Use HuggingFace `transformers` with `bert-base-uncased`, running locally on CPU
inside the backend process. For each chunk's text: tokenize (with truncation to the model's max
sequence length), run a forward pass, then mean-pool the last hidden state over non-padding tokens
(the standard masked-mean-pooling recipe) to get one fixed-size 768-dimension vector per chunk. No
outbound network call happens at inference time (only a one-time model-weights download on first
use, cached locally).

**Rationale**: The user explicitly asked for "BERT" itself, not a pre-tuned sentence-embedding
wrapper — `bert-base-uncased` via `transformers` is the direct, literal interpretation. Mean
pooling is the most common, well-documented way to turn BERT's per-token output into a single
embedding vector, and running locally (vs. calling a hosted embedding API) matches the same
"avoid new external/network dependencies" reasoning the user used to justify deferring Qdrant.

**Alternatives considered**:
- *`sentence-transformers` with a BERT-based model (e.g. `bert-base-nli-mean-tokens`)*: rejected —
  these are BERT models fine-tuned specifically for sentence-embedding quality, which is arguably
  "better," but the user asked for BERT itself; introducing a differently-named, fine-tuned variant
  would be a silent scope substitution. The pooling technique used is the same either way.
- *`[CLS]`-token pooling instead of mean pooling*: rejected as the primary approach — mean pooling
  is the more broadly-recommended default for BERT-derived sentence/chunk embeddings; `[CLS]`
  pooling requires additional fine-tuning to produce good general-purpose similarity vectors,
  which is out of scope here.
- *A hosted embedding API (e.g., a cloud provider's embeddings endpoint)*: rejected — adds a new
  external dependency, network failure mode, and (likely) API key/cost management, none of which
  the user asked for; contradicts the "avoid new external dependencies" spirit of the request.

## 2. Vector storage: PostgreSQL `pgvector` instead of Qdrant (explicit, temporary deviation)

**Decision**: Store embeddings in a new `embeddings` table in the existing PostgreSQL database,
using the `pgvector` extension's `vector` column type (via the `pgvector` Python package's
SQLAlchemy `Vector` type), rather than adding Qdrant as a second stateful dependency for this
feature.

**Rationale**: The user explicitly requested this ("lets use pgvector for now... it should be
relatively simpler if we avoided qdrant for now. Will use qdrant in future scope"). This directly
conflicts with the constitution's Principle IV, which names Qdrant as the vector store — the
plan's Constitution Check records this as a justified violation (Complexity Tracking) rather than
silently reinterpreting the constitution or unilaterally amending it. Because the user has framed
this as temporary/experimental rather than a permanent stack change, and the constitution's own
Governance section only requires an amendment for permanent adoption, proceeding with a documented,
justified deviation is the correct path here — with an explicit recommendation (recorded in the
plan) to revisit this (amend Principle IV, or actually migrate to Qdrant) once the deferred Qdrant
work is scheduled.

**Alternatives considered**:
- *Stand up Qdrant now, as the constitution currently requires*: rejected — directly contradicts
  the user's explicit, current instruction; would add a second stateful service (client wiring,
  collection management, upsert/query API) to a single-user local tool before it's actually needed,
  which cuts against Principle III (YAGNI) as much as it satisfies Principle IV.
- *Amend the constitution now to replace Qdrant with pgvector permanently*: rejected — the user
  explicitly said Qdrant is future scope, i.e. not abandoned; a permanent amendment would
  overcommit past what was actually asked, and is a governance decision best left to the user to
  request explicitly (e.g., via `/speckit-constitution`) rather than bundled into a feature plan.
- *Store raw float arrays in a plain column (no `vector` type, no extension)*: rejected — gives up
  `pgvector`'s native similarity-search/indexing capability for no benefit, since the extension is
  a small, well-supported addition to an already-Postgres-based stack.

## 3. Fixed vector dimension (768) — known limitation, not solved now

**Decision**: The `embeddings.vector` column is declared as `vector(768)` (matching
`bert-base-uncased`'s hidden size), a single fixed dimension shared by every row. Adding a second
embedding model with a different output dimension later will require a schema change (e.g., a new
column, table, or a widening migration) — this is a known, deliberately deferred limitation, not
addressed by this feature.

**Rationale**: `pgvector`'s `vector(n)` type requires a fixed `n` per column, and only one model
exists today. Designing a multi-dimension-capable schema now (e.g., per-model tables, or padding
vectors to a common max width) would be speculative complexity for a capability nothing yet needs
— textbook YAGNI (constitution Principle III). The spec's own requirement for extensibility (FR-
003) is scoped to the model *picker*, not the storage schema; those are separable concerns, and
only the picker's extensibility is required now.

**Alternatives considered**:
- *A generic/variable-length storage format (e.g., JSON array of floats) instead of `vector(n)`*:
  rejected — this is the "store raw float arrays" alternative from §2, rejected for the same
  reason: it gives up `pgvector`'s native capabilities for a flexibility nothing currently exercises.
- *Design a multi-table-per-dimension or per-model schema now*: rejected as premature — no second
  model exists yet to prove out the right shape for that; better decided when it's a real, concrete
  requirement.

## 4. Save re-computes from persisted chunk content, not client-supplied vectors

**Decision**: `POST`-equivalent save endpoint (`GET /api/embeddings/save/stream`, see §5) takes
only `documentId` and `model`. It re-reads the document's saved `Chunk` rows and re-runs the same
embedding computation used for the preview, then persists the freshly computed vectors — it never
accepts a vector array from the client.

**Rationale**: Mirrors `012-save-chunks-button`'s established precedent for chunk saves (research.md
§1 of that feature) for the same reasons: guarantees every persisted embedding genuinely
corresponds to real, current chunk content rather than trusting arbitrary client-supplied float
arrays, and keeps the request payload small. BERT inference is deterministic in eval mode (no
dropout), so recomputing reproduces the same preview the user already reviewed.

**Alternatives considered**:
- *Client sends back the vectors it received from generate*: rejected — same reasoning as `012`:
  trusts unverified client input as if it were a genuine model output, and duplicates an already-
  large payload for no correctness benefit since recomputation is deterministic.

## 5. Endpoint shapes: both generate and save are streaming (SSE), unlike chunking's save

**Decision**: Three new/changed backend surfaces:
- `GET /api/embeddings/models` — lists registered embedding models (id + label) for the dropdown.
- `GET /api/embeddings/generate/stream?documentId=&model=` — SSE, per-chunk progress + terminal
  preview result; no persistence.
- `GET /api/embeddings/save/stream?documentId=&model=` — SSE, per-chunk progress + terminal saved-
  result; persists (accumulate, §6).
- `GET /api/chunking/saved-chunks?documentId=` — new, non-streaming, returns a document's currently
  saved `Chunk` rows (content + position) — needed because, unlike chunking's own screen (which
  only ever shows a live preview or nothing), the Embeddings screen needs to read chunks that were
  *already saved* in a prior session, and no endpoint currently exposes that.

**Rationale**: `012-save-chunks-button`'s chunk-save endpoint is a plain JSON `POST` with no
progress, because persisting a chunk's already-computed text is near-instant. Here, save has to
re-run BERT inference (§4) — the same non-trivial cost as generate — so FR-008 explicitly requires
visible save progress. Reusing the SSE mechanism already established for streaming progress
(`/run/stream` in chunking) is simpler than inventing a second progress-reporting mechanism (e.g.,
polling a job id), and EventSource requires GET, which is why both endpoints are GET despite one
of them mutating state — consistent with how `/run/stream` already works today.

**Alternatives considered**:
- *`POST` with a background job + polling for status*: rejected — meaningfully more infrastructure
  (job table/id, polling loop, cleanup) for a single-user local tool with no concurrent-job need;
  SSE already solves "show live progress" adequately elsewhere in this codebase.
- *Keep save as a non-streaming `POST`, show only a spinner*: rejected — doesn't satisfy FR-008's
  explicit requirement for a *progress* indicator (not just a busy state), and the per-chunk
  progress signal is already available from the same computation loop generate uses.

## 6. Accumulate, never replace, on save

**Decision**: Every successful save inserts new `Embedding` rows — one per currently-displayed
chunk, tagged with the model used — and never deletes or updates any prior `Embedding` row, even
for the exact same chunk/model pair.

**Rationale**: Directly implements spec FR-009/SC-004 and the user's explicit framing ("I wish to
experiment embeddings with chunks in future," "one chunk to many embeddings"). This is a deliberate
asymmetry with `012`'s chunk-save behavior (full replace) — chunks represent "the current
partitioning of this document" (one truth at a time), while embeddings represent "runs worth
comparing" (many simultaneous truths by design), so the two entities have different, and both
correct, persistence semantics for their own purpose.

**Alternatives considered**:
- *Upsert per (chunk, model) — replace only that model's prior embedding, keep other models'*:
  rejected — the spec (FR-009, Acceptance Scenario 2 in User Story 3) explicitly says re-saving
  "the same or different models" must leave the earlier saved embedding "still retrievable... not
  overwritten," i.e. even same-model re-saves must accumulate, not upsert.

## 7. Document/chunk selection reuses the existing per-corpus document list

**Decision**: The Embeddings screen's document dropdown reuses the same `GET /api/sources?corpusId=`
document list the Chunking screen already uses (scoped to the active corpus), rather than adding a
new endpoint that pre-filters to "only documents with saved chunks." Selecting a document with no
saved chunks shows the existing empty-state messaging (spec FR-002, User Story 1 Acceptance
Scenario 3) instead of being excluded from the dropdown.

**Rationale**: Simpler — no new filtering endpoint, one less thing to keep in sync — and the spec's
own acceptance scenarios already require the "select a document with no saved chunks" path to be
reachable, which wouldn't be possible if the dropdown pre-filtered such documents out. FR-001's
"scoped to documents that have saved chunks" is satisfied functionally (only documents with saved
chunks produce a useful chunk list / can generate embeddings), not by hiding other documents from
the picker.

**Alternatives considered**:
- *New endpoint returning only documents with ≥1 saved chunk*: rejected as unneeded complexity —
  it would also need to handle "a document had saved chunks, then chunks were... " edge cases for no
  real benefit over just showing the empty state inline, which the spec already requires anyway.

## 8. Concurrent-save protection

**Decision**: Client-side, the "Save" button is disabled while a save is in flight (mirroring
`012`). Server-side, no locking is added — each save request's inserts are independently additive,
so even a genuine race between two save requests for the same document just produces two valid,
independent row-sets (never a partial or corrupted row).

**Rationale**: Because saving is additive (§6) rather than delete-then-insert, there is no "last
write wins" hazard to guard against the way `012`'s full-replace chunk save had to consider — two
concurrent embedding saves are safe by construction. Client-side disabling is enough to prevent the
realistic accidental-double-click case for a single local user (Principle III, YAGNI).

**Alternatives considered**:
- *Database-level advisory lock or de-duplication token*: rejected — unnecessary for a single-user
  local tool with an already-safe-by-construction persistence model.

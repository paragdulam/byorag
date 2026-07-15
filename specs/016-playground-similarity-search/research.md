# Research: Playground Similarity Search

No `NEEDS CLARIFICATION` markers remain in the spec (resolved during `/speckit-clarify`: search
loading/error states, and query-length rejection). This document records the technical decisions
needed to implement it, each verified directly against this repo's installed dependencies before
being written down.

## Decision 1: Cosine similarity via `pgvector`'s SQLAlchemy comparator

**Decision**: Use `Embedding.vector.cosine_distance(query_vector)`, provided by the installed
`pgvector-sqlalchemy` package's `Vector` comparator, and convert to a similarity score as
`1 - distance`.

**Rationale**: Confirmed directly — `Vector.comparator_factory` exposes `cosine_distance`,
`l2_distance`, `l1_distance`, and `max_inner_product` out of the box; no new dependency, no raw
SQL string needed. Compiling a real query against the Postgres dialect confirms it emits the
native `<=>` cosine-distance operator:

```sql
SELECT ... embeddings.vector <=> %(vector_1)s AS distance ...
```

**Alternatives considered**: Writing a raw SQL string with `<=>` directly — rejected, unnecessary
since the ORM-level operator already exists and keeps the query composable with the rest of
SQLAlchemy Core (joins, filters, `DISTINCT ON`).

## Decision 2: Deduplicate a chunk's multiple saved embeddings via `DISTINCT ON`

**Problem**: Embeddings accumulate rather than replace (013-bert-pgvector-embeddings research.md
§6) — a chunk can have more than one saved embedding for the same model. FR-008 requires each
chunk to appear at most once in results, using its best-scoring (lowest-distance) saved embedding.

**Decision**: Use Postgres's `DISTINCT ON (chunk_id)` ordered by `(chunk_id, distance ASC)` to
collapse to one row per chunk (its closest embedding) before ranking and limiting to 5:

```python
best_per_chunk = (
    select(EmbeddingRow.chunk_id, distance.label("distance"))
    .join(ChunkRow, ChunkRow.id == EmbeddingRow.chunk_id)
    .where(ChunkRow.document_id == document_id, EmbeddingRow.model == model)
    .distinct(EmbeddingRow.chunk_id)
    .order_by(EmbeddingRow.chunk_id, distance.asc())
    .subquery()
)
```

Confirmed this compiles to valid Postgres SQL via SQLAlchemy's `Select.distinct(*cols)`, which
maps directly to `DISTINCT ON (...)` under the `postgresql` dialect (verified by compiling the
statement). The outer query then joins back to `chunks`, orders by `distance ASC`, and applies
`LIMIT 5`.

**Alternatives considered**: Fetching all matching embeddings into Python and deduping/sorting
in application code — rejected; pushes an unbounded-ish dataset (bounded by `MAX_CHUNKS`=200, but
still unnecessary) across the process boundary when Postgres can do it in one indexed-scope query.
A window-function (`ROW_NUMBER() OVER (PARTITION BY chunk_id ORDER BY distance)`) alternative
would work equally well but `DISTINCT ON` is simpler and is Postgres's idiomatic tool for exactly
this "one row per group, by some ordering" shape.

## Decision 3: Retrieval implemented as a registered `RetrievalStrategy`, not inline SQL in the router

**Decision**: Add `app/retrieval/strategies/base.py` (a `RetrievalStrategy` Protocol plus a
`RETRIEVAL_STRATEGIES` registry dict) and `app/retrieval/strategies/cosine_similarity.py`
(registers `"cosine-similarity"`), mirroring `app/chunking/strategies/` (`STRATEGIES`) and
`app/embeddings/models/` (`EMBEDDING_MODELS`) exactly. `app/playground/service.py` looks up
`RETRIEVAL_STRATEGIES["cosine-similarity"]` rather than embedding the `DISTINCT ON` query
directly.

**Rationale**: The constitution's Principle I explicitly names "retrieval" as a pipeline stage
that MUST be implemented behind a swappable interface, not hardcoded branching — this spec
introduces the first real retrieval logic in the codebase, so it must follow the same registry
pattern already established for chunking and embedding, even though only one strategy is
registered today (matching how `STRATEGIES` and `EMBEDDING_MODELS` also each have exactly one
entry right now).

**Alternatives considered**: Writing the cosine-similarity query directly in
`app/playground/service.py` — rejected as a direct violation of Principle I; would also make a
future second retrieval strategy (e.g., a reranking step, or a different distance metric) require
restructuring rather than just registering a new strategy.

## Decision 4: Query-length validation via a `fits()` method on `EmbeddingModelStrategy`

**Problem**: FR-014 requires rejecting a query that exceeds the embedding model's maximum
supported input length, with a distinguishable "query too long" message (Clarifications). BERT's
tokenizer already silently truncates today when embedding chunk text
(`tokenizer(text, truncation=True, ...)` in `bert.py`), but the clarification explicitly chose
**rejection**, not silent truncation, for the Playground's query.

**Decision**: Extend the `EmbeddingModelStrategy` Protocol
(`app/embeddings/models/base.py`) with `fits(self, text: str) -> bool`. `BertEmbeddingStrategy`
implements it by tokenizing the text *without* truncation and comparing the resulting token count
to `tokenizer.model_max_length`:

```python
def fits(self, text: str) -> bool:
    tokenizer, _ = self._ensure_loaded()
    token_count = len(tokenizer(text, truncation=False)["input_ids"])
    return token_count <= tokenizer.model_max_length
```

Confirmed directly against the installed `bert-base-uncased` tokenizer: `model_max_length` is
`512`, and tokenizing already includes the `[CLS]`/`[SEP]` special tokens in the returned
`input_ids` (a 2-word input produced 4 token ids), so comparing the raw `input_ids` length against
`model_max_length` is the correct, accurate check — no separate accounting for special tokens
needed.

**Rationale**: Keeping this behind the same `EmbeddingModelStrategy` protocol (rather than a
special case in the playground router keyed on `model == "bert"`) means a future second embedding
model supplies its own accurate length check, consistent with Principle I.

**Alternatives considered**: A rough character-count or word-count heuristic — rejected, since an
accurate token count is trivially available from the same tokenizer already loaded for embedding,
and a heuristic could both false-reject short-but-token-heavy text and false-accept long-but-token-
sparse text.

## Decision 5: API shape — one context endpoint, one search endpoint

**Decision**:
- `GET /api/playground/context?documentId=...` → read-only: the document's current chunking
  strategy (from its saved chunks' `strategy` column) and the embedding model most recently used
  for its saved embeddings (`null` for either if the document has no saved chunks/embeddings yet).
  Powers US2 without requiring a search to be run first.
- `POST /api/playground/search` with body `{documentId, model, query}` → generates the query
  embedding, runs the `cosine-similarity` retrieval strategy scoped to that document/model, and
  returns both the query embedding and the ranked results in one response. A POST (not GET) is
  used because the query is free-form natural-language text, better carried in a JSON body than
  URL-encoded query parameters — consistent with this codebase's existing convention of using POST
  + a Pydantic request body for anything beyond simple scalar identifiers (e.g.,
  `POST /api/corpora` with `CreateCorpusRequest`).

**Error status codes**:
- `404` — document not found (mirrors every other document-scoped endpoint in this app).
- `400` — model not registered, or the document has no saved embeddings for that model yet
  (FR-010's "search unavailable" case).
- `422` — the query itself is invalid: empty/whitespace (FR-009, though already prevented
  client-side) or exceeds the model's max input length (FR-014). Using a distinct status code
  (rather than folding everything into `400`) lets the frontend show FR-014's specific "query too
  long" message without parsing response body text, matching this app's established pattern of
  canned, state-driven UI messages (e.g., `EmbeddingsScreen`'s generate/save error text) rather
  than surfacing raw backend error strings.

**Alternatives considered**: A single combined endpoint that returns context AND requires a query
— rejected; US2 requires context to be visible *before* any query is submitted, so it must be
fetched independently of search. Encoding the query as a `GET` query parameter — rejected as
fragile for arbitrary user text (encoding/length edge cases) and inconsistent with this codebase's
POST-body convention for non-trivial input.

## Decision 6: Frontend request lifecycle mirrors `useChunkEmbeddings`'s status pattern

**Decision**: `usePlaygroundSearch` exposes a `searchStatus: 'idle' | 'searching' | 'success' |
'error'` plus a distinct flag/message for the "query too long" case (so the screen can show FR-
014's specific copy instead of the generic FR-013 error), directly mirroring
`useChunkEmbeddings`'s existing `generateStatus`/`saveStatus` pattern already proven in this
codebase (013-bert-pgvector-embeddings).

**Rationale**: Reuses a pattern already implemented, tested, and understood in this codebase
rather than inventing a new one — directly satisfies the Clarifications' choice to "mirror the
existing Generate Embeddings pattern."

**Alternatives considered**: A generic `isLoading`/`error: string | null` pair — rejected, it
can't cleanly distinguish the "query too long" case from other failures without string-matching
error text, which is brittle and inconsistent with the rest of the codebase's status-enum pattern.

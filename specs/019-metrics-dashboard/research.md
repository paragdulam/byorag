# Phase 0 Research: Metrics Dashboard

## 1. Quality-score computation mechanism

**Decision**: Add a new pluggable "evaluation judge" abstraction (`app/evaluation/strategies/base.py`, `JUDGES: dict[str, EvaluationJudge]` registry — same shape as `GENERATION_PROVIDERS` and `RETRIEVAL_STRATEGIES`), with one initial implementation that calls the Anthropic Messages API (the same provider/config already used for answer generation) with a scoring prompt that asks for Context Precision, Context Recall, Response Relevancy, and Faithfulness as four `0.0`–`1.0` values, given the question, the retrieved chunk snapshots, and the generated answer.

**Rationale**: Matches the user's chosen approach (automatic LLM-as-judge, no reference dataset) and Constitution Principle I (every pipeline stage behind a swappable strategy interface — a future feature can register a second judge, e.g. an open-source model or a reference-based judge, without touching calling code). Reusing the Anthropic SDK/config already in the stack avoids introducing a new external dependency (Constitution Principle IV: Fixed Technology Stack).

**Alternatives considered**:
- A dedicated evaluation library (e.g., an existing RAG-eval Python package) — rejected: pulls in a new dependency and its own opinions about prompt format/model choice, when a direct prompt-and-parse call mirrors the pattern already proven for generation.
- Reference-based scoring (user supplies golden answers) — rejected per the user's explicit choice; deferred as a future extension the pluggable interface leaves room for.

## 2. When scoring runs

**Decision**: Trigger scoring as a FastAPI `BackgroundTask` immediately after `generate_answer` commits a successful answer, so the HTTP response to the user is not delayed by the judge call. A scored turn gets its four values persisted; a turn whose scoring fails (judge error, malformed response, missing API key) is left unscored and simply excluded from aggregates — mirroring how `ConversationTurn.error` already represents a retryable failure state without blocking the rest of the system.

**Rationale**: Satisfies FR-009 ("without requiring the user to supply reference answers") while keeping the answer-generation path fast; matches the existing error-tolerant pattern in `playground/service.py` (turn stays usable even if one downstream step fails) and the spec's edge case that pending/failed scores must not corrupt the aggregate.

**Alternatives considered**:
- Synchronous scoring inline with `generate_answer` — rejected: adds LLM-judge latency directly to the answer response time, which the existing Playground UX doesn't currently pay.
- A separate polling/worker process — rejected: the stack has no task-queue infrastructure (no Celery/Redis in the Fixed Technology Stack), and a single local user's turn volume doesn't justify adding one (Constitution Principle III: YAGNI).

## 3. Schema shape for corpus-scoped questions

**Decision**: Extend the existing `ConversationTurn` table rather than introduce a parallel table: make `document_id` nullable, add a nullable `corpus_id` (FK to `corpora.id`), and add a `scope` column (`"document"` or `"corpus"`). Exactly one of `document_id`/`corpus_id` is set, matching the turn's scope. `ConversationTurnChunk` gains a nullable `document_id` snapshot column so a corpus-wide turn's retrieved chunks each record which document they came from (needed for FR-006/FR-012's scope reporting and for showing multi-document retrieved context).

**Rationale**: A single turns table keeps question/answer counting, scope breakdown, and score aggregation as one query instead of a union across two tables — directly serving FR-005/FR-006's combined counts. It also keeps the existing document-scoped Playground code path (`create_turn`, `generate_answer`, `list_turns`) as the same functions with a widened scope, rather than duplicating them.

**Operational note**: This project has no ALTER-based migration tooling — `app/main.py` calls `Base.metadata.create_all(engine)` on startup, which only creates missing tables, not new columns on existing ones (confirmed: no prior feature has altered an existing table's columns). Picking up these new columns on an existing local database requires resetting the Postgres volume (`docker compose down -v` then `docker compose up`), which is safe and expected for this single-user local tool (Constitution Principle III). This is documented as a setup step in `quickstart.md`.

**Alternatives considered**:
- A parallel `CorpusConversationTurn` table mirroring `ConversationTurn` — rejected: doubles the Playground service/schema surface and still needs a union for the combined counts/scores the spec requires, without avoiding a schema change (the new table itself needs `create_all` to pick up, so the "no ALTER needed" benefit doesn't materialize either).
- Introducing a real migration tool (Alembic) to avoid the dev-reset step — rejected: changes to migration tooling are outside this feature's scope and would be a bigger, unrelated infrastructure change than the metrics feature calls for.

## 4. Corpus-wide retrieval

**Decision**: Add a `search_corpus(db, corpus_id, model, query_vector, limit)` method to the `RetrievalStrategy` protocol and to `CosineSimilarityStrategy`, ranking chunks across every document currently linked to the corpus (via `document_corpora`) by the same cosine-distance ranking already used for single-document search, returning one global top-K across the whole corpus (not top-K per document).

**Rationale**: Keeps retrieval behind the same swappable-strategy registry (Constitution Principle I) instead of a separate code path, and a single global top-K across the corpus is the most natural reading of "ask a question against the entire corpus" — matching how a user would expect corpus-wide search to behave.

**Alternatives considered**:
- Per-document top-K merged afterward — rejected: would over-represent documents with only marginally relevant chunks at the expense of a document with several highly relevant ones, which isn't what "search the whole corpus" implies.

## 5. Pipeline identity and aggregation

**Decision**: A "RAG pipeline" (the spec's Key Entity) is identified by `(corpus_id, chunking_strategy, embedding_model)`. All of the Metrics screen's per-pipeline numbers (chunk count, embedding model, question/answer counts, scope breakdown, and the four aggregate quality scores) are computed on demand at read time by querying `Chunk`, `Embedding`, `ConversationTurn`, and the new score table filtered to that triple — no precomputed rollup/cache table.

**Rationale**: Given the project's single-local-user scale (Constitution Principle III), on-demand aggregation queries over a local Postgres instance are fast enough to meet SC-002's 2-second technique-switch target without the complexity of maintaining a cache that must be invalidated on every new chunk/embedding/turn/score.

**Alternatives considered**:
- A materialized/rollup table updated on every write — rejected as premature optimization for the expected data volume; adds invalidation complexity YAGNI advises against.

## 6. Quality-score storage shape

**Decision**: A new `turn_quality_scores` table, one row per successfully scored `ConversationTurn`, with four float columns (`context_precision`, `context_recall`, `response_relevancy`, `faithfulness`) plus `scored_at`. Aggregation averages these columns across all scored turns matching a pipeline's `(corpus_id, chunking_strategy, embedding_model, scope-agnostic)` filter.

**Rationale**: A dedicated table (rather than columns bolted onto `ConversationTurn`) keeps "scored" vs. "not yet scored" unambiguous (row absence = not scored, vs. needing sentinel/nullable float columns) and keeps the judge's write path isolated from the turn's own read/write path.

**Alternatives considered**:
- Nullable score columns directly on `ConversationTurn` — rejected: four more nullable floats on an already wide table, and "not yet scored" vs. "scored as 0.0" becomes harder to distinguish at a glance than row-presence.

# Data Model: Playground Similarity Search

No database schema changes. This feature only *reads* the existing `documents`, `chunks`, and
`embeddings` tables (013-bert-pgvector-embeddings `data-model.md`) — it introduces no new
persisted entity, column, or index.

## Transient (non-persisted) shapes

These exist only within a single request/response — nothing here is written to the database
(spec Key Entities: "Search Query ... not persisted beyond the current screen session").

### Playground Context

Read-only projection over a document's existing saved chunks/embeddings, used to power User
Story 2's pre-search display.

| Field | Type | Derivation |
|---|---|---|
| `documentId` | string | The requested document's id. |
| `chunkingStrategy` | string \| null | The `strategy` column from any of the document's saved `Chunk` rows (they share one value per current save — see Assumption below); `null` if no saved chunks. |
| `embeddingModel` | string \| null | The `model` of the most recently created `Embedding` across all of the document's chunks; `null` if none of its chunks have any saved embedding. |

**Assumption**: All of a document's currently-saved chunks share the same `strategy` value. Holds
today because re-chunking (Chunking screen's "Re-Calculate Chunks" + "Save Chunks") replaces the
document's saved chunk set as a whole rather than allowing a mixed-strategy set — consistent with
`Chunk`'s `UniqueConstraint("document_id", "index")` and 012/005's save-replaces-prior-set
behavior. If that ever changes, `chunkingStrategy` would need to become "the strategy of the most
recently created chunk" instead — out of scope here since it isn't how saving currently behaves.

### Search Query (request-scoped only)

| Field | Type | Notes |
|---|---|---|
| `documentId` | string | Which document's saved chunks to search. |
| `model` | string | Which registered embedding model to embed the query with — must match the model of the saved embeddings being searched (FR-003). |
| `query` | string | The user's natural-language text. Validated non-empty and within the model's max input length (FR-009, FR-014) before any embedding is computed. |

### Query Embedding (response-scoped only)

The vector produced by embedding `query` with `model` — same shape as a saved `Embedding.vector`
(a list of floats, 768 values for `bert`), but never written to the `embeddings` table.

### Similarity Result (response-scoped only)

| Field | Type | Derivation |
|---|---|---|
| `chunkId` | string | The matched `Chunk.id`. |
| `index` | int | The chunk's `index` within its document (for display, e.g. "CHUNK_3"). |
| `content` | string | The chunk's `content`. |
| `score` | float | `1 - cosine_distance(query_embedding, chunk_embedding)` for that chunk's single best-scoring saved `Embedding` row (FR-008 — deduplicated, never one entry per stored embedding). |

## Relationships to existing entities

```
Document (1) ──── (many) Chunk ──── (many) Embedding
     ▲                  ▲
     │                  │
GET /playground/context reads      POST /playground/search reads
(strategy, newest model)           (content, vectors) scoped to one
                                    document + one model
```

No new foreign keys, no new tables. `RetrievalStrategy` (research.md Decision 3) and the
`fits()` extension to `EmbeddingModelStrategy` (research.md Decision 4) are code-level interfaces,
not data-model entities.

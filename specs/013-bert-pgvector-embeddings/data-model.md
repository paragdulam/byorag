# Phase 1 Data Model: Generate and Save Chunk Embeddings

## Embedding (new — persisted)

New table, `embeddings`, added alongside the existing `corpora` / `documents` / `document_corpora`
/ `chunks` tables (`backend/app/db/models.py`).

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key. |
| `chunk_id` | UUID (FK → `chunks.id`, `ondelete="CASCADE"`) | The chunk this embedding was computed from. Indexed. |
| `model` | string | The registry key of the embedding model that produced this vector (e.g. `"bert"` — mirrors `Chunk.strategy` storing `"fixed-size"`, not the raw underlying model artifact name). |
| `vector` | `pgvector` `vector(768)` | The embedding itself. Dimension is fixed to the one supported model today (research.md §3) — not per-row variable. |
| `created_at` | timestamptz | Set on insert; distinguishes multiple saved embeddings for the same chunk/model over time. |

**Validation rules**:
- `chunk_id` must reference an existing `Chunk` row (FK constraint).
- `model` must be a key registered in the backend's `EMBEDDING_MODELS` strategy registry at save
  time (mirrors `resolve_run`'s existing `strategy not in STRATEGIES` check in chunking).
- No uniqueness constraint on `(chunk_id, model)` — by design (research.md §6), a chunk may have
  many rows for the same model, each from a separate save.

**Relationships**:
- Many `Embedding` rows → one `Chunk` (`Chunk.embeddings: list[Embedding]`, cascade delete-orphan —
  deleting a chunk deletes its embeddings, mirroring how deleting a `Document` already cascades to
  its `Chunk` rows).

**State transitions**: None post-insert — rows are immutable once written (no update path in this
feature; only inserts, per the accumulate-not-replace design). Deletion only happens transitively
via a chunk/document delete cascade, never as a direct user action in this feature.

## Chunk (existing — gains one relationship)

No column changes. `backend/app/db/models.py::Chunk` gains:

```python
embeddings: Mapped[list["Embedding"]] = relationship(
    back_populates="chunk", cascade="all, delete-orphan"
)
```

## Embedding Model Selection (new — backend-internal registry, not persisted as its own row)

Mirrors `app.chunking.strategies.base.STRATEGIES` / `ChunkingStrategy`.

| Aspect | Shape |
|---|---|
| Interface | `EmbeddingModelStrategy` protocol: `embed(texts: list[str]) -> Iterator[tuple[int, list[float]]]` — yields `(chunk_index, vector)` pairs incrementally so the caller can report per-chunk progress (mirrors chunking's per-page yield shape). |
| Registry | `EMBEDDING_MODELS: dict[str, EmbeddingModelStrategy]`, keyed by a stable id (e.g. `"bert"`). |
| Registered today | Only `"bert"` (`BertEmbeddingStrategy`, `transformers` + `torch`, `bert-base-uncased`, mean-pooled, 768-dim — research.md §1). |
| Exposed to the frontend via | `GET /api/embeddings/models` → `[{ "id": "bert", "label": "BERT (bert-base-uncased)" }]`, so the dropdown is server-driven, not hardcoded (spec FR-003). |

## Embedding Preview (new — transient, frontend-only, not persisted)

The unsaved result of a successful "Generate Embeddings" run, held only in the `useChunkEmbeddings`
hook's state (mirrors `useFixedSizeChunking`'s `ChunkingResult`).

| Field | Type | Notes |
|---|---|---|
| `chunks` | `{chunkId, index, content}[]` | Echoes which chunks were embedded (from the saved-chunks read, not recomputed). |
| `vectors` | `{chunkId, model, dims, vector: number[]}[]` | One per chunk, from the generate response. |
| `model` | string | The model id used for this preview. |
| `documentId` | string | The document this preview belongs to. |

**State transitions**: Same shape as chunking's preview lifecycle — replaced by a new successful
generate, discarded on navigating away or switching document/model, and (unlike chunking) never
itself sent to the save endpoint — save recomputes independently (research.md §4).

## Saved Chunks Read (new — backend response shape, not a new persisted entity)

`GET /api/chunking/saved-chunks?documentId=` response, used by the Embeddings screen (and reusable
by any future "view what's saved" chunking UI):

| Field | Type | Notes |
|---|---|---|
| `chunks` | `{id, index, content}[]` | The document's current saved `Chunk` rows, in `index` order. Empty array (not an error) when the document has no saved chunks — the empty state is a normal, expected response shape, not a failure (spec FR-002, US1 Acceptance Scenario 3). |

## Frontend types (`frontend/src/types/embeddings.ts`, new)

```ts
export interface EmbeddingModelOption {
  id: string
  label: string
}

export interface SavedChunk {
  id: string
  index: number
  content: string
}

export interface EmbeddingVector {
  chunkId: string
  model: string
  dims: number
  vector: number[]
}

export interface EmbeddingGenerateResult {
  documentId: string
  model: string
  vectors: EmbeddingVector[]
}

export interface EmbeddingSaveResult {
  documentId: string
  model: string
  savedCount: number
}
```

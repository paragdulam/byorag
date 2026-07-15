# Phase 1 Data Model: Vector View Screen

No new persisted entity and no schema change — this feature only *reads* the existing `Embedding`
and `Chunk` tables (`013-bert-pgvector-embeddings`). This document describes the new transient
(response/frontend) shapes and one new backend-internal registry.

## Saved Embedding (read shape — existing `Embedding` row, new response projection)

`GET /api/embeddings/saved?chunkId=` response, one entry per saved `Embedding` row for that chunk:

| Field | Type | Notes |
|---|---|---|
| `id` | string | The `Embedding` row's own id — distinguishes multiple saves for the same chunk/model. |
| `model` | string | The registry key of the model that produced it (e.g. `"bert"`), echoing `Embedding.model`. |
| `createdAt` | string (ISO 8601) | From `Embedding.created_at` — how the user tells saves apart when the model is the same. |
| `dims` | integer | `len(vector)` — always `768` today (`013`'s fixed dimension). |
| `vector` | float[] | The exact stored values, unmodified. |

**Ordering**: descending by `createdAt` (most recent first) — see research.md §3 for why this
drives the default selection.

**Validation rules**: `chunkId` must reference an existing `Chunk` row (new `get_chunk_or_none`
lookup, mirroring `get_document_or_none`/`get_corpus_or_none`); `404` otherwise. An empty list
(`[]`) is a valid, normal response for a chunk with no saved embeddings — not an error (spec FR-008).

## Projection Method (new — backend-internal registry, not persisted)

Mirrors `013`'s `EMBEDDING_MODELS`/`EMBEDDING_MODEL_LABELS` registry shape.

| Aspect | Shape |
|---|---|
| Registry | `PROJECTION_METHODS: dict[str, ProjectionMethodInfo]`, keyed by a stable id (e.g. `"vector"`, `"umap"`, `"pca"`). |
| `ProjectionMethodInfo` | `{ label: str, available: bool }`. |
| Registered today | `"vector"` (`available=True` — the only functional entry, raw-grid display per FR-006/FR-010), `"umap"` and `"pca"` (`available=False` — visible placeholders per FR-011). |
| Exposed via | `GET /api/embeddings/projection-methods` → `{ "methods": [{"id": "vector", "label": "Vector", "available": true}, {"id": "umap", "label": "UMAP", "available": false}, {"id": "pca", "label": "PCA", "available": false}] }`. |

**Validation rules**: none needed — this is a read-only, parameterless listing endpoint.

## Frontend types (`frontend/src/types/embeddings.ts`, additions)

```ts
export interface SavedEmbedding {
  id: string
  model: string
  createdAt: string
  dims: number
  vector: number[]
}

export interface ProjectionMethodOption {
  id: string
  label: string
  available: boolean
}
```

`SavedChunk`, `EmbeddingModelOption`, `EmbeddingVector`, `EmbeddingGenerateResult`,
`EmbeddingSaveResult` (all from `013`) are unchanged and reused as-is — Vector View's chunk list
reuses `SavedChunk` via the existing `listSavedChunks` API call.

## `useChunkEmbeddings` hook (extended, not a new entity)

| Field | Type | Notes |
|---|---|---|
| `hasSavedOnce` | boolean | **New.** One-way latch, `true` from the first successful `save()` onward for the session (research.md §5). Drives "Move to Vector View"'s disabled state on the Embeddings screen. |

## `useVectorView` hook (new — mirrors `useChunkEmbeddings`'s shape)

| Field | Type | Notes |
|---|---|---|
| `documents` | `SourceDocument[]` | Reused via the existing `listSources`. |
| `savedChunks` | `SavedChunk[]` | Reused via the existing `listSavedChunks`, reactive to the selected document (same pattern as Embeddings). |
| `savedEmbeddings` | `SavedEmbedding[]` | **New.** Reactive to the selected chunk (research.md §1). |
| `isLoadingSavedEmbeddings` | boolean | **New.** |
| `projectionMethods` | `ProjectionMethodOption[]` | **New.** Loaded once, independent of selection (mirrors how `models` loads independently in `useChunkEmbeddings`). |

Document, chunk, and projection-method **selection** state itself lives in `VectorViewScreen`
(local component state), not in the hook — consistent with how document/model selection already
lives in `EmbeddingsScreen` and `FixedSizeChunkingScreen`, not their hooks.

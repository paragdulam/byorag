# Data Model: Sources, Chunking & Embeddings UX Refresh

This feature adds no new persisted database tables. It introduces one new
transient (non-persisted) computed entity and extends how existing entities
are surfaced. All persistence-layer entities below already exist; only the
newly-introduced request/response shapes and frontend-only presentation
concepts are new.

## Existing entities referenced (no schema change)

### Document (existing)

Relevant existing fields used by this feature:
- `id`
- `storage_path` — absolute filesystem path to the stored PDF; used by the
  new PDF-file endpoint to stream bytes.
- `corpus associations` — used to enumerate documents when scope = "Entire
  Corpus."

No new fields required.

### SavedChunk (existing, via `GET /api/chunking/saved-chunks`)

Existing shape: `{ id, index, content }`, scoped to a `documentId`.

Used as-is by:
- Fixed Size Chunking auto-load (User Story 1) — no shape change.
- Chunked Preview (User Story 3) — each `SavedChunk` becomes one colored
  block, in ascending `index` order.

No new fields required.

### SavedEmbedding (existing, via `GET /api/embeddings/saved?chunkId=`)

Existing shape: `{ id, model, createdAt, dims, vector: number[] }`, scoped to
a `chunkId`.

Used as input to the new projection computation (see below). No new fields
required on this entity; the frontend/backend combine it with `chunkId` and
`documentId` (already known from the calling context) when submitting a
projection request.

## New transient entities (request/response only — not persisted)

### ProjectionRequestEntry

One input row submitted to the new projection endpoint.

| Field | Type | Notes |
|---|---|---|
| `chunkId` | string | Identifies the chunk this vector belongs to |
| `documentId` | string | Identifies the source document (for corpus-scope grouping/exclusion reporting) |
| `vector` | number[] | The saved embedding vector for this chunk |

Validation:
- All `vector` entries in a single request MUST have the same length (same
  embedding model/dimension); a request mixing dimensions is rejected with a
  clear error rather than silently producing a meaningless projection.
- A request MUST contain at least 5 entries (per the clarified minimum) or
  it is rejected; the frontend is expected to keep the projection control
  disabled below this minimum so this is a defensive backend check, not the
  primary UX gate.

### ProjectionPoint

One output row from the projection computation.

| Field | Type | Notes |
|---|---|---|
| `chunkId` | string | Echoes the input entry's chunk id |
| `documentId` | string | Echoes the input entry's document id |
| `x` | number | First projected coordinate |
| `y` | number | Second projected coordinate |

### ProjectionMethod (existing entity, behavior change only)

Existing shape (`backend/app/embeddings/projection_methods.py`): `{ key,
label, available }`. No shape change — this feature flips `available` to
`true` for the `umap` and `pca` entries once their computation is
implemented, and wires the corresponding backend computation instead of
leaving them as inert placeholders.

## Frontend-only presentation concepts (not sent over the wire)

### ChunkColorAssignment

Computed entirely in the frontend when rendering the Chunked Preview; never
persisted or transmitted.

| Field | Type | Notes |
|---|---|---|
| `chunkId` | string | The chunk this color applies to |
| `backgroundColor` | string (hex, from curated palette) | Re-rolled if it would match the immediately preceding chunk's color |
| `textColor` | string (hex, fixed constant) | Same value for every chunk, chosen for legibility against every palette color |

### DocumentExclusion (Entire-Corpus projection)

Computed in the frontend (or returned alongside the projection response) to
drive the "which documents were excluded and why" messaging from FR-017.

| Field | Type | Notes |
|---|---|---|
| `documentId` | string | The excluded document |
| `reason` | enum: `no_saved_embeddings` | Only reason in this feature's scope; documents with zero saved embeddings for any chunk are excluded |

# Contract: Vector View "Entire Corpus" Combined Listing

Not an HTTP API contract — Vector View's "Entire Corpus" option (spec User Story 8, FR-022–FR-025)
introduces no new backend endpoint. This pins down how `useVectorView` assembles the combined,
grouped chunk list purely client-side, reusing the existing per-document saved-chunks endpoint.

## Behavior

When the document selector's value is `ENTIRE_CORPUS_SELECTION` (`data-model.md`):

1. `useVectorView` calls the existing `GET /api/chunking/saved-chunks?documentId=...`
   (`listSavedChunks`, unchanged — `013-bert-pgvector-embeddings` contracts/embeddings-api.md)
   once per document in the active corpus's document list, in that same list order.
2. Results are exposed as `chunkGroups: ChunkGroup[]` (data-model.md) — one group per document
   that has at least one saved chunk, in document-list order, each carrying that document's
   `documentId`/`documentName` and its `SavedChunk[]` in the same `index` order the per-document
   endpoint already returns them in.
3. Documents with zero saved chunks are simply omitted from `chunkGroups` — they do not produce an
   empty group or an error (mirrors the existing single-document "no saved chunks yet" handling,
   just applied per document before grouping).
4. If **no** document in the corpus has any saved chunks, `chunkGroups` is an empty array, and the
   screen shows the existing "no saved chunks yet" guidance exactly as it does today for a single
   document with nothing saved (FR-025) — not a distinct "entire corpus empty" message.
5. The UI renders `chunkGroups` as a header per document (its name) followed by that document's
   chunk cards, in group order — the layout resolved in `/speckit-clarify` ("grouped by document,
   with headers").
6. Selecting any chunk from any group — regardless of which document it belongs to — calls the
   existing `GET /api/embeddings/saved?chunkId=...` (`listSavedEmbeddings`, unchanged) for that one
   chunk's id, exactly as selecting a chunk does today in single-document mode (FR-024). There is
   no "combined" or "aggregate" embedding view across documents — each chunk's own saved
   embedding(s) are what display, one chunk at a time, same as before this feature.

## What does *not* change

- `GET /api/chunking/saved-chunks` and `GET /api/embeddings/saved` — both entirely unchanged;
  called more times (once per document) rather than differently.
- Chunk index numbers remain per-document (`CHUNK_0`, `CHUNK_1`, ...); the per-document group
  header is what disambiguates otherwise-repeating indices across documents in the combined list
  (spec Edge Cases) — no renumbering or synthetic cross-document chunk ids are introduced.

# Research: Sources, Chunking & Embeddings UX Refresh

## 1. PDF rendering in the frontend

**Decision**: Use `react-pdf` (wraps `pdfjs-dist`) for the right-side PDF preview pane.

**Rationale**: The app has no PDF-rendering dependency today. `react-pdf` gives a React-idiomatic `<Document>`/`<Page>` API with built-in page navigation, which directly satisfies the spec's "standard page-by-page viewing" assumption, without hand-rolling PDF.js canvas/worker setup. It's the most widely used React wrapper for `pdfjs-dist` and needs no backend changes beyond serving raw bytes.

**Alternatives considered**:
- Raw `pdfjs-dist` — more control, but requires manually managing the worker, canvas rendering, and page state that `react-pdf` already provides.
- Native `<embed>`/`<iframe src="...pdf">` — zero new dependency, but rendering is delegated to the browser's built-in viewer, which can't be styled to sit cleanly inside a custom split-pane layout and behaves inconsistently across browsers (some show native PDF chrome/toolbars that clash with app UI).

## 2. Serving PDF bytes to the frontend

**Decision**: Add `GET /api/sources/{document_id}/file` to `backend/app/sources/router.py`, resolving `Document.storage_path` and returning the file via a `FileResponse`/streaming response with `media_type="application/pdf"`.

**Rationale**: No such endpoint exists today (confirmed by reading the current router — only list/upload/delete/corpus-attach endpoints exist). The storage convention (`Document.storage_path` → absolute path under `settings.pdfs_dir`) already gives everything needed to resolve and stream the file; this is a straightforward addition following the existing feature-module (`router.py` + `service.py`) pattern.

**Alternatives considered**: Signed/temporary URLs — unnecessary; this is a single-local-user tool (Constitution Principle III), so a direct authenticated-by-default local endpoint is sufficient.

## 3. Fixed Size Chunking auto-load fix

**Decision**: Frontend-only change. `useFixedSizeChunking` calls the existing `GET /api/chunking/saved-chunks?documentId=` on mount/selection-change (mirroring the pattern already used by Embeddings and Vector View, per spec `015-fix-saved-chunks-not-showing`), instead of only populating `result` after a `run()` call. For "Entire Corpus," fan out the same call per document (same pattern already used in `useVectorView`'s `chunkGroups` effect).

**Rationale**: `GET /api/chunking/saved-chunks` already returns `[]` (not an error) when nothing is saved, so this is a safe default call. No backend change is needed — the endpoint and response shape already exist and already work correctly when called from other screens.

**Alternatives considered**: A new corpus-level batch endpoint (`GET /api/chunking/saved-chunks?corpusId=`) — would reduce N per-document calls to 1, but the entire-corpus scale clarification (~50 documents typical) means N parallel per-document calls is an acceptable YAGNI-aligned choice for this feature; a batch endpoint is a plausible future optimization, not required now.

## 4. Chunked Preview rendering model

**Decision**: Render the document's saved chunks as a **sequence of discrete colored blocks**, one per chunk in ascending `index` order — each block is its own `ReactMarkdown` render of that chunk's `content`, wrapped in a container with a palette-assigned background color and fixed dark text color. Blocks are NOT merged/deduplicated into one continuous document text.

**Rationale**: Chunking can be configured with overlap (spec `007-chunking-overlap-controls`), so adjacent saved chunks can share duplicated text at their boundaries. Attempting to merge chunks into a single seamless document would require reconciling overlapping spans — added complexity with no spec requirement for a seamless reading view. Rendering each chunk as its own visually bounded block is simpler, is a more direct visualization of "chunk boundaries" (the stated purpose in User Story 3), and avoids inventing text-deduplication logic outside this feature's scope.

**Alternatives considered**: Reconstruct one continuous document string with inline color spans marking chunk boundaries — rejected for the overlap-merging complexity above, and because per-chunk blocks already satisfy every acceptance scenario in User Story 3 (distinct background per chunk, adjacent chunks visibly different, empty-state for no chunks).

**Markdown structure reconstruction** (headings/lists/bold from PDF layout, per the best-effort clarification): scoped as an optional, separately-tracked task. The MVP renders each chunk's raw extracted text as-is through `ReactMarkdown` (plain paragraphs); a lightweight heuristic pass (e.g., treat short all-caps or short standalone lines as headings) may be added afterward if low-effort, but is not required for the feature to be considered complete.

## 5. Per-chunk color palette

**Decision**: A fixed, curated array of ~10-12 soft/pastel hex colors (e.g., muted blue, green, peach, lavender, etc.) with one constant dark foreground text color (e.g., near-black). For each rendered chunk, pick a palette color at random, re-rolling only if it matches the immediately preceding chunk's color (satisfies "adjacent chunks must not share a color").

**Rationale**: A small curated palette guarantees every background/foreground pairing is pre-validated for contrast, satisfying the legibility clarification without needing a runtime contrast-ratio calculation. Re-rolling only against the immediately preceding color is the simplest algorithm that satisfies the "no two consecutive chunks share a color" rule.

**Alternatives considered**: Fully random RGB/HSL generation with a runtime WCAG contrast check against a dynamically chosen text color — more "unique" per the literal word choice in the request, but rejected per the clarification answer (Option B) favoring guaranteed legibility over unconstrained randomness.

## 6. Embedding projection computation (UMAP / PCA)

**Decision**: Add `scikit-learn` (for PCA) and `umap-learn` (for UMAP) as backend dependencies. Add a new `backend/app/embeddings/projections/` subpackage mirroring the existing pluggable-registry pattern used by `chunking/strategies/` and `embeddings/models/`: a small interface (e.g., `project(vectors: list[list[float]]) -> list[list[float]]`) with `pca.py` and `umap.py` implementations, registered in `projection_methods.py` (replacing the current hardcoded `available=False` entries with real implementations). Default to a 2-component (2D) projection.

**Rationale**: This directly follows Constitution Principle I (pluggable strategies via registered implementations, not hardcoded branching) and reuses the exact module-layout convention already established for chunking strategies and embedding models. `scikit-learn`'s `PCA` and the canonical `umap-learn` package are the standard, well-tested implementations for each method — reimplementing either by hand (e.g., PCA via raw NumPy SVD) would add risk (centering/sign-convention bugs) for no benefit, since neither dependency is unusually heavy relative to `torch`/`transformers`, which the backend already depends on.

**Alternatives considered**: 3D projections — technically what "2D/3D" in the spec's Key Entities gestures at, but a 3D scatter plot needs a rendering approach with orbit/rotation controls (e.g., a WebGL-based library), which is materially more frontend complexity than a 2D scatter chart delivers for the same "do similar chunks cluster together" validation goal. Per Constitution Principle III (YAGNI) and the "typical lab scale" scoping already agreed in clarification, this feature ships 2D-only; 3D is a plausible future enhancement, not required now.

## 7. Frontend scatter-plot rendering

**Decision**: Use `recharts` (`ScatterChart`/`Scatter`) for the 2D embedding-projection plot, colored/grouped by source document when scope is "Entire Corpus," with each point's tooltip identifying its chunk and document.

**Rationale**: No charting library exists in the frontend today. `recharts` is a lightweight, React-idiomatic charting library well suited to a simple XY scatter with per-series coloring and tooltips — proportionate to a 2D-only scope decided above. It integrates cleanly with the existing React 19 + Tailwind stack without pulling in a heavier general-purpose visualization engine.

**Alternatives considered**: `plotly.js` — has native 3D scatter support, but is a much larger dependency and would only pay off if 3D projection were in scope (it is not, per decision 6). `d3`/`visx` directly — maximal flexibility, but requires hand-building axes, scales, and interaction handling that `recharts` already provides out of the box.

## 8. Entire-Corpus embeddings scope handling

**Decision**: Client-side fan-out — call `GET /api/embeddings/saved?chunkId=` for every chunk across every document in the corpus (reusing the existing per-chunk endpoint and the existing "loop over documents" pattern already used elsewhere for "Entire Corpus"), then submit the combined vector set to the (new) projection computation. Documents with zero saved embeddings are simply excluded from the combined set, with the UI listing which documents were excluded.

**Rationale**: Matches the existing "Entire Corpus" implementation pattern already used by Chunking auto-load and Vector View, and is consistent with the ~50-document lab-scale clarification — no new batch endpoint is required at this scale.

**Alternatives considered**: A new backend endpoint accepting a corpus ID and returning all embeddings/projections server-side in one call — would reduce round-trips and could compute the projection server-side in one pass (arguably cleaner), and is the natural next step if corpus sizes grow well beyond ~50 documents. Deferred as a future enhancement per the explicit scale clarification.

## 9. Where the projection computation runs

**Decision**: Compute the projection (PCA/UMAP fit + transform) on the backend, in a new endpoint (e.g., `POST /api/embeddings/project`) that accepts the method and a list of `{chunkId, documentId, vector}` entries (already fetched by the frontend via existing per-chunk/per-document calls) and returns 2D coordinates per input entry.

**Rationale**: `umap-learn` and `scikit-learn` are Python libraries; there is no equivalent, well-tested UMAP implementation for the browser. Doing the fit/transform server-side also keeps the heavy numerical dependency out of the frontend bundle entirely, consistent with the existing split (backend does all embedding-model inference already).

**Alternatives considered**: Client-side projection via a JS UMAP/PCA port — rejected; JS UMAP implementations are far less mature/tested than `umap-learn`, and PCA-in-the-browser would duplicate logic that already needs to exist server-side for consistency.

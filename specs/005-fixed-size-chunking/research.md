# Research: Fixed Size Chunking Experiment

## 1. Pluggable chunking architecture (constitution Principle I)

**Decision**: Introduce a `ChunkingStrategy` interface in a new `backend/app/chunking/` module,
with a name-keyed strategy registry, and implement exactly one strategy now: `"fixed-size"`. The
`POST /api/chunking/run` request contract accepts a `strategy` field from day one (not just a bare
chunk-size call), so the other algorithms the reference design shows (Recursive Character,
Semantic Chunking) can be registered later without a breaking API change — they just aren't
implemented or selectable yet (spec FR-008, User Story 3: those UI controls are visible but inert).

**Rationale**: This is the project's *first* real pipeline-stage implementation (ingestion,
chunking, embedding, retrieval per constitution Principle I). Hardcoding fixed-size logic directly
into the router would satisfy this feature's spec but would violate "every stage of the RAG
pipeline MUST be implemented behind a swappable interface/strategy... New strategies MUST be
addable via configuration or a registered strategy implementation, not via hardcoded branching
logic." A small `strategy: ChunkingStrategy` registry costs almost nothing to build now and avoids
a rewrite when Recursive Character / Semantic Chunking are implemented later.

**Alternatives considered**:
- Hardcode fixed-size splitting directly in the router/service with no interface: rejected —
  directly violates Principle I for the project's first pipeline stage; the constitution requires
  this to be justified in Complexity Tracking if skipped, and there's no good justification since
  the interface costs little.
- Build a full plugin-loading system (dynamic discovery, config-driven registration): rejected as
  premature — a plain Python dict mapping strategy name → implementation is sufficient for one
  registered strategy today (Principle III, YAGNI); a fancier plugin loader can be introduced when
  a second or third strategy actually exists and reveals real requirements.

## 2. PDF text extraction

**Decision**: Use `pypdf` for PDF → text extraction, invoked server-side as part of the chunking
service.

**Rationale**: The user suggested `docling`, but a dry-run dependency resolution
(`uv pip install docling --dry-run`) showed it pulls in roughly 100 transitive packages, including
a full ML stack (`torch`, `torchvision`, `transformers`, `opencv-python`, `rapidocr`, `numpy`,
`scipy`, and more) — a multi-gigabyte install and a much slower/larger Docker build, purely to
extract plain text for word-count-based chunking (research.md §3). Presented with the measured
footprint, the user chose to switch to a lightweight extractor instead. `pypdf` is a small,
actively maintained, pure-Python PDF library with no heavy transitive dependencies, and it
satisfies this feature's actual requirement (FR-005: extract text content) directly. It does not
handle scanned/image-only PDFs (no OCR) — but the spec already requires a clear "text could not be
extracted" error for exactly that case (FR-012), so a scanned PDF degrades precisely as the spec
designed for, not as an unhandled gap. The constitution's Fixed Technology Stack governs
framework/language/vector-DB/containerization choices, not individual libraries — adding `pypdf`
here is the same category of addition as `psutil` (003) and `python-multipart` (002).

**Alternatives considered**:
- `docling`: rejected after measuring its actual dependency weight (see above) — disproportionate
  for this feature's narrow need (plain text extraction for chunking), even though it would be a
  better long-term fit for future ingestion needs (tables, layout, OCR) if this project later adds
  a feature that specifically needs those capabilities. That tradeoff can be revisited then, with a
  concrete need driving it, rather than paid upfront here (Principle III, YAGNI).
- `pdfplumber` / `PyMuPDF`: also lightweight, viable alternatives to `pypdf` for the same narrow
  need. `pypdf` was chosen as the simplest, most widely used baseline for plain text extraction
  with no meaningful functional difference for this feature's purposes.

## 3. Chunk size unit ("tokens") without a tokenizer dependency

**Decision**: Approximate "tokens" as whitespace-delimited words. The fixed-size strategy splits
extracted text into chunks of N words (N = the user's chunk size input), not exact LLM-tokenizer
tokens.

**Rationale**: The spec's Assumptions explicitly allow this — "an exact match to any specific
LLM's tokenizer is not required... a consistent, reasonable approximation is sufficient." Adding a
real tokenizer (e.g., `tiktoken`) would pull in another dependency and tie the approximation to one
specific model family for no functional benefit here, since no embedding model is chosen yet
anywhere in this pluggable-by-design project. Word-count splitting is simple, fast, dependency-free,
deterministic, and satisfies spec SC-003 (smaller chunk size → visibly more/smaller chunks) exactly
as well as a real tokenizer would for this feature's purpose.

**Alternatives considered**:
- `tiktoken` (OpenAI's BPE tokenizer): rejected — ties the "chunk size" concept to one specific
  model family's tokenizer before any embedding/generation model has been chosen anywhere in the
  product, and adds a dependency purely for a closer approximation the spec doesn't require.
- Raw character count: rejected — words are a closer approximation to how "tokens" are commonly
  understood by RAG practitioners (and by the reference design's "512 Tokens" label) than raw
  character count would be.

## 4. Where the 200-chunk display cap is enforced

**Decision**: The backend enforces the cap. The chunking response includes the first 200 chunks
plus the *true total* chunk count (`totalChunks`), even when `totalChunks > 200`. The frontend
never needs to know or enforce the cap itself — it just renders what it's given and shows the
"more exist" note (FR-007a) whenever `totalChunks > chunks.length`.

**Rationale**: Keeps the truncation logic in one place (spec FR-007a is a single, testable backend
behavior) and avoids sending a potentially large uncapped payload over the wire only to have the
frontend discard the tail — pointless work and bandwidth for documents that produce thousands of
chunks at a small chunk size.

**Alternatives considered**: Sending all chunks and truncating client-side: rejected — no benefit
over server-side truncation, and wastes bandwidth/parse time on chunks that would never be shown.

## 5. Client-side navigation: no router library

**Decision**: Add a plain `activeScreen` state (e.g., `'sources' | 'fixed-size-chunking'`) in
`App.tsx`, with `SidebarNav` taking an `activeScreen` + `onNavigate` pair instead of the
per-item static `active` flag it has today. No routing library, no URL changes, no deep-linking.

**Rationale**: The app currently has zero client-side routing (`App.tsx` renders exactly one
screen unconditionally; `SidebarNav`'s nav items are inert `<a href="#">`s). Adding a full router
(e.g., `react-router-dom`) for two screens is more machinery than the current need justifies
(Principle III, YAGNI) — a small piece of state and a conditional render accomplishes the same
user-visible outcome (spec FR-001/FR-002: selecting a sidebar item opens a screen) without a new
dependency, and without inventing URL/deep-link semantics the spec never asked for (Assumptions:
the screen doesn't need to remember state across navigations, so there's no persistence need a
router's URL state would otherwise motivate).

**Alternatives considered**: `react-router-dom`: would give real URLs (bookmarkable, browser
back/forward), but that's unrequested scope for a two-screen app and a new dependency; can be
introduced later if/when more screens and real deep-linking needs accumulate (this plan's
`SidebarNav` change doesn't foreclose that — swapping local state for a router later is a small,
contained change).

## 6. Sidebar sub-options structure

**Decision**: `SidebarNav`'s `NAV_ITEMS` model gains an optional `subItems` list per top-level
item. "Experiments" is the first (and for now, only) item with `subItems`, containing one entry:
"Fixed Size Chunking". Selecting "Experiments" itself expands/reveals its `subItems` in place
(FR-001); selecting the sub-item navigates (FR-002). Other top-level items (Playground, Vector
View, Logs) are unaffected — they remain inert single items, matching current behavior for
everything this feature doesn't touch.

**Rationale**: Directly matches FR-001's wording ("reveal a set of sub-options when selected") and
keeps the change additive and localized to `SidebarNav`'s existing data-driven rendering pattern
rather than introducing a new component just for one expandable item.

## 7. No caching or persistence of extraction/chunking results

**Decision**: Every `POST /api/chunking/run` call re-extracts the selected document's text and
re-computes chunks from scratch. Nothing is cached or persisted across requests.

**Rationale**: Matches the spec's Assumptions (chunking results are ephemeral, no save/compare
mechanism in this feature) and Principle III (YAGNI) — a caching layer is unjustified complexity
for a single-user local tool re-processing documents that are, per 002's established scale, small
in number and size (dozens of documents, ≤50MB each).

**Alternatives considered**: Caching extracted text keyed by document id to avoid re-extracting on
every chunk-size change: rejected as premature optimization — no performance problem has been
observed or required by the spec, and `docling` extraction cost is paid once per chunking run, not
per keystroke (the chunk size input doesn't trigger extraction until the user explicitly re-runs
chunking, consistent with 003/004's precedent of explicit-trigger over live-recompute).

# Data Model: PDF Preview Zoom & Pan

No persisted entities. This feature adds no database tables/columns and no new API payloads — it
is entirely transient, client-side view state scoped to one `SourceDocumentPreview` component
instance.

## ZoomState (client-side only, in-memory)

| Field | Type | Notes |
|---|---|---|
| `scale` | number | Current zoom multiplier. `MIN_SCALE` (`1.0` / 100%, default) ≤ `scale` ≤ `MAX_SCALE` (`4.0` / 400%). Lives in `SourceDocumentPreview` React state; passed as `react-pdf`'s `Page` `scale` prop. |

**Lifecycle / state transitions**:

- Initialized to `MIN_SCALE` when a document is first opened.
- `zoomIn(scale)` / `zoomOut(scale)` (pure functions in `frontend/src/lib/pdfZoom.ts`) step by
  `0.25`, clamped to `[MIN_SCALE, MAX_SCALE]` — see [research.md](./research.md) §3.
- `reset()` sets `scale` back to exactly `MIN_SCALE`.
- Reset to `MIN_SCALE` automatically whenever `documentId` changes (FR-010) — same effect hook that
  already resets `numPages`/`loadError` today.
- **Not** reset when `isFullscreen` toggles (research.md §7).
- Not persisted anywhere (no localStorage, no server round-trip, no per-user storage) — a fresh
  page load or document reselect always starts back at `MIN_SCALE`.

## PanPosition (client-side only, DOM-owned)

| Field | Type | Notes |
|---|---|---|
| `scrollLeft` / `scrollTop` | number (pixels) | Native scroll offsets of the existing preview scroll container. Not a separate piece of app state — read/written directly via a DOM ref during drag (research.md §5), and otherwise driven by the browser's normal scrolling. |

**Lifecycle / state transitions**:

- Updated continuously while a pointer-drag is in progress (research.md §5).
- Bounds enforced by the browser's native scroll clamping — never allowed outside `[0, scrollWidth
  - clientWidth]` / `[0, scrollHeight - clientHeight]` (FR-006), with no separate app-level bounds
  check required.
- Growing/shrinking `scale` naturally changes `scrollWidth`/`scrollHeight` (the page element itself
  gets larger/smaller), which is what makes "pan within page, then advance" (FR-006a) fall out of
  existing layout rather than needing its own tracked state (research.md §4).

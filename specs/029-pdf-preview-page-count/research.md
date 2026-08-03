# Research: PDF Preview Page Indicator

No `NEEDS CLARIFICATION` items remain from the spec's Technical Context — the feature is
small and scoped to one existing component. This document records the one real technical
decision the plan makes and the alternatives considered.

## Decision: Track "current page" via `IntersectionObserver` on each page wrapper

**Decision**: Wrap each rendered `<Page>` in `SourceDocumentPreview` with a `data-page`
element registered with a single `IntersectionObserver` scoped to the scroll container
(`root: scrollAreaRef.current`). On each observer callback, pick the page with the highest
`intersectionRatio` among currently-observed entries as the "current page." Re-derive the
indicator's page number from that value; total pages continues to come from the existing
`numPages` state (already set via `Document`'s `onLoadSuccess`).

**Rationale**:
- Matches how continuous-scroll PDF viewers (browser-native PDF viewers, Google Drive's
  preview, etc.) conventionally define "current page" — whichever page occupies the most of
  the visible viewport.
- `IntersectionObserver` computes visibility asynchronously off the scroll-event path, so it
  doesn't add a scroll listener or force synchronous layout reads on every scroll frame —
  keeps the existing drag-to-pan and zoom interactions on this component free of added jank.
  This matters here because the component already does manual pointer-based pan handling
  (`handlePointerMove` directly mutates `scrollLeft`/`scrollTop` every pointer-move event);
  adding a second, competing scroll-driven code path (a `scroll` event listener) would risk
  jank or race conditions with that existing drag logic. `IntersectionObserver` sidesteps
  this entirely since it doesn't hook the same event path.
- No new dependency: it's a standard browser API with full support across the target browser
  matrix; `react-pdf` and the rest of the frontend stack already assume a modern evergreen
  browser.
- Cleanly reusable across both consumers (Data Sources screen, Golden Dataset screen) with
  zero per-consumer code, since both simply render `SourceDocumentPreview` — the tracking
  logic lives entirely inside that one component.

**Alternatives considered**:
- **`scroll` event + manual `getBoundingClientRect()` math**: Rejected — requires a listener
  on the scroll container (which already has pointer handlers for pan-to-zoom) and forces a
  synchronous layout read on every scroll event, which is exactly the kind of jank
  `IntersectionObserver` was designed to avoid. More code, worse performance profile, no
  offsetting benefit here.
- **`react-pdf`'s built-in page-visibility utilities**: `react-pdf` doesn't ship a
  page-visibility/current-page API for continuous mode — page number tracking for
  continuous-scroll layouts is explicitly left to the consumer in its docs/examples, which
  themselves recommend `IntersectionObserver`. Confirms this is the idiomatic approach for
  this library rather than a workaround.
- **Snap-to-page / paginated (one page at a time) viewer mode**: Rejected — spec's Assumptions
  section explicitly keeps the existing continuous-scroll interaction model; switching to a
  paginated viewer would be a much larger UX change than requested and would regress the
  existing "scroll through the whole document" behavior multiple prior features depend on
  (zoom/pan, fullscreen).
- **Deriving current page from scroll-container `scrollTop` divided by average page
  height**: Rejected — inaccurate once zoom changes page heights, and pages can render at
  slightly different heights/aspect ratios (varying source PDF page sizes), so an
  average-height estimate would drift over a long document. `IntersectionObserver` measures
  actual rendered geometry per page, so it stays correct regardless of zoom or page-size
  variance (directly satisfies spec User Story 2 / FR-005).

## Non-decisions confirmed by existing code (no new research needed)

- **Page count source**: Already available via `numPages` state, set from
  `Document`'s `onLoadSuccess={({ numPages }) => ...}` — reused as-is for the indicator's
  total (FR-004).
- **Loading/error/empty state gating**: `SourceDocumentPreview` already branches on
  `documentId === null` (empty state) and `loadError` (unavailable state) before rendering
  the `<Document>` tree; the indicator only needs to render inside the already-successful
  branch, guarded additionally by `numPages > 0`, to satisfy FR-006/FR-007 with no new state
  machine.
- **Document-switch reset**: The existing `useEffect` keyed on `documentId` already resets
  `numPages`, `loadError`, and `scale` on document change; the new "current page" state joins
  that same reset effect to satisfy FR-008.
- **Toolbar placement**: The existing footer toolbar (`border-t` div containing the zoom
  controls and fullscreen toggle) is the natural home for the indicator, consistent with the
  spec's Assumptions section and the component's existing UI pattern.

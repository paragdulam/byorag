# Research: PDF Preview Zoom & Pan

## 1. How to scale the rendered page

**Decision**: Drive `react-pdf`'s `Page` component via its built-in `scale` prop (a plain number,
e.g. `1.5` for 150%), stored in a `scale` React state in `SourceDocumentPreview`.

**Rationale**: `react-pdf`/`pdfjs-dist` already re-renders the page's canvas and text/annotation
layers at the requested scale — this is the library's intended zoom mechanism, gives crisp output
at any zoom level (re-rasterized, not stretched), and needs no new dependency. It's also already
half-anticipated in the existing code: the container has `overflowX: 'auto'` with a comment "Adds
scrollbars if zoomed PDF exceeds screen width."

**Alternatives considered**:
- CSS `transform: scale()` on a wrapper around the existing (unscaled) `Page` — rejected because it
  stretches the already-rasterized canvas, producing blurry text at higher zoom levels, which
  directly undermines the feature's purpose (reading fine print accurately for the golden dataset).
- Re-fetching/re-rendering at a different DPI per zoom step — unnecessary complexity; `pdfjs`'s
  `scale` already re-renders crisply, no manual DPI management needed.

## 2. What "default zoom" means given the current preview

**Decision**: Treat the page's current unscaled render (`scale = 1.0`, i.e. `pdfjs`'s native
72dpi-based page size) as the default/100% baseline and also as the minimum zoom level.

**Rationale**: The current `SourceDocumentPreview` does not compute a responsive "fit container
width" scale — it renders each `Page` with no `width`/`scale` prop, i.e. at native size, centered
in a flex container. The spec's user-facing language ("default fit-to-width view") describes the
curator's experience — "the view you already see today" — not a literal fit-to-container
calculation. Introducing true dynamic fit-to-width sizing (recomputing scale from container width
on every resize) is a larger, separate change with its own edge cases (resize observers, debounce)
that the feature description didn't ask for and isn't needed to satisfy any FR/SC in the spec.
Reusing today's native render as the `1.0`/100%/minimum point keeps this change additive and low
risk.

**Alternatives considered**: Compute an actual fit-to-container-width base scale (via
`ResizeObserver` + container `clientWidth` vs. page's native point width) and treat *that* as
100%/minimum — deferred as an unrelated enhancement; can be layered in later without changing this
feature's `scale`-multiplier design (it would just change what "1.0" maps to).

## 3. Zoom range and step size

**Decision**: `MIN_SCALE = 1.0` (100%, default), `MAX_SCALE = 4.0` (400%), stepping by `+0.25`/`-0.25`
per click, clamped at both ends (buttons/behavior no-op past the limit; FR-007). Reset sets `scale`
back to `1.0` exactly.

**Rationale**: Matches the range documented as a reasonable default in the spec's Assumptions
(fit-to-width minimum, ~400% ceiling for reading fine print). A fixed `0.25` step is a common,
predictable increment used by most PDF/image viewers, and keeps the clamp math in the new
`pdfZoom.ts` helper trivial to unit test (`clampScale`, `zoomIn`, `zoomOut` are pure functions of
the current scale).

**Alternatives considered**: Percentage-of-current (multiplicative) zoom steps — rejected as less
predictable for a curator doing careful, repeatable inspection (the reachable zoom levels would
depend on click history rather than being a fixed, memorizable set).

## 4. Satisfying "pan within page, then advance to next page" (FR-006a) without page-boundary tracking

**Decision**: No special-case logic needed. The preview already stacks every page vertically inside
one `overflow-y-auto` scroll container (`023-pdf-fullscreen-chunk-view`). Scaling a page up via (1)
makes that page's rendered height grow accordingly, which pushes the next page further down in the
stack. Native scrolling (wheel, trackpad, or the pointer-driven pan drag from decision 5) therefore
already scrolls through the *entire* height of the zoomed current page before any part of the next
page comes into view — exactly the clarified behavior — for free, with zero bookkeeping about
"which page is current" or "where its bottom edge is."

**Rationale**: Reusing layout growth instead of hand-rolled page-boundary math avoids an entire
class of off-by-one/edge-case bugs (and matches the plan's general preference for native browser
behavior over custom logic — see decision 5).

**Alternatives considered**: Track a "current page index" and manually intercept scroll to clamp
within it, only releasing to the next page on an explicit action — rejected as significantly more
code and state for a behavior the existing stacked layout already provides passively.

**Implementation note (caught by the T012 e2e test, not the T005 unit test)**: the pre-existing
preview markup split overflow across two nested divs — vertical overflow (`overflow-y-auto`) on
the outer scroll container, horizontal overflow (`overflowX: 'auto'`, the `containerStyle` object)
on the *inner* page-content div one level down. The drag-to-pan handlers (decision 5) read/write
`scrollLeft`/`scrollTop` on the *outer* container, so horizontal panning was silently a no-op — the
outer div had no horizontal scroll region of its own to move. Fixed by moving both axes' overflow
onto the single outer container (`overflow-auto` in `SourceDocumentPreview.tsx`) so one element
unambiguously owns both scroll axes and the pan handlers. This only surfaced against a real browser
(the Vitest/jsdom unit tests stub `scrollLeft`/`scrollTop` directly on the element via
`Object.defineProperty` and so never exercise real CSS overflow/layout) — a good example of why
`T012`/`T013`'s real-browser validation matters even with full unit coverage.

## 5. Drag-to-pan mechanism

**Decision**: Attach Pointer Event handlers (`onPointerDown` / `onPointerMove` / `onPointerUp`) to
the existing scrollable container. On down, capture the pointer and record the starting
`{clientX, clientY, scrollLeft, scrollTop}`. On move (while captured), compute the delta and write
`container.scrollLeft` / `container.scrollTop` **directly via a ref** (not through React state) so
dragging doesn't trigger a re-render per pixel of movement. On up, release the pointer capture.

**Rationale**: The Pointer Events API unifies mouse and touch input in one code path (no separate
`touchstart`/`touchmove` handlers needed), satisfying FR-005's "click-and-drag, touch-drag, or
scroll" with one implementation. Writing `scrollLeft`/`scrollTop` reuses the browser's own overflow
scrolling, so:
- Boundary clamping (FR-006 — "can't drag past the page edge into empty space") is enforced by the
  browser itself, not custom min/max math.
- FR-006a (decision 4) falls out for free, since it's the same scroll container/position space as
  normal scrolling.
- Performance (SC-005) is protected by construction — no React re-render is on the hot path of a
  drag gesture.

**Alternatives considered**: A CSS `transform: translate()`-based custom pan (common for
image/map viewers) with manually computed bounds — rejected: it would fight the container's native
scroll instead of reusing it, require duplicating the clamping logic FR-006 needs, and complicate
how vertical pan interacts with the multi-page stack (decision 4) since translate offsets live
outside the browser's own scroll/layout model.

## 6. Reconciling drag-to-pan with existing text selection (FR-012)

**Decision**: Conditionally set `pointer-events: none` on the page-content wrapper div (the
existing container that wraps `<Document>`/every `<Page>`, identified by
`data-testid="source-preview-page-content"`) whenever `scale > MIN_SCALE`, and `pointer-events:
auto` at `scale === MIN_SCALE` (today's default, unchanged behavior). The drag-to-pan
`onPointerDown`/`onPointerMove`/`onPointerUp` handlers (decision 5) live on the ancestor scroll
container, one level up, so they are unaffected by their descendant's `pointer-events: none` — a
pointer event over a `pointer-events: none` region simply hit-tests through to the nearest
interactive ancestor, which is exactly the scroll container that already owns the pan handlers.

**Rationale**: This achieves the same outcome as targeting `react-pdf`'s internal
`.react-pdf__Page__textLayer` node directly (the text layer is what currently makes click-and-drag
start a text selection — disabling its pointer events lets the drag reach the pan handlers instead)
without depending on `react-pdf`'s internal DOM structure/class names, which the component doesn't
otherwise reach into. It's also substantially easier to unit test: the wrapper's inline style is
directly assertable (`toHaveStyle`) without needing real CSS-cascade support in jsdom, which the
project's Vitest config doesn't enable (`test.css` is unset) and which `react-pdf` itself is mocked
out of in `SourceDocumentPreview.test.tsx` anyway. The one accepted side effect: this also makes
in-document annotation links (if any) unclickable while zoomed, alongside text selection — outside
this feature's scope either way (spec Assumptions: reading/inspection aid only), and not something
FR-012 or any acceptance scenario exercises.

**Alternatives considered**: Require a modifier key (e.g., spacebar) to distinguish "drag to pan"
from "drag to select" — rejected per the `/speckit-clarify` decision (2026-08-01): the simpler
"pan always wins while zoomed" behavior was chosen as the recommended, lower-friction option.

## 7. Scope and reset rules for the `scale` state

**Decision**: `scale` lives in `SourceDocumentPreview`'s own component state (like `numPages` /
`loadError` today). It resets to `MIN_SCALE` in the existing `useEffect(() => { ... }, [documentId])`
that already resets `numPages`/`loadError` on document change (FR-010). It is **not** reset by the
`isFullscreen` prop changing — zooming, then toggling fullscreen, keeps the same zoom level, since
fullscreen is purely a layout-width change on the same document (consistent with how `isFullscreen`
itself is *not* reset by anything other than a `documentId` change, per `DataSourcesScreen.tsx`'s
own comment: "Fullscreen is a transient reading mode... switching documents always drops back to
the normal split").

**Rationale**: Keeps the reset behavior consistent with the one existing precedent in this exact
component (`documentId`-keyed effect), and avoids surprising the curator by silently changing their
zoom level when they only toggled the reading-pane width.

**Alternatives considered**: None strong enough to warrant a `/speckit-clarify` question — this was
flagged as a low-impact "Outstanding" edge case during clarification and resolved here with the
lowest-surprise default.

# Research: Golden Dataset Split-Screen PDF Reference View

No `[NEEDS CLARIFICATION]` markers remain in the Technical Context (all resolved during
`/speckit-specify` and `/speckit-clarify` against the existing codebase). This document records
the investigation behind the plan's technical decisions.

## 1. Root cause of the zoom-changes-panel-width bug

**Decision**: The bug is a classic CSS flexbox `min-width: auto` overflow trap, fixed by adding
`min-width: 0` (Tailwind: `min-w-0`) to every flex container in the chain between the row that
holds the two panes and the PDF preview's own scrollable content area.

**Investigation**: Read `frontend/src/components/sources/SourceDocumentPreview.tsx` and
`frontend/src/components/sources/DataSourcesScreen.tsx` end to end.

- `DataSourcesScreen.tsx`'s pane row is `<div className="mt-6 flex min-h-0 flex-1 gap-6">`, whose
  children are `sources-left-pane` (`w-1/2`) and `sources-right-pane` (`w-1/2` / `w-full` when
  fullscreen). Neither the row nor `sources-right-pane` sets `min-width: 0`.
- Inside `sources-right-pane`, `SourceDocumentPreview` renders `<div className="flex h-full
  min-h-0 flex-1 flex-col">` → `scrollAreaRef` div (`min-h-0 flex-1 overflow-auto`, no explicit
  width) → `page-content` div (`containerStyle`: `display:flex, width:'100%'`) → `<Page
  scale={scale} />`, whose rendered `<canvas>` grows to `basePageWidth * scale` in real pixels.
- By the CSS spec, a flex item's automatic minimum size (`min-width: auto`) is the min-content size
  of its contents unless overridden. None of the containers above override it. So once the `<Page>`
  canvas's intrinsic width exceeds the pane's `w-1/2` allotment, the browser refuses to let
  `sources-right-pane` (and everything above it up to the flex row) shrink below that content size
  — the pane grows instead of the `overflow-auto` scroll area clipping/scrolling it. This is exactly
  the reported symptom: "Zooming too much changes the width of the content div."

**Fix**: Add `min-width: 0` to the flex chain: the pane row, `sources-right-pane`,
`SourceDocumentPreview`'s root `flex-col` div, and `scrollAreaRef`'s div. With `min-width: 0` in
place, each flex item is allowed to shrink to its allotted width regardless of content size, and
`overflow-auto` on the scroll area then does its job — the enlarged `<Page>` canvas scrolls
(pannable, per the existing pointer-drag handlers) within a viewport whose outer width never
changes. No change to `lib/pdfZoom.ts`'s scale math, `MIN_SCALE`/`MAX_SCALE`, or the pointer-based
pan handlers — they already write to `scrollLeft`/`scrollTop`, which only makes sense once the
container is truly a fixed-size scrollable viewport (today it silently no-ops much of the time
because the container itself grows instead of overflowing).

**Alternatives considered**:
- *Cap the `<Page>`'s rendered width with `max-width` / `overflow: hidden` on the page-content div*:
  rejected — this would clip the zoomed content instead of making it pannable, contradicting the
  explicit requirement ("the pdf should be pannable but the content width should not change").
  `min-width: 0` + existing `overflow-auto` achieves panning; a hard clip would not.
  - *Wrap the `<Page>` in a fixed-pixel-width container computed from the pane's measured
  `clientWidth`*: rejected as unnecessary complexity — `min-width: 0` is the standard, minimal fix
  for this well-known flexbox behavior and requires no JS measurement/ResizeObserver.

## 2. Reusing `SourceDocumentPreview` in the Golden Dataset screen

**Decision**: Import and render `SourceDocumentPreview` directly in `GoldenDatasetScreen.tsx`,
exactly as `DataSourcesScreen.tsx` already does, rather than extracting a new shared wrapper
component or duplicating its logic.

**Rationale**: The component's public props (`documentId`, `isFullscreen`, `onToggleFullscreen`)
already express everything the Golden Dataset screen needs. `GoldenDatasetScreen` already computes
`activeDocumentId` and `isEntireCorpus` for its own scope logic (existing code); the preview simply
needs `documentId={isEntireCorpus ? null : activeDocumentId}` (matching the component's own
existing `documentId === null` empty-state branch, which already renders "Select a document to
preview it here" — reusable as the Clarification's confirmed "neutral empty state" for the Entire
Corpus case, no new empty-state UI needed) and new local `isFullscreen` state owned by
`GoldenDatasetScreen`, mirroring `DataSourcesScreen`'s existing pattern.

**Alternatives considered**: Extracting a shared `<DocumentPreviewPane>` wrapper around
`SourceDocumentPreview` — rejected as unnecessary; both screens already call the same component the
same way (props in, no screen-specific behavior baked into the component itself), so there's
nothing to extract yet. Revisit only if a third call site emerges.

## 3. Two-pane layout pattern

**Decision**: Mirror `DataSourcesScreen.tsx`'s existing pane-row structure: a flex row
(`flex min-h-0 flex-1 gap-6`, plus `min-w-0` per Research #1) containing a left pane
(`w-1/2 min-w-0 flex flex-col overflow-y-auto`) and a right pane (`w-1/2 min-w-0 ...` wrapping
`SourceDocumentPreview`), with no fullscreen toggle affecting the left pane's visibility the way
Sources currently hides its upload/list pane in fullscreen — Golden Dataset's left half (the entry
list, editor, etc.) is unrelated content, not a picker for the thing being fullscreened, so FR-012
already specifies fullscreen expands the preview *over* the left half rather than the two screens
needing identical fullscreen-hides-pane logic.

**Rationale**: Reusing an already-proven, already-tested layout convention from the same codebase
keeps this feature's diff small and consistent, rather than inventing a new split-pane pattern.

**Alternatives considered**: CSS Grid two-column layout — rejected; the existing codebase already
has a working flex-based two-pane convention (`DataSourcesScreen.tsx`) and there's no requirement
(resizable divider, unequal default split, etc.) that would benefit from Grid over flex.

## 4. Control-row placement

**Decision**: Move the existing `flex gap-2` div (Write Manually / Generate with LLM / batch count
/ Generate a Batch — `GoldenDatasetScreen.tsx` lines 143–180 today) to sit directly below the scope
dropdown, inside the new left pane, unchanged internally (same buttons, same order, same
disabled/loading logic) — only its position in the surrounding layout moves (out of the current
`flex items-end justify-between` row that puts it beside the dropdown, into its own row below it,
per FR-008/FR-009).

**Rationale**: The spec's ordering requirement (dropdown, then a horizontal row of the four
controls below it) is purely a layout move — none of the four controls' existing behavior,
API calls, or state needs to change.

## 5. Testing approach for the width-stability requirement (FR-005/SC-002)

**Decision**: Cover pane-structure/control-order/content-confinement (FR-001, FR-003, FR-008–010)
with Vitest + Testing Library (DOM structure and class assertions — sufficient since jsdom doesn't
lay out real pixel widths). Cover the actual zoom-width-stability guarantee (FR-005, FR-006,
SC-002) with Playwright e2e tests that read `getBoundingClientRect().width` on the preview pane
before and after zooming to max, on both the Sources screen and the Golden Dataset screen, and
assert the values are equal — this is the only test level in this codebase that renders real CSS
layout, matching Constitution Principle II's requirement that behavior be tested "at the
appropriate level(s)."

**Alternatives considered**: Asserting only the presence of the `min-w-0` class in unit tests —
rejected as insufficient on its own; a class-name assertion doesn't prove the bug is actually
fixed (a typo'd or misapplied class would still pass), so an e2e pixel-width assertion is required
alongside it, not instead of it.

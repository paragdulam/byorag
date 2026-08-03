# Data Model: PDF Preview Page Indicator

This feature adds no persisted entities, database tables, or API payloads — it is
client-side UI state layered onto the existing `SourceDocumentPreview` component. This
document captures the (in-memory, component-local) shape of that state for implementation
reference.

## Page Position (component state, not persisted)

Represents what the indicator displays at any moment. Lives entirely inside
`SourceDocumentPreview`'s React state — not stored, not sent to the backend, not part of any
API contract.

| Field | Type | Derivation | Notes |
|-------|------|------------|-------|
| `currentPage` | `number \| null` | Highest-`intersectionRatio` entry from the page-wrapper `IntersectionObserver` (see [research.md](./research.md)) | `null` before the observer has reported an initial visible page (e.g., mid-load); indicator does not render while `null` |
| `numPages` | `number` | Already-existing state, set via `Document`'s `onLoadSuccess` | Unchanged from current implementation; reused as the indicator's "total" |

**Validity / display rule**: The indicator renders only when `loadError === false`,
`documentId !== null`, and `numPages > 0` — i.e., exactly the branch that already renders
`<Document>`/`<Page>` successfully. This directly satisfies spec FR-006 (hidden during
loading/error) and FR-007 (hidden when no document selected) without a separate state
machine.

**Reset rule**: `currentPage` resets (to `null`, recalculated once the observer reports the
first visible page of the newly-loaded document) in the same `useEffect` that already resets
`numPages`, `loadError`, and `scale` on `documentId` change — satisfying FR-008.

**Relationships**: `currentPage` is derived from, and always ≤, `numPages`. Neither value is
referenced outside this component; `GoldenDatasetScreen` and the Data Sources screen consume
`SourceDocumentPreview` as an opaque UI unit and have no need to read or pass this state
themselves (per spec FR-002, the indicator "just works" wherever the component is mounted).

## Helper: page-visibility computation (`frontend/src/lib/pdfPageVisibility.ts`)

A small pure function, not a persisted entity, extracted so the "which page is most visible"
logic is unit-testable without mounting `IntersectionObserver`/DOM machinery:

```ts
// Shape only — not the actual implementation.
interface PageVisibilityEntry {
  pageNumber: number
  intersectionRatio: number
}

function mostVisiblePage(entries: PageVisibilityEntry[]): number | null
```

Takes the current set of observed page-wrapper visibility ratios and returns the page number
with the highest ratio, or `null` if given an empty list (e.g., no pages currently
intersecting the viewport, which unit tests can exercise directly without a browser DOM).

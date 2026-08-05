# Data Model: Golden Dataset Entry List Scoping & Read-Only Answer View

No new persisted entities, database columns, or API payload shapes — this feature only
changes which already-fetched `GoldenEntry`/`GoldenEntrySummary` records are displayed and how
one is viewed. Both types already exist in `frontend/src/types/goldenDataset.ts` and are
reused unchanged.

## Existing types reused (unchanged)

| Type | Used for | Relevant fields for this feature |
|------|----------|-----------------------------------|
| `GoldenEntrySummary` | The main list (`GoldenEntryList`) | `id`, `documentId` (drives the US1 scope filter), `question`, `status` (drives the US2 "approved only" click gate), `source` |
| `GoldenEntry` | The read-only detail view (`GoldenEntryDetail`), fetched via `getEntry(id)` on click | `question`, `preferredAnswer` (the field never shown anywhere in this list until now), `chunks` (optional to display per research.md) |

## New client-side (component) state

Not persisted; lives in React component state only.

### `GoldenDatasetScreen` (existing component, one new derived value)

| Value | Type | Derivation |
|-------|------|------------|
| `scopedEntries` | `GoldenEntrySummary[]` | `isEntireCorpus ? entries : entries.filter(e => e.documentId === activeDocumentId)` — the US1 fix. Passed to `GoldenEntryList` instead of the raw `entries` array. |

**Validity rule**: When `isEntireCorpus` is true, every entry belonging to the active corpus
is included regardless of `documentId` (including `null` for corpus-scoped entries with no
single owning document, if any exist). When a specific document is selected, only entries
whose `documentId` exactly matches the selected document's id are included.

### `GoldenEntryList` (new component)

| Value | Type | Notes |
|-------|------|-------|
| `expandedEntryIds` | `Set<string>` | Which rows are currently expanded; a row's presence in the set means its `GoldenEntryDetail` is rendered beneath it. Independent per row (research.md's expand-in-place decision) — not a single "open entry" slot. |
| `loadedEntries` | `Map<string, GoldenEntry>` | Cache of full entries already fetched via `getEntry(id)`, keyed by entry id, so re-expanding a previously-viewed row doesn't refetch. Cleared (or entry removed) when that entry is deleted. |

**Transitions**:
- Click an approved row's question, not currently expanded → `getEntry(id)` fires (if not
  already cached) → id added to `expandedEntryIds` → `GoldenEntryDetail` renders inline.
- Click an approved row's question, currently expanded → id removed from `expandedEntryIds`
  (collapse; no refetch).
- Click a pending-review or rejected row's question → no state change (FR-007).
- Delete a row whose id is in `expandedEntryIds` → id removed from both `expandedEntryIds` and
  `loadedEntries` as part of the same delete handling that already removes it from the list
  (FR-009).

## Relationships

- `scopedEntries` (computed in `GoldenDatasetScreen`) is a strict subset of `entries`, filtered
  by the currently selected scope — no entry's own `corpusId`/`documentId` is ever changed by
  this feature, only which of the already-owned entries are shown.
- `GoldenEntryList`'s `loadedEntries` values are always fetched-and-cached copies of entries
  already present (by id) in `scopedEntries`; there is no independent lifecycle for a "detail"
  record separate from the summary it was expanded from.

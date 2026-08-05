# Research: Golden Dataset Entry List Scoping & Read-Only Answer View

No `NEEDS CLARIFICATION` items remain from the spec or the plan's Technical Context. This
document records the concrete findings from the existing codebase that shaped the plan, plus
the two real design decisions made.

## Finding: the scope-filtering bug is a pure frontend gap, not a missing backend capability

**Investigated**: `backend/app/golden_dataset/router.py`'s `GET /entries` handler and
`backend/app/golden_dataset/schemas.py`.

**Finding**: `list_entries(corpusId, status=[], source=[])` has no `documentId` query
parameter — but the `EntryListResponse` schema's per-entry summary already includes
`documentId` (confirmed in `schemas.py`, and mirrored in the frontend's
`GoldenEntrySummary.documentId` type). `frontend/src/components/golden-dataset/
GoldenDatasetScreen.tsx`'s `refreshEntries()` calls `listEntries(activeCorpusId)` and renders
the full result set directly — it never reads `selectedDocumentId`/`activeDocumentId` at all
when deciding what to display. This is why the spec's User Story 1 bug report ("the list
never changes with the dropdown") reproduces exactly as described.

**Decision**: Fix client-side. Filter the already-fetched `entries` array by
`entry.documentId === activeDocumentId` when a specific document is selected, and pass the
full array through unfiltered when "Entire Corpus" is selected. No backend endpoint, query
parameter, or schema change needed.

**Rationale**: The data needed to filter correctly is already being returned on every
request; adding a server-side filter parameter would be redundant network-protocol surface
for a computation that's O(n) over an already-small, already-in-memory list (entries scoped
to one corpus). Simpler, no contract change, no new test surface on the backend.

**Alternatives considered**:
- **Add a `documentId` query param to `GET /entries` and filter server-side**: Rejected —
  strictly more code (new query param, new service-layer filter logic, new backend contract
  tests) for identical user-visible behavior, since the summary already carries `documentId`
  and the list is already small. Would only be justified if entry lists could grow large
  enough that server-side filtering mattered for payload size — no such requirement exists
  today (this project's constitution's YAGNI-aligned principles argue against pre-building
  that).

## Decision: the read-only view is a new, separate component — not a reused/disabled `GoldenEntryEditor`

**Decision**: Build `GoldenEntryDetail`, a small presentational component that takes an
already-fetched `GoldenEntry` and renders its question and full `preferredAnswer` as plain
text, with a close/collapse control and no `<input>`/`<textarea>`/save button anywhere in its
render output.

**Rationale**: `GoldenEntryEditor` (`frontend/src/components/golden-dataset/
GoldenEntryEditor.tsx`) is a large, stateful form component — question/answer text inputs,
chunk-selection UI, draft-answer and save/approve/reject actions. Threading a `readOnly` prop
through all of that to satisfy FR-006 ("MUST NOT present any editable field or save/submit
control") would mean the "no editing" guarantee depends on every conditional inside that
component being correct and staying correct as it evolves — a single missed `disabled={...}`
on a future edit to that shared component could silently reintroduce an editable field into
what's supposed to be a locked, approved reference entry. A separate component makes "there is
no edit path here" true by construction (the JSX simply never renders a form control), not by
a runtime flag.

**Alternatives considered**:
- **`GoldenEntryEditor` + `readOnly` prop**: Rejected for the reason above — correctness would
  depend on remembering to gate every editable element behind the prop, in a component that
  already has several conditional render branches (draft state, save state, approve/reject
  state for pending review).
- **Reuse via a shared "read-only renderer" sub-component inside `GoldenEntryEditor`, extracted
  and reused by both**: Considered but adds an extra layer of indirection for a component this
  small (question + answer + optional evidence). Not justified by the current scope; can
  revisit if a third consumer of "render an entry's Q&A" appears later.

## Decision: expand-in-place per row, not a modal or "swap the whole list" pattern

**Decision**: Each approved row in the list can be expanded independently (accordion-style) to
show its `GoldenEntryDetail` inline, directly beneath that row. Clicking an already-open row's
question collapses it again. Multiple rows may be expanded at once.

**Rationale**: `GoldenReviewQueue` swaps its *entire* list for the single open entry's editor
(`openEntry !== null` short-circuits the whole render) — appropriate there because reviewing
is inherently a one-at-a-time, resolve-and-move-on workflow (approve/reject navigates you back
to the queue). Browsing approved answers is different: a user plausibly wants to glance at two
or three answers in sequence, or compare one against another, without losing their place in
the list. Per-row expand-in-place keeps the list visible throughout and matches the spec's
Acceptance Scenario 3 (clicking a second entry's question must show that entry's own answer,
not replace/lose the first) most naturally — expand-in-place trivially satisfies this since
each row's expanded state is independent, whereas a single-slot "currently open entry" state
would require deciding whether opening a second entry closes the first (extra behavior not
requested).

**Alternatives considered**:
- **Modal/dialog per entry**: Rejected — heavier interaction pattern than needed for read-only
  text, and this screen already uses a two-pane layout (list + PDF preview) that a modal would
  sit awkwardly on top of.
- **Single "open entry" slot, like `GoldenReviewQueue`**: Rejected per the rationale above —
  works for a resolve-one-at-a-time queue, less natural for browsing/comparing already-settled
  entries.

## Non-decisions confirmed by existing code (no new research needed)

- **Fetching the full entry**: `getEntry(entryId)` already exists in
  `frontend/src/lib/goldenDatasetApi.ts` and is already used by `GoldenReviewQueue` for the
  identical "fetch full entry when a row is clicked" need — reused as-is (FR-005).
- **Delete stays as-is**: `handleDelete`/`deleteEntry` in `GoldenDatasetScreen.tsx` needs no
  changes; `GoldenEntryList` simply keeps rendering the same Delete button per row and, per
  FR-009, closes that row's expanded detail (if open) when its entry is deleted — a local
  state update in `GoldenEntryList`, not a new API concern.
- **Non-approved rows**: Pending-review entries already have a separate, fully-editable path
  via `GoldenReviewQueue` (rendered above the main list today) and are excluded from this
  list's click-to-view behavior by simply checking `entry.status === 'approved'` before
  calling `getEntry` (FR-007) — no new state machine needed.

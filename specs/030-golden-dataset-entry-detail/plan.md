# Implementation Plan: Golden Dataset Entry List Scoping & Read-Only Answer View

**Branch**: `030-golden-dataset-entry-detail` | **Date**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/030-golden-dataset-entry-detail/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Two related fixes to the Golden Dataset screen's main entry list (`GoldenDatasetScreen.tsx`):
(1) the list currently ignores the scope dropdown entirely — `refreshEntries()` always fetches
every entry for the active corpus with no document filter, even though each returned entry
already carries its own `documentId`. Fixing this is a pure client-side filter, no backend
change needed. (2) Clicking an **approved** entry's question currently does nothing — the list
only shows the question text, never the answer, and has no click behavior at all. This adds a
new read-only detail view (question + full preferred answer), fetched via the already-existing
`getEntry(id)` endpoint and rendered by a new presentational component with zero editable
fields or save controls — deliberately not reusing `GoldenEntryEditor` (a full editable form),
to make "impossible to edit from here" structurally guaranteed rather than merely
disabled-by-prop. Delete stays exactly as it is today.

## Technical Context

**Language/Version**: TypeScript 5 / React 19 (existing `frontend/` app, Vite build)

**Primary Dependencies**: None new. Reuses `getEntry` from the existing
`frontend/src/lib/goldenDatasetApi.ts` client (already used by `GoldenReviewQueue` for the
same "fetch full entry on click" pattern) and the existing `GoldenEntrySummary.documentId`
field already returned by `GET /api/golden-dataset/entries` (confirmed via
`backend/app/golden_dataset/schemas.py` and `router.py` — the summary already carries
`documentId` per entry; the backend just isn't being filtered by it client-side today).

**Storage**: N/A — no schema or persisted-data change; this is a display/interaction fix over
data that already exists and is already fetched.

**Testing**: Vitest (`frontend/tests/unit`, `frontend/tests/integration`) and Playwright
(`frontend/tests/e2e`), matching the existing suites for `GoldenDatasetScreen`,
`GoldenReviewQueue`, and `GoldenEntryEditor`.

**Target Platform**: Web (existing React SPA), same browser support envelope as the rest of
the frontend.

**Project Type**: Web application (existing `frontend/` + `backend/` structure) — this
feature is frontend-only; no backend route, schema, or contract changes.

**Performance Goals**: N/A beyond existing expectations — filtering an already-fetched,
already-small (per-corpus) entries array client-side is O(n) over a list that's already
rendered in full; no new network calls are added by the scope fix. The read-only view adds
exactly one `getEntry` call per click, the same cost `GoldenReviewQueue` already pays per
review.

**Constraints**: Must not alter `GoldenEntryEditor` (used elsewhere for manual creation and
pending-review editing) — the new read-only view is a separate, additive component so
FR-006's "no editable field, no save control" is structurally guaranteed, not just a prop
toggle that could regress. Must not change `DELETE /api/golden-dataset/entries/{id}` or its
existing frontend call.

**Scale/Scope**: One screen (`GoldenDatasetScreen.tsx`), two new small frontend components,
no backend changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: N/A — no ingestion/chunking/embedding/retrieval/
  generation pipeline stage is touched; this is a display/interaction fix on already-stored
  golden dataset entries. PASS.
- **II. Test-First, Test at Every Level**: Plan includes unit coverage for the new read-only
  detail component and the extracted list component (click/expand/collapse/scope-filter
  behavior), an integration-level update to `GoldenDatasetScreen`'s existing test suite for
  the scope-filtering fix, and e2e coverage extending `golden-dataset.spec.ts`. PASS (see
  tasks.md for the test-first breakdown).
- **III. Multi-User Simplicity**: N/A — no change to corpus/document/entry ownership or
  access control; entries are already scoped to the requesting user's own corpora via
  existing auth. PASS.
- **IV. Fixed Technology Stack**: No new dependency, no backend/database/vector-store change;
  stays within the existing React frontend calling an existing backend endpoint. PASS.
- **V. Experiment Observability & Reproducibility**: N/A — golden dataset entries' recorded
  configuration/traceability is unchanged; this only affects which already-recorded entries
  are displayed and how one is viewed. PASS.

No violations — Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/030-golden-dataset-entry-detail/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command) — N/A, no API/contract change
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   └── golden-dataset/
│   │       ├── GoldenDatasetScreen.tsx     # US1: apply scope filter before rendering the
│   │       │                               #   entry list; renders GoldenEntryList instead of
│   │       │                               #   its own inline <ul>/<li> block
│   │       ├── GoldenEntryList.tsx         # new: extracted list (mirrors GoldenReviewQueue's
│   │       │                               #   self-contained fetch-on-click pattern) —
│   │       │                               #   renders rows, owns per-row expand/collapse
│   │       │                               #   state, calls getEntry() only for approved rows
│   │       ├── GoldenEntryDetail.tsx       # new: pure read-only display — question + full
│   │       │                               #   preferred answer, no form elements, no save
│   │       │                               #   control (FR-006)
│   │       ├── GoldenReviewQueue.tsx       # unchanged — reference pattern for fetch-on-click
│   │       └── GoldenEntryEditor.tsx       # unchanged — NOT reused for the read-only view
│   └── lib/
│       └── goldenDatasetApi.ts             # unchanged — getEntry() and the summary's
│                                            #   documentId field already exist
└── tests/
    ├── unit/
    │   ├── GoldenEntryList.test.tsx        # new
    │   └── GoldenEntryDetail.test.tsx      # new
    ├── integration/
    │   └── GoldenDatasetScreen.test.tsx    # extended: scope-filter behavior (US1)
    └── e2e/
        └── golden-dataset.spec.ts          # extended: scope filter + read-only answer view

backend/    # untouched — GET /entries already returns documentId per entry; GET /entries/{id}
            # (getEntry) and DELETE already exist and are reused as-is; no contract change
```

**Structure Decision**: Existing web application layout (`frontend/` + `backend/`). This
feature only touches the `frontend/` tree, specifically the `golden-dataset` component
directory: `GoldenDatasetScreen.tsx` gets the scope-filter fix and delegates its list
rendering to a new `GoldenEntryList` component, which in turn renders the new read-only
`GoldenEntryDetail` component when an approved row is expanded. `GoldenReviewQueue.tsx` and
`GoldenEntryEditor.tsx` are referenced as the established pattern to follow (fetch-on-click via
`getEntry`) but are not modified — the read-only view is intentionally a separate component
tree from the editable one, per FR-006.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A — no Constitution Check violations.

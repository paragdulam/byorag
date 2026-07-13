# Implementation Plan: Delete Source Documents

**Branch**: `004-delete-source-documents` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-delete-source-documents/spec.md`

## Summary

Add the ability to permanently delete one or more PDFs from the corpus via the Data Sources
screen's Document List. A single new backend endpoint, `POST /api/sources/delete`, accepts a list
of document ids (filenames) and reports a per-id outcome — a file that's already gone from disk is
reported as a success (FR-006), a real filesystem error is reported as a failure with a reason
(FR-005) — so the same endpoint and the same frontend code path serve both the single-row delete
(User Story 1) and the multi-select bulk delete (User Story 2). Deletion is confirmed via the
browser's native `confirm()` (no existing dialog component in this codebase) and is only offered
for documents with a server-confirmed `status: 'processed'` identity, never for in-flight upload
placeholders (FR-007).

## Technical Context

**Language/Version**: Backend: Python 3.12 (unchanged). Frontend: TypeScript 5.x on React 19,
Node.js 20 LTS (unchanged).

**Primary Dependencies**: No new dependencies on either side — this feature extends the existing
`app.sources` module (FastAPI) and the existing `sourcesApi.ts` / `useSourceDocuments.ts` /
`DocumentList.tsx` frontend trio with new functions/props, following the same patterns 002 already
established.

**Storage**: Local filesystem — the same `PDFS_DIR` directory from 002. Deletion is an `unlink()`
of the target file; no database, no soft-delete/trash storage (spec Assumptions).

**Testing**: Backend: pytest + FastAPI `TestClient` (contract test for `POST /api/sources/delete`;
unit tests for `delete_documents()` covering successful delete, already-absent-treated-as-success,
a genuine OS error, and path-traversal-id rejection). Frontend: Vitest + React Testing Library
(hook tests for `deleteDocuments` success/partial-failure; component tests for the row delete
button's confirm-then-call flow and the multi-select bulk delete flow), Playwright (e2e: upload,
delete, reload, confirm it's gone) — required by constitution Principle II.

**Target Platform**: Backend: Linux server container (Docker) or local process (unchanged).
Frontend: desktop web browsers (unchanged).

**Project Type**: Web application — extends the existing `backend/app/sources/` module and
`frontend/src/components/sources/DocumentList.tsx` from 001/002; no new top-level project or
module.

**Performance Goals**: A delete request (single or bulk) completes and the list reflects the new
state within 2 seconds for typical corpus sizes (dozens of documents, per 002's established
scale), matching the responsiveness already established for upload (002 SC carried forward).

**Constraints**: Deletion MUST be confirmed before it takes effect (FR-002); an already-absent
target file MUST be reported as success, never as an error (FR-006); a genuine failure MUST leave
the document in the list with a specific error shown (FR-005); one failing id in a bulk request
MUST NOT block or roll back the others (FR-009); a client-supplied id MUST be validated to stay
within `PDFS_DIR` before any filesystem operation is attempted (research.md §3).

**Scale/Scope**: Single local user, one new endpoint, no new entities beyond a transient
per-response `DeletionResult` (not persisted) — consistent with constitution Principle III.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Pluggable RAG Architecture | N/A | This feature only removes raw source files from disk; it introduces no ingestion/chunking/embedding/retrieval logic and defines no strategy interface. |
| II. Test-First, Test at Every Level | Pass (enforced in tasks) | Backend contract test (`POST /api/sources/delete`), unit tests (delete success, already-absent, OS error, path-traversal rejection), frontend hook/component tests (single delete confirm flow, bulk delete partial-failure flow), and a Playwright e2e delete-then-reload scenario. All required in `tasks.md` before implementation is considered done. |
| III. Single-User Simplicity (YAGNI) | Pass | One endpoint serves both single and bulk delete (research.md §1); no trash/undo/soft-delete infrastructure (spec Assumptions); confirmation uses the browser's native `confirm()` rather than introducing a modal component the codebase doesn't otherwise have (research.md §4). |
| IV. Fixed Technology Stack | Pass | No new dependencies, frameworks, or stack changes on either side — pure extension of the existing FastAPI `sources` module and React component/hook trio. |
| V. Experiment Observability & Reproducibility | N/A | No experiment-tracking pipeline exists yet (spec Assumptions); deleting a source document has no experiment configuration to reconcile. |

No unjustified violations. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-delete-source-documents/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   └── sources/
│       ├── router.py            # Updated: adds POST /api/sources/delete
│       ├── service.py           # Updated: adds delete_documents() + path-safety check
│       └── schemas.py           # Updated: adds DeletionResult, DeleteSourcesRequest/Response
├── tests/
│   ├── contract/
│   │   └── test_delete_sources.py      # Response shape, always-200, per-id outcomes
│   └── unit/
│       └── test_service_deletion.py    # Success, already-absent, OS error, path-traversal id
└── (no dependency changes)

frontend/
├── src/
│   ├── types/
│   │   └── sourceDocument.ts    # Updated: adds DeletionResult type
│   ├── lib/
│   │   └── sourcesApi.ts        # Updated: adds deleteSources(ids)
│   ├── hooks/
│   │   └── useSourceDocuments.ts # Updated: adds deleteDocuments(ids) + deletionErrors state
│   └── components/sources/
│       └── DocumentList.tsx     # Updated: per-row delete button + checkbox multi-select + "Delete Selected"
└── tests/
    ├── unit/
    │   ├── useSourceDocuments.test.ts  # Updated: deleteDocuments success/partial-failure
    │   └── DocumentList.test.tsx       # New: row delete confirm flow, multi-select bulk delete
    ├── integration/
    │   └── DataSourcesScreen.test.tsx  # Updated: delete removes a row end-to-end (mocked API)
    └── e2e/
        └── data-sources-screen.spec.ts # Updated: upload → delete → reload → confirm gone
```

**Structure Decision**: Extends the existing `backend/app/sources/` module (no new module,
following the `router.py`/`service.py`/`schemas.py` split already in place) and the existing
`frontend` sources component/hook/lib trio from 001/002 — no new top-level project, no new
frontend module, no new dependencies on either side.

## Complexity Tracking

*No violations to justify — table intentionally omitted.*

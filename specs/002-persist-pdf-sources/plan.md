# Implementation Plan: Persist Uploaded PDFs to Filesystem

**Branch**: `002-persist-pdf-sources` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-persist-pdf-sources/spec.md`

## Summary

Replace the browser-session-only document list from `001-data-sources-screen`
with real filesystem persistence. This feature introduces the project's
first backend: a small Python API that validates uploads (PDF only, ≤50MB),
saves accepted files to a `pdfs` directory on the server's filesystem
(resolving same-name collisions by suffixing rather than overwriting), and
lists the documents currently present in that directory. The frontend's
`useSourceDocuments` hook is switched from local-only state to calling this
API on mount (to populate the list) and on upload (to persist + refresh),
so the document list survives page reloads, tab closes, and even backend
restarts — as long as the `pdfs` directory itself persists (a mounted Docker
volume in containerized runs).

## Technical Context

**Language/Version**: Backend: Python 3.12 (matches root `.python-version`
and `pyproject.toml`). Frontend: TypeScript 5.x on React 18, Node.js 20 LTS
(unchanged from 001).

**Primary Dependencies**: Backend: FastAPI + Uvicorn (async multipart file
upload, automatic OpenAPI schema generation for the contract in
`contracts/`), `python-multipart` for form/file parsing. Frontend: unchanged
(React 18, Vite, Tailwind CSS); adds a small `fetch`-based API client, no new
UI libraries.

**Storage**: Local filesystem — a `pdfs/` directory owned by the backend
process. Location is configurable via a `PDFS_DIR` environment variable
(default `./pdfs` relative to the backend's working directory locally; a
named Docker volume mounted at `/data/pdfs` in containerized runs) so the
directory — and therefore the document list — survives container restarts,
not just browser refreshes. No database is introduced; document metadata
(name, size, upload time) is derived entirely from filesystem stat calls.

**Testing**: Backend: pytest + FastAPI `TestClient` (contract tests for the
two endpoints, unit tests for filename-collision resolution and
directory-listing logic, integration tests for save→list round trips against
a temporary directory). Frontend: Vitest + React Testing Library (hook/
component tests with a mocked `fetch`), Playwright (end-to-end: upload a PDF,
reload the page, confirm it is still listed) — required by constitution
Principle II.

**Target Platform**: Backend: Linux server container (Docker). Frontend:
desktop web browsers, served from a containerized static build (unchanged
from 001).

**Project Type**: Web application — this feature adds the `backend/` project
(first backend code in the repo) alongside the existing `frontend/` project,
and wires both into `docker-compose` per the constitution's Fixed Technology
Stack principle (Qdrant is still not introduced — no vector work is in scope
for this feature).

**Performance Goals**: Uploaded file is saved and appears in the list in
under 2 seconds for files up to the 50MB limit (matches SC-001 of 001,
carried forward); the reload-populated list appears without a full-page
spinner delay perceptible to the user for typical (single-digit) document
counts.

**Constraints**: Same validation constraints as 001 (PDF only, ≤50MB),
now enforced server-side before any disk write (FR-003); collisions on
same-named files must never overwrite an existing file (FR-004); a failed
save must never leave a partial file on disk or a phantom entry in the list
(FR-009).

**Scale/Scope**: Single local user, single shared `pdfs` directory (no
per-user/per-session partitioning, consistent with constitution Principle
III). Expected document counts are small (dozens, not thousands) for an
experimentation tool, so a plain directory listing on each `GET` is
sufficient — no pagination or indexing required.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Pluggable RAG Architecture | N/A / Pass | This feature only adds source **storage** (raw PDFs on disk); it introduces no ingestion/chunking/embedding/retrieval logic and defines no strategy interface, so it neither satisfies nor blocks future pluggability requirements. |
| II. Test-First, Test at Every Level | Pass (enforced in tasks) | Backend contract tests (`POST /api/sources`, `GET /api/sources`), unit tests (collision-safe naming, directory listing → document mapping), and integration tests (save→list round trip) are required, plus updated frontend hook/component tests and one Playwright e2e test for the reload-persists journey. All required in `tasks.md` before implementation is considered done. |
| III. Single-User Simplicity (YAGNI) | Pass | No auth, no multi-tenant partitioning, no database — metadata is derived from the filesystem itself. Two endpoints only; no delete/update API since spec explicitly keeps delete out of scope. |
| IV. Fixed Technology Stack | Pass | Introduces the mandated Python backend and local-filesystem PDF storage for the first time, and extends `docker-compose` to run frontend + backend together (Qdrant remains un-added since no vector work is in this feature's scope — not a stack violation, simply not yet needed). |
| V. Experiment Observability & Reproducibility | N/A | No experiment runs are recorded by this feature; it lays the source-storage groundwork that later experiment-tracking features will build on and trace back to. |

No unjustified violations. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-persist-pdf-sources/
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
│   ├── main.py                  # FastAPI app instance, CORS config, router mounting
│   ├── config.py                # Settings (PDFS_DIR env var + default)
│   └── sources/
│       ├── router.py            # POST /api/sources, GET /api/sources
│       ├── service.py           # validate, save-with-collision-suffix, list-from-disk
│       └── schemas.py           # SourceDocument, UploadRejection Pydantic models
├── tests/
│   ├── contract/                # Request/response shape tests for both endpoints
│   ├── integration/             # Save→list round trip against a temp PDFS_DIR
│   └── unit/                    # Collision-suffix logic, size/type validation, stat→model mapping
├── pyproject.toml               # Backend dependencies (FastAPI, uvicorn, python-multipart, pytest, httpx)
└── Dockerfile

frontend/
├── src/
│   ├── lib/
│   │   └── sourcesApi.ts        # fetch wrapper: listSources(), uploadSources(files)
│   ├── hooks/
│   │   └── useSourceDocuments.ts # Updated: loads from API on mount, uploads via API, no local simulation
│   └── ... (existing components/types/lib from 001, unchanged)
└── tests/
    ├── integration/UploadDropzone.test.tsx   # Updated to mock the API instead of pure local state
    └── e2e/data-sources-screen.spec.ts       # Updated: adds reload-persists scenario

docker-compose.yml                # New: frontend + backend services; backend mounts a named
                                   # volume at /data/pdfs so uploads survive container restarts
pdfs/                              # Default local (non-Docker) storage directory; gitignored
```

**Structure Decision**: Web application with two sibling projects,
`backend/` (new) and `frontend/` (existing, from 001). The backend is a
single small FastAPI service — one `sources` module is sufficient at this
scope (two endpoints, no other resources), consistent with Principle III
(YAGNI); it is structured so a later feature can add sibling modules
(`ingestion/`, `retrieval/`, etc.) without restructuring this one.
`docker-compose.yml` is introduced at the repo root to run both services
together, per constitution Principle IV.

## Complexity Tracking

*No violations to justify — table intentionally omitted.*

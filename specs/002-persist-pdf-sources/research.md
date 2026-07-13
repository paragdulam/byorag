# Phase 0 Research: Persist Uploaded PDFs to Filesystem

All unknowns from the Technical Context have been resolved below; no
`NEEDS CLARIFICATION` markers remain.

## 1. Backend web framework

**Decision**: FastAPI (with Uvicorn as the ASGI server and `python-multipart`
for file parsing).

**Rationale**: Constitution Principle IV only fixes the language (Python),
not the framework. FastAPI gives native `UploadFile`/multipart support,
Pydantic-based request/response models that map directly onto this
feature's `SourceDocument`/`UploadRejection` entities, automatic OpenAPI
schema generation (used as the machine-checkable contract in
`contracts/`), and a first-class `TestClient` for the contract/integration
tests required by Principle II. It is also a natural fit for the async I/O
this backend will eventually need once real ingestion/embedding calls
(Principle I) are added.

**Alternatives considered**:
- **Flask**: Simpler, but multipart handling and typed request/response
  validation require extra libraries (Marshmallow/Flask-RESTX), and async
  support is bolted-on rather than native — more boilerplate for the same
  outcome.
- **Django (+ DRF)**: Far more machinery (ORM, admin, migrations) than a
  two-endpoint, no-database service needs; violates Principle III (YAGNI).

## 2. Storage location & Docker persistence

**Decision**: A single `pdfs/` directory, path resolved from a `PDFS_DIR`
environment variable with a local default of `./pdfs` (relative to the
backend process's working directory). In `docker-compose.yml`, the backend
service mounts a **named Docker volume** at `/data/pdfs` and sets
`PDFS_DIR=/data/pdfs`, so the directory (and therefore every uploaded PDF)
survives container restarts/recreation, not just browser refreshes.

**Rationale**: The spec's core requirement is that PDFs "stay" — that
guarantee is only real if the storage location outlives the backend
process, which a container's own writable layer does not. A named volume is
the standard Docker pattern for exactly this durability requirement and
requires no extra infrastructure (matches Principle III).

**Alternatives considered**:
- **Store inside the container's filesystem with no volume**: Rejected —
  `docker compose down`/image rebuilds would silently wipe all uploaded
  PDFs, reintroducing the exact problem this feature exists to fix.
- **Store under `frontend/public/`**: Rejected — the frontend is a static
  build served by its own container/CDN; it has no server-side write
  capability and mixes source data into build artifacts.
- **Cloud object storage (S3-compatible)**: Rejected — out of scope per
  constitution ("no cloud object storage required at this stage") and
  Principle III; local filesystem is explicitly the mandated storage for
  this stage.

## 3. Filename collision handling

**Decision**: When saving a file whose name already exists in `PDFS_DIR`,
append a counting suffix before the extension — `report.pdf` →
`report (1).pdf` → `report (2).pdf` — incrementing until a free name is
found, then save under that name. The API returns the actual on-disk name
in its response so the frontend list shows the disambiguated name.

**Rationale**: Matches FR-004 and User Story 3 exactly (never overwrite),
mirrors the collision behavior users already expect from OS file managers
and browser downloads (Finder, Windows Explorer, Chrome's download manager),
and needs no extra metadata store — the filesystem itself is the source of
truth for "does this name already exist."

**Alternatives considered**:
- **Overwrite existing file**: Rejected — explicitly disallowed by FR-004;
  would silently destroy a previously uploaded source.
- **Reject the upload as a duplicate**: Rejected — forces the user to
  manually rename before retrying, worse UX for a plausible, benign case
  (e.g., two different reports happen to share a filename).
- **Store under a generated UUID filename with a separate metadata record
  for the original name**: Rejected — reintroduces the need for a database/
  metadata store this feature deliberately avoids (see #4); unnecessary
  complexity per Principle III given the simpler suffix approach fully
  satisfies the requirements.

## 4. Document metadata (no database)

**Decision**: No database or sidecar metadata file is introduced. For each
file in `PDFS_DIR`:
- `name` = the on-disk filename (already collision-resolved).
- `sizeBytes` = `os.stat().st_size`.
- `uploadedAt` = `os.stat().st_mtime` (file's last-modified time, set at
  creation since files are never modified after upload).
- `id` = the on-disk filename itself (filesystem already guarantees
  uniqueness within the directory; no need for a separately generated ID).
- `status` = `"processed"` for any file that is fully present on disk when
  listed. `"processing"` is only ever observed transiently, during the
  window between the upload request being accepted and the file finishing
  its write — handled synchronously within the `POST` request/response
  cycle, so the API only ever returns already-`"processed"` documents; the
  frontend may still show a brief local "processing" state while the
  request is in flight, purely as UI feedback.

**Rationale**: FR-006/FR-007 only require the existing four display fields;
introducing a database purely to store what filesystem stat calls already
provide would violate Principle III (YAGNI) and the spec's own Assumptions
("metadata derived from filesystem metadata... since no database for source
metadata exists yet").

**Alternatives considered**:
- **SQLite metadata table**: Rejected for now — no requirement yet needs
  data that outlives the filesystem itself (e.g., original vs. disambiguated
  name, custom tags). Revisit if/when a real ingestion pipeline needs to
  track per-document processing state that can't be derived from disk.
- **JSON manifest file alongside the PDFs**: Rejected — adds a second
  source of truth that can drift from the actual directory contents
  (e.g., if a file is deleted outside the app, per Edge Cases); listing the
  directory directly is simpler and self-correcting.

## 5. API shape

**Decision**: Two REST endpoints under `/api/sources`:
- `POST /api/sources` — `multipart/form-data` with one or more files under
  a `files` field. Validates each file server-side (PDF only, ≤50MB) before
  writing; accepted files are saved (with collision suffixing) and returned
  in a `documents` array, rejected files are returned in a `rejections`
  array in the same response — a request with a mix of valid and invalid
  files always returns `200 OK` with both arrays populated as appropriate
  (matches spec's "mix of valid and invalid files" scenarios; avoids
  conflating "some files rejected" with an HTTP-level failure).
- `GET /api/sources` — returns the current `documents` array, freshly
  derived from `PDFS_DIR` on every call (no caching), sorted by
  `uploadedAt` ascending to match upload order.

No authentication (single local user, Principle III). CORS is enabled for
the frontend's local dev origin and disabled/same-origin in the
docker-compose deployment where both are served behind the same host.

**Alternatives considered**:
- **Separate endpoint per file / one request per file**: Rejected — the
  spec requires multi-file uploads in one action (existing FR-010); a
  single multipart request matches that directly.
- **207 Multi-Status for partial rejection**: Rejected — adds HTTP-semantics
  complexity for no real benefit at this scale; a `200` with two arrays is
  simpler for the frontend to consume and fully expresses the outcome.

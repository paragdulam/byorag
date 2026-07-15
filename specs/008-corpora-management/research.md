# Phase 0 Research: Corpora Management with Persistent Storage

All items below were resolved by inspecting the existing codebase (`backend/app/sources`,
`backend/app/chunking`, `docker-compose.yml`, `frontend/src/components/layout/SidebarNav.tsx`) and
the ratified `.specify/memory/constitution.md`; no external unknowns remained after that review, so
no NEEDS CLARIFICATION markers are carried into this phase.

## 1. Database access layer

**Decision**: SQLAlchemy 2.x with the synchronous `psycopg` (v3) driver, one `Session` per request
via a FastAPI dependency (`get_db()`).

**Rationale**: Existing backend handlers are a mix of plain `def` and `async def` FastAPI routes
(`chunking/router.py` streams via a generator; `sources/router.py`'s `upload_sources` is `async def`
only because `UploadFile.read()` is async) — there is no existing async-DB pattern to match, and the
app is explicitly single-user/local (Constitution III). A synchronous session keeps request handlers
simple and avoids introducing async session/connection-pool lifecycle management for a workload that
will never see concurrent-request pressure.

**Alternatives considered**: `asyncpg` + SQLAlchemy async engine — rejected; adds session-lifecycle
complexity (async context managers threaded through every service function) with no realistic
performance benefit at the stated scale (tens of corpora, hundreds of documents).

## 2. Schema management & startup migration

**Decision**: SQLAlchemy `Base.metadata.create_all(engine)` run once at FastAPI startup (no Alembic).
A separate idempotent startup routine, `migrate_legacy_pdfs()`, runs immediately after
`create_all()`: it scans `PDFS_DIR` for files with no matching `documents.content_hash` row, computes
each file's SHA-256, inserts a `documents` row, ensures a single system `corpora` row named
`"Uncategorized"` exists (created once, reused thereafter), and links the two via
`document_corpora`.

**Rationale**: Constitution Principle III (YAGNI) — this is a local single-user tool with no
production rollout, staged environments, or rollback requirements that Alembic-style versioned
migrations exist to solve. `create_all()` is idempotent and sufficient for the one schema this
feature introduces. The legacy-PDF migration must still run exactly once per file (not per
process start) — `content_hash` uniqueness makes this check trivial and safe to re-run on every
boot.

**Alternatives considered**: Alembic — rejected as disproportionate overhead for the current scope;
revisit if/when the schema needs versioned, reviewable migrations (e.g., multi-environment
deployment).

## 3. Content-hash dedup (Clarification: auto-dedupe by content)

**Decision**: SHA-256 over the raw uploaded file bytes, computed once at upload time, stored as
`documents.content_hash` with a `UNIQUE` constraint. `POST /api/sources` hashes the incoming file
before writing anything: on a hit, it links the existing `document` row to the target corpus (via
`document_corpora`, ignoring a duplicate link) and skips both the filesystem write and chunking;
on a miss, it proceeds as a normal new upload.

**Rationale**: SHA-256 is already a available in Python's standard library (`hashlib`), is
collision-safe for this use case, and reuses the same one-pass read used for the existing 50MB size
check — no new dependency.

**Alternatives considered**: Filename-based dedup — rejected; two different files can share a name,
and the spec's clarification was explicit about *content* identity, not filename identity.

## 4. Local PostgreSQL provisioning

**Decision**: Add a `postgres:16` service to `docker-compose.yml` with a named volume
(`pgdata:/var/lib/postgresql/data`) and default credentials via environment variables; the `backend`
service gets a `DATABASE_URL` environment variable pointing at it and a `depends_on: postgres`.
`app/config.py` reads `DATABASE_URL` with a `postgresql+psycopg://byorag:byorag@localhost:5432/byorag`
local fallback default so `uvicorn` can also run directly against a developer's locally-installed
Postgres without Docker.

**Rationale**: Matches the existing `pdfs_data` volume pattern already in `docker-compose.yml` and
keeps "run the whole app" a single `docker compose up`, consistent with Constitution IV's
containerization requirement for whatever is in the stack.

**Alternatives considered**: SQLite — rejected; the user explicitly asked for PostgreSQL, and SQLite's
weaker concurrent-write and constraint semantics are a worse fit for the relational-integrity
requirements (FR-006, FR-013, FR-015) driving this feature.

## 5. Corpus deletion guard (FR-013)

**Decision**: Enforced in the application/service layer, not only via a DB foreign-key constraint:
`DELETE /api/corpora/{id}` first counts `document_corpora` rows for that corpus; if non-zero, it
returns `409 Conflict` with a clear message before touching the database, rather than relying on a
raw FK-violation error bubbling up.

**Rationale**: A clear, typed `409` with a human-readable message is easier for the frontend to
surface (spec Acceptance Scenario, User Story 1/Edge Cases) than parsing a Postgres FK-violation
error string. The FK constraint (`ON DELETE RESTRICT`) is still declared as a defense-in-depth
backstop.

## 6. Cascade delete on last corpus unlink (FR-007, FR-008)

**Decision**: `DELETE /api/sources/{documentId}/corpora/{corpusId}` runs inside a single DB
transaction: delete the `document_corpora` row, then `COUNT(*)` remaining links for that document;
if zero, delete all `chunks` rows for the document, delete the `documents` row, and delete the
underlying file from `PDFS_DIR`. If the file delete fails after the DB commit, it is logged but not
retried inline (matches existing `sources/service.py` error-tolerant delete behavior — a later
`migrate_legacy_pdfs()`-style orphan sweep is out of scope for this feature).

**Rationale**: Keeps "document has zero corpora" impossible to observe via the API (spec Key
Entities: "A document must belong to at least one corpus to exist"), matching FR-008 exactly.

## 7. Active corpus state (client vs. server)

**Decision**: The "active corpus" is plain frontend React state (`CorpusContext`), initialized from
`localStorage` (falls back to the first corpus returned by `GET /api/corpora`, or `null` if none
exist) and written back to `localStorage` on every change. The backend has no concept of a
"current"/"selected" corpus; every corpus-scoped request (`GET /api/sources?corpusId=...`) is
explicit and stateless.

**Rationale**: Constitution Principle III — avoids adding server-side session/user-preference
storage for a single local user where a client-side value already satisfies the requirement
("Sources view MUST scope ... to the currently active corpus", FR-004). `localStorage` persistence
is a cheap UX nicety (survives a page reload) with no server-side footprint.

**Alternatives considered**: A server-stored "current corpus" row/setting — rejected as unnecessary
server state for a single-user tool with no concept of "sessions" today.

## 8. Chevron indicator (FR-012)

**Decision**: A small inline SVG chevron (`<svg>` path, no icon library dependency), rendered
conditionally next to any `NavItem` that has `subItems`, rotated 90°/180° via a CSS `transform`
class driven by the existing `isExpanded` boolean already computed in `SidebarNav.tsx`.

**Rationale**: `frontend/package.json` has zero icon-library dependency today; adding one (e.g.
lucide-react) for a single glyph would be disproportionate. `SidebarNav.tsx` already tracks
`expandedLabel`/`isExpanded` per item — the chevron only needs to read that existing state, no new
state is introduced.

## 9. Chunk persistence trigger

**Decision**: `chunking/service.py`'s `stream_chunking()` generator, on producing its terminal
`result` event, persists the run's chunks for that `documentId` inside one transaction: delete any
existing `chunks` rows for the document, then bulk-insert the new ones (each row: `document_id`,
`index`, `content`, plus the run's `strategy`/`chunkSize`/`overlap` already available on
`ChunkingResult` for traceability — Constitution V). A failed persist is surfaced as the stream's
`error` event rather than a silently-dropped write.

**Rationale**: Document→Chunk is a plain 1:N with no versioning requirement in the spec — "re-chunk"
is a full replace, matching how the existing UI already treats a chunking run as the current,
authoritative result for that document.

**Alternatives considered**: Append-only chunk history (keep old runs) — rejected; not requested by
the spec (Key Entities describes a single current set of chunks per document) and adds retrieval
complexity (which run is "current") with no stated user value yet.

## 10. Backend test isolation against a real PostgreSQL

**Decision**: Tests point `DATABASE_URL` at a dedicated `byorag_test` database (documented in
`quickstart.md`); a pytest fixture opens a connection, begins an outer transaction, binds the
`Session` to that connection, and rolls the transaction back at the end of each test — no test ever
commits visible data.

**Rationale**: Constitution Principle II requires trustworthy tests; Postgres-specific behavior
(`UNIQUE` constraint violations, FK `ON DELETE RESTRICT`) must be exercised against real Postgres,
not an SQLite stand-in with different constraint/error semantics.

**Alternatives considered**: SQLite in-memory for tests — rejected for the same reason SQLite was
rejected for the app itself (§4); would risk tests passing against behavior Postgres doesn't
actually exhibit.

# Research: User Authentication & Per-User Data Ownership

## §1. Password hashing library

**Decision**: `bcrypt` (the plain `bcrypt` PyPI package, not `passlib`).

**Rationale**: Industry-standard, adaptive (built-in work factor), no configuration tuning
required to get a safe default, and a small, dependency-light package — consistent with
this project's pattern of adding focused libraries per feature (`anthropic`,
`umap-learn`, etc.) rather than a larger framework. `passlib` would add an extra
abstraction layer for multi-scheme support this project doesn't need (only one scheme,
ever, per Principle III's "smallest thing that solves it").

**Alternatives considered**: `argon2-cffi` — the more modern, memory-hard alternative;
rejected only because it needs explicit tuning parameters (memory/time cost) to be
configured deliberately, whereas `bcrypt`'s single work-factor knob has a well-known safe
default (12) — simpler for a first pass, revisit only if a concrete need arises.

## §2. Bringing existing tables up to the new schema (no migration framework exists)

**Decision**: Add a new `app/db/schema_migrations.py`, run at startup (in `main.py`'s
`lifespan`, before `Base.metadata.create_all(engine)`), containing idempotent raw
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` / `DROP COLUMN IF EXISTS ...` statements
for every column this feature adds to or removes from the pre-existing `corpora` and
`documents` tables (`user_id` on both, `content` on `documents`, dropping
`documents.storage_path`). Mirrors the existing `ensure_vector_extension(engine)` pattern
in `app/db/base.py` exactly (also raw idempotent SQL, also run once at startup before
`create_all`).

**Rationale**: `Base.metadata.create_all()` only creates tables that don't exist yet — it
never alters an existing table's columns (SQLAlchemy's docs are explicit about this), and
this project has never needed to alter an existing table before now (the one prior
schema-evolution case, `legacy_migration.py`, only ever *inserted new rows*, never changed
a column). Introducing a full migration framework (Alembic) for one feature's worth of
column changes would be a heavier tool than the problem needs, and the project already has
an established, working pattern for exactly this kind of "run raw idempotent SQL once at
startup" need.

**Alternatives considered**: Alembic — the standard, more scalable choice for a project
that expects to evolve its schema often; rejected for now as disproportionate to a
single-column-set change, consistent with YAGNI. Worth revisiting if a second, unrelated
schema change arrives before this one's migration code is retired.

**New columns' nullability**: `corpora.user_id` and `documents.user_id` are added as
**nullable** at the database level (existing rows have no user yet), but every
application-level query/authorization check treats a null `user_id` as "not yet claimed by
anyone" and denies access to it. In practice this window is unobservable: nothing is
reachable at all before the very first signup (FR-006 gates every endpoint), and that first
signup's own transaction immediately backfills every null-owned row (§3) — so no request
ever actually sees a null-owned corpus or document once the app is truly in use.

## §3. Assigning pre-existing data to the first registered account (FR-013)

**Decision**: Inside the `POST /api/auth/signup` handler's own transaction, immediately
after creating the new `User` row, check whether any `corpora`/`documents` rows still have
`user_id IS NULL`. If so — which is only possible for the very first signup ever, since
every subsequent signup finds nothing left to claim — update all of them to the new user's
id in the same transaction, then commit.

**Rationale**: This is an event-driven backfill (triggered by "the first account being
created"), not a startup-time migration like `legacy_migration.py` — there is no user to
assign existing data to until someone actually signs up, so it can't run at process
startup. Doing it inside the signup transaction itself guarantees it happens exactly once,
atomically, with no separate script or manual step required.

**Alternatives considered**: A separate one-off CLI/admin script — rejected as an extra
manual step a personal/local tool shouldn't need; the goal (per spec.md's Assumption) is
that whoever signs up first simply finds their existing data already there.

## §4. Session transport: bearer token in `localStorage`, not a cookie

**Decision**: `POST /api/auth/signup`/`/login` return an opaque session token in the
response body. The frontend stores it in `localStorage` and attaches it as
`Authorization: Bearer <token>` on every subsequent API call, via one new shared
`apiClient.ts` wrapper (§6). `POST /api/auth/logout` revokes the session server-side; the
frontend then clears its stored token.

**Rationale**: The app's frontend and backend already run on **different origins**, even
in the docker-compose "production" setup — confirmed by reading `frontend/Dockerfile`
(plain static `nginx`, no `/api` reverse-proxy config) and `docker-compose.yml`
(`VITE_API_BASE_URL: http://localhost:8000` baked in at build time, a different origin
than the frontend's own `http://localhost:5173`). The existing `CORSMiddleware`
configuration in `main.py` (explicit `allow_origins`) only exists *because* this is already
a cross-origin setup. A cross-origin cookie would need `SameSite=None; Secure` — and
`Secure` cookies require HTTPS, which this local deployment doesn't have (browsers grant a
`localhost`-only exception, which wouldn't hold if BYORAG is ever pointed at a real
non-TLS host). A bearer token sidesteps all of that: it works identically regardless of
origin or protocol, and satisfies FR-004's "persists across normal browser restarts" just
as well, since (unlike `sessionStorage`) `localStorage` survives them.

**Accepted tradeoff**: a token in `localStorage` is readable by any script on the page
(unlike an `HttpOnly` cookie), so it's more exposed to XSS than a cookie would be. This is
a deliberate, documented tradeoff — the same category of "acceptable for this stage" choice
spec.md already made explicitly for login rate-limiting and upload quotas — appropriate for
a small-scale personal/team tool, revisit if BYORAG's threat model ever changes.

**Alternatives considered**: An `HttpOnly` session cookie — the more XSS-resistant option
in general, but only actually safer here if the cross-origin `SameSite`/`Secure`
requirements above are also solved, which would mean either (a) reconfiguring the
deployment to be same-origin (adding a reverse proxy in front of both frontend and
backend) or (b) accepting the fragile `SameSite=None`-without-real-HTTPS combination. Both
are larger, riskier changes to the existing deployment topology than this feature's scope
calls for; deferred.

## §5. Carrying the session token on the two SSE (`EventSource`) endpoints

**Decision**: For the chunking and embeddings run/save streaming endpoints (the only two
places the frontend uses `EventSource`, in `chunkingApi.ts` and `embeddingsApi.ts`), append
the session token as a `token` query-string parameter on the SSE URL instead of an
`Authorization` header. `require_user` (§ dependencies) accepts the token from *either* the
`Authorization` header *or* a `token` query parameter, so the same dependency serves both
transports without duplicating logic.

**Rationale**: The browser's native `EventSource` API has no mechanism to attach custom
request headers at all — this is a hard platform limitation, not a design choice. Passing
the token as a query parameter is the standard, widely-used workaround for exactly this
`EventSource` limitation.

**Accepted tradeoff**: query parameters can end up in server access logs (unlike header
values, which typically aren't logged by default). Acceptable here given the token is
already a bearer credential stored in `localStorage` rather than a long-lived password,
and BYORAG's access logs are local, not shipped anywhere.

**Alternatives considered**: Switching the two streaming endpoints from native
`EventSource` to a `fetch`-based SSE client library (e.g. `@microsoft/fetch-event-source`)
that does support custom headers — rejected as a larger, unrelated change (a new frontend
dependency, rewriting two working streaming call sites) purely to avoid a well-understood,
low-risk workaround.

## §6. One shared frontend API client wrapper

**Decision**: Add `frontend/src/lib/apiClient.ts`, exporting a thin `apiFetch(url, init?)`
wrapper around `fetch` that reads the stored token from `localStorage`, attaches
`Authorization: Bearer <token>` when present, and treats a `401` response uniformly (clears
the stored token and notifies `AuthContext` so the app re-renders into the signed-out
state). Every existing `frontend/src/lib/*Api.ts` module (`corporaApi.ts`, `sourcesApi.ts`,
`chunkingApi.ts`, `embeddingsApi.ts`, `playgroundApi.ts`, `metricsApi.ts`, and any others
calling `fetch` directly) is refactored to call `apiFetch` instead of `fetch`. The two SSE
call sites build their `EventSource` URL through a small parallel helper that appends the
token as a query parameter (§5) rather than going through `apiFetch` (which is
header-based).

**Rationale**: Seven existing files call `fetch` directly today, each independently
constructing request options — attaching the auth header at each of those call sites by
hand would be repetitive and easy to miss one of. A single wrapper makes "every API call is
authenticated" a structural guarantee instead of a per-call-site discipline, and gives one
place to handle session expiry (a `401`) consistently across the whole app.

**Alternatives considered**: Leaving every `lib/*Api.ts` file to attach the header itself
— rejected for the repetition/miss-one-spot risk above, especially since new API modules
will keep being added as the app grows.

## §7. Document/Corpus ownership given the existing document↔corpus many-to-many

**Decision**: Give `Document` its own denormalized `user_id` column (in addition to
`Corpus.user_id`), set once at upload time to the uploading user's id. A document may only
ever be attached to (or remain attached to) corpora that share that same `user_id` —
enforced at the service layer in `attach_document_to_corpus`/upload, alongside the existing
corpus-must-exist check. Every per-user list/read/write query filters on `Document.user_id`
directly rather than joining through `document_corpora` → `corpora` to discover the owner.

**Rationale**: `Document`↔`Corpus` is an existing many-to-many relationship (one document
can belong to more than one corpus, from research predating this feature). Since corpora
are now strictly single-owner (spec.md Clarifications), a document's *effective* owner is
already fully determined by whichever corpus/corpora it's linked to — but resolving that
via a join on every single document query (list, read, chunk, embed, chat, delete) would be
slower and more error-prone to get right consistently across every module than storing it
directly. The added invariant (a document's corpora must all share one owner) is a natural,
low-cost consequence of "corpora are strictly private" (spec.md Clarifications) — it simply
makes explicit what was already implied: nothing designed the many-to-many relationship to
span *different users'* corpora, since sharing across accounts is explicitly out of scope
for this feature.

**Alternatives considered**: Deriving ownership purely via a join through
`document_corpora`/`corpora` on every access — rejected as both a performance cost (extra
join on every document-scoped query, across many already-numerous call sites) and a
correctness risk (a document with, hypothetically, zero corpus links — which today's
"delete on last unlink" behavior prevents, but a subtle future bug could reintroduce —
would have no derivable owner at all, whereas a direct column always has one).

## §8. Database-backed PDF storage: `Document.content` replaces `Document.storage_path`

**Decision**: Add `Document.content: bytes` (SQLAlchemy `LargeBinary`), remove
`Document.storage_path`. `sources/service.py`'s `save_file` writes the uploaded bytes into
this column instead of the local `pdfs/` directory; `get_document_file_path` (renamed to
reflect it now returns bytes, not a path) reads `document.content` directly; the
file-serving router endpoint (`GET /api/sources/{id}/file`) switches from FastAPI's
`FileResponse` (which needs a filesystem path) to a raw `Response(content=..., media_type="application/pdf")`.
`chunking/service.py`'s `extract_text_pages` is changed to accept `bytes` (wrapping them in
`io.BytesIO` for `pypdf.PdfReader`, which already accepts a file-like object) instead of a
`Path`. `unlink_document_from_corpus`/`delete_documents` drop their `Path(...).unlink(...)`
steps entirely — deleting the `Document` row now deletes its content too, with nothing left
over on disk to separately clean up.

**Rationale**: Directly implements User Story 3 / FR-010–FR-012 and the amended
constitution's Source Storage rule. `pypdf.PdfReader` already supports being constructed
from any file-like object (not just a path), so this is a narrow, mechanical change at each
of the small number of call sites that currently open `Path(document.storage_path)`.

**Alternatives considered**: A dedicated large-object/BLOB API (Postgres large objects via
`lo_import`/`lo_export`) instead of a plain `bytea` column — rejected as unnecessary
complexity for files capped at 50MB (`MAX_UPLOAD_SIZE_BYTES`, unchanged); a plain
`LargeBinary` column is simpler and sufficient at this scale.

## §9. Authorization pattern applied uniformly across existing routers

**Decision**: One FastAPI dependency, `require_user(request, db) -> User` (in
`app/auth/dependencies.py`), added to every endpoint in every existing router (`corpora`,
`sources`, `chunking`, `embeddings`, `playground`, `metrics`, `system`). It resolves the
bearer token from the `Authorization` header or a `token` query parameter (§5), looks up
the matching non-revoked `Session` row, and returns its `User` — or raises `401` if missing/
invalid. Each service function that currently takes a `corpus_id`/`document_id` gains an
additional `user_id` parameter and asserts the referenced row's `user_id` matches before
proceeding (reusing the existing `get_corpus_or_none`/`get_document_or_none` lookups in
`app/db/lookups.py`, extended with an ownership check alongside the existing
existence check) — returning the same `404` used today for "doesn't exist" rather than a
`403`, so a user attempting to probe another account's IDs learns nothing more than "not
found" (matches FR-009's "deny, not merely hide").

**Rationale**: A single shared dependency plus a single shared ownership-assertion helper
means the "every endpoint requires login and only touches its own data" rule (FR-006,
FR-008, FR-009) is enforced the same way everywhere, rather than reimplemented per router
with room for one to be missed.

**Alternatives considered**: Per-router bespoke auth checks — rejected for the same
consistency/completeness reasons as centralizing the frontend API client (§6).

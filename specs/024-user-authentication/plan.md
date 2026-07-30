# Implementation Plan: User Authentication & Per-User Data Ownership

**Branch**: `024-user-authentication` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-user-authentication/spec.md`

## Summary

Turn BYORAG from a single implicit user into a multi-account application: email/password
sign-up and login (self-service, no OAuth), a persistent session per login, every existing
screen and API endpoint gated behind that session, every corpus (and everything nested
under it — documents, chunks, embeddings, chat history) scoped to exactly one owning
account, and uploaded PDFs stored as content in PostgreSQL instead of the local
filesystem. Pre-existing corpora/documents are claimed by whichever account registers
first.

Technical approach: add `User`/`Session` tables and a `user_id` column to `Corpus` (plus a
denormalized `user_id` on `Document`, to keep per-user filtering a direct query rather than
a join through the existing document↔corpus many-to-many); replace `Document.storage_path`
with a `content` byte column; add a small `app/auth` module (hash/verify password,
create/validate session, first-signup backfill) and a FastAPI dependency that every
existing router adopts; on the frontend, add an `AuthContext` + login/signup screen, gate
`App.tsx` on it, and introduce one shared fetch wrapper that every existing `lib/*Api.ts`
module routes through so the session token is attached consistently everywhere (including
the two SSE endpoints, which — since `EventSource` cannot send custom headers — carry the
token as a query parameter instead).

## Technical Context

**Language/Version**: Python 3.12 (backend, `uv`-managed), TypeScript ~6.0.2 / React 19.2.7 (frontend, Vite)

**Primary Dependencies**: FastAPI, SQLAlchemy, psycopg (all already in use) + **`bcrypt`** (new — password hashing; a normal implementation dependency, not a Principle IV stack change, same category as `anthropic`/`transformers` added in earlier features). No new frontend dependencies — session storage and the auth header wrapper use native `fetch`/`localStorage`.

**Storage**: PostgreSQL (unchanged infrastructure choice) — gains `users` and `sessions` tables, a `user_id` column on `corpora` and `documents`, and a `content` (bytes) column on `documents` replacing `storage_path`. No new database service.

**Testing**: pytest (`backend/tests/contract`, `backend/tests/unit`, `backend/tests/integration`), Vitest (`frontend/tests/unit`, `frontend/tests/integration`) — matches existing project conventions. Security-sensitive code (password hashing, session validation, ownership checks) gets explicit negative-path tests, not just happy-path.

**Target Platform**: Browser frontend + local Docker-composed backend (per constitution's fixed stack)

**Project Type**: Web application (existing `backend/` + `frontend/` split)

**Performance Goals**: No new specific target; PDF content moving into Postgres rows is bounded by the existing 50MB per-file upload cap (`MAX_UPLOAD_SIZE_BYTES`, unchanged), so row/table size stays predictable.

**Constraints**:
- The app's frontend and backend already run on **different origins** even in the docker-compose "production" setup (`VITE_API_BASE_URL` is baked in at build time to a separate host:port; no reverse proxy unifies them, confirmed via `frontend/Dockerfile` — plain static `nginx`, no `/api` proxy config). This makes cookie-based sessions genuinely awkward (`SameSite=None; Secure` cross-origin, `Secure` requiring HTTPS this local deployment doesn't have) — see research.md §4 for the chosen alternative.
- `EventSource` (used by the two existing SSE streaming endpoints — chunking and embeddings run/save progress) cannot attach custom request headers at all — see research.md §5.
- No database migration framework exists today (`Base.metadata.create_all()` is additive-only — it creates missing tables but never alters existing ones); this is the first feature that needs to change *existing* tables' columns/constraints, not just add new tables — see research.md §2.

**Scale/Scope**: The largest cross-cutting change in the project's history so far — every backend router (corpora, sources, chunking, embeddings, playground, metrics) gains an auth dependency and ownership-scoped queries, and every frontend `lib/*Api.ts` module is refactored to route through one new shared client wrapper. Bounded, though: no new external services, no new screens beyond login/sign-up, and the existing single-corpus-at-a-time UI model is unchanged.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: PASS. Authentication and per-user scoping sit above the chunking/embedding/retrieval/generation/evaluation strategy registries and don't touch them.
- **II. Test-First, Test at Every Level**: PASS (commitment carried into tasks.md). Given the security-sensitive surface (password storage, session validation, cross-user access denial), negative/adversarial test cases (wrong password, expired/revoked session, cross-account ID access) are as important as the happy path and will be required, not optional, for every relevant task.
- **III. Multi-User Simplicity (Right-Sized Complexity)**: PASS — this feature *is* Principle III's newly-amended requirement. Every explicit non-goal in the amended principle (no sharing/collaboration, no roles/admin oversight, no third-party OAuth/SSO, no login rate-limiting, no storage quotas) matches spec.md's clarifications exactly.
- **IV. Fixed Technology Stack**: PASS — no new core stack element; `bcrypt` is an implementation dependency, not a stack change. Source Storage is now PostgreSQL per the amended Principle IV, which is exactly what this feature implements.
- **V. Experiment Observability & Reproducibility**: PASS — ownership scoping doesn't touch how chunk/embedding/retrieval configuration is recorded or traced; every experiment artifact remains traceable to its corpus, now additionally scoped to that corpus's owning account.

No violations. Complexity Tracking is not needed — the large surface area is inherent to the feature's own scope (gating *everything*, per FR-006), not a principle violation requiring justification.

**Post-Phase 1 re-check**: Design artifacts (research.md, data-model.md, contracts/)
introduce one new backend dependency (`bcrypt`), no new backend services/infrastructure,
and no new frontend dependencies. The bearer-token-over-cookie decision (research.md §4)
and the raw-SQL migration approach (research.md §2) were both evaluated against
Principle IV (no new stack element — both are implementation choices within the existing
Python/Postgres stack) and Principle III (still the smallest thing that solves real
per-user isolation). All five gates remain PASS with no changes to the assessment above.

## Project Structure

### Documentation (this feature)

```text
specs/024-user-authentication/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── auth/                      # NEW module
│   │   ├── schemas.py             # SignupRequest, LoginRequest, UserResponse, ...
│   │   ├── service.py             # hash/verify password, create_user, authenticate,
│   │   │                          # create_session, resolve_session, revoke_session,
│   │   │                          # backfill_ownerless_data_to_first_user
│   │   ├── dependencies.py        # require_user FastAPI dependency (reads Authorization
│   │   │                          # header, or a `token` query param for SSE routes)
│   │   └── router.py              # POST /api/auth/signup, /login, /logout; GET /api/auth/me
│   ├── db/
│   │   ├── models.py              # + User, Session; Corpus + user_id (unique per user, not
│   │   │                          # globally); Document + user_id, content (bytes),
│   │   │                          # storage_path removed
│   │   ├── schema_migrations.py   # NEW — idempotent raw ALTER TABLE steps for existing
│   │   │                          # tables (research.md §2), run at startup before create_all
│   │   └── legacy_migration.py    # updated: writes `content` not `storage_path`; leaves
│   │                              # user_id null (claimed by the first-signup backfill)
│   ├── sources/
│   │   ├── service.py             # save_file/get_document_file/delete/unlink rewritten for
│   │   │                          # DB-bytes storage; every function takes user_id and scopes/
│   │   │                          # asserts ownership
│   │   └── router.py              # every endpoint gains current_user dependency
│   ├── corpora/                   # service + router: user_id scoping, per-user name uniqueness
│   ├── chunking/service.py        # extract_text_pages now takes bytes, not a Path
│   ├── embeddings/, playground/, metrics/, system/   # routers gain current_user dependency;
│   │                                                  # services scope/assert ownership
│   └── main.py                    # wires schema_migrations step + auth_router
└── tests/
    ├── contract/test_auth_api.py           # NEW — signup/login/logout/me contract
    ├── unit/test_auth_service.py           # NEW — password hashing, session lifecycle
    ├── unit/test_ownership_scoping.py      # NEW — cross-account access denial, per module
    └── integration/test_first_signup_backfill.py  # NEW — FR-013

frontend/
├── src/
│   ├── context/AuthContext.tsx    # NEW — currentUser, login, signup, logout, isLoading
│   ├── components/auth/
│   │   ├── LoginScreen.tsx        # NEW
│   │   └── SignupScreen.tsx       # NEW
│   ├── lib/
│   │   ├── authApi.ts             # NEW — signup/login/logout/me calls
│   │   └── apiClient.ts           # NEW — shared fetch wrapper attaching the session token;
│   │                              # every existing lib/*Api.ts routes through it instead of
│   │                              # calling fetch directly
│   └── app/App.tsx                # wraps in AuthProvider; renders Login/Signup when signed out
└── tests/
    ├── unit/AuthContext.test.tsx        # NEW
    ├── unit/LoginScreen.test.tsx        # NEW
    ├── unit/SignupScreen.test.tsx       # NEW
    ├── unit/apiClient.test.ts           # NEW
    └── integration/App.auth-gate.test.tsx  # NEW — signed-out vs. signed-in rendering
```

**Structure Decision**: Existing `backend/` + `frontend/` web-application split, unchanged.
This feature adds one new backend module (`app/auth/`) and one new migration-support file,
extends the DB models and nearly every existing router/service with auth/ownership
concerns, and adds one new frontend context + two new screens + one new shared API-client
wrapper that every existing frontend API module is refactored to use.

## Complexity Tracking

*No violations — table not needed.*

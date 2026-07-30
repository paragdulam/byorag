---

description: "Task list template for feature implementation"
---

# Tasks: User Authentication & Per-User Data Ownership

**Input**: Design documents from `/specs/024-user-authentication/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level),
tests are NON-NEGOTIABLE and are included for every user story at the appropriate
level(s) — especially critical here given the security-sensitive surface (password
storage, session validation, cross-account access denial).

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web app per plan.md: `backend/app/...`, `backend/tests/...`, `frontend/src/...`, `frontend/tests/...`

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Add `bcrypt` to `backend/pyproject.toml` dependencies (research.md §1) and run `uv sync`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The new `User`/`Session` tables and the ownership/content columns on `Corpus`/
`Document` that every user story depends on — none of the three stories can be built,
let alone tested, without this schema existing first.

**⚠️ CRITICAL**: Must complete before any user story phase begins.

- [X] T002 [P] Add `User` model to `backend/app/db/models.py` (`id`, `email` unique, `password_hash`, `created_at` — data-model.md)
- [X] T003 [P] Add `Session` model to `backend/app/db/models.py` (`token` primary key, `user_id` FK → `users.id` `ON DELETE CASCADE`, `created_at`, `revoked_at` nullable — data-model.md)
- [X] T004 Add `user_id` (nullable FK → `users.id`) to `Corpus` in `backend/app/db/models.py`; replace the bare `unique=True` on `name` with a composite `UniqueConstraint(user_id, name)` (data-model.md)
- [X] T005 Add `user_id` (nullable FK → `users.id`) and `content` (`LargeBinary`) to `Document` in `backend/app/db/models.py`; remove `storage_path` (data-model.md, research.md §8)
- [X] T006 [P] Unit test for `backend/tests/unit/test_schema_migrations.py` — running the new migration step twice in a row is a no-op the second time (idempotent); against a table shaped like today's pre-existing `corpora`/`documents` (no `user_id`/`content`, still has `storage_path`), it adds the missing columns and drops `storage_path` without touching existing row data (research.md §2)
- [X] T007 Implement `backend/app/db/schema_migrations.py` — idempotent raw `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `DROP COLUMN IF EXISTS` statements bringing pre-existing `corpora`/`documents` tables up to T004/T005's shape, mirroring `ensure_vector_extension`'s style in `app/db/base.py` (research.md §2) — depends on T006 failing first, T004, T005
- [X] T008 Wire `schema_migrations` into `backend/app/main.py`'s `lifespan`, run before `Base.metadata.create_all(engine)` — depends on T007
- [X] T009 Update `backend/app/db/legacy_migration.py` to write PDF bytes into `Document.content` instead of `storage_path`, leaving the new `user_id` column null (claimed later by the first-signup backfill, US1) — depends on T005, T007

**Checkpoint**: Schema in place — all three user stories can now be built.

---

## Phase 3: User Story 1 - Create an account and log in (Priority: P1) 🎯 MVP (with US2)

**Goal**: Email/password sign-up and login, a persistent session, logout, and a frontend
that shows the login/sign-up screen when signed out and the existing app when signed in.
The very first signup also claims any pre-existing (ownerless) corpora/documents.

**Independent Test**: Sign up, log out, log back in with the same credentials, confirm a
wrong password is rejected — all independent of whether any other screen enforces the
session yet (that's User Story 2).

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T010 [P] [US1] Contract test for `backend/tests/contract/test_auth_api.py` — signup creates an account + session and returns `{user, token}` (`201`); a second signup with the same email is rejected (`409`); login with correct credentials returns `200` + a valid token; login with a wrong password *or* unknown email returns the same generic `401` message either way (FR-002); logout revokes the session (`204`, idempotent when called again); `/me` returns the user for a valid token and `401` for a missing/invalid/revoked one (contracts/auth-api.md)
- [X] T011 [P] [US1] Unit test for `backend/tests/unit/test_auth_service.py` — `hash_password`/`verify_password` round-trip and the hash never equals the plaintext; `create_session`/`resolve_session`/`revoke_session` lifecycle; `resolve_session` rejects an unknown or already-revoked token
- [X] T012 [P] [US1] Integration test for `backend/tests/integration/test_first_signup_backfill.py` — pre-existing corpora/documents with a null `user_id` are all assigned to the very first signup's user, in the same transaction; a *second* signup claims nothing (nothing left unowned) (research.md §3, FR-013)
- [X] T013 [P] [US1] Unit test for `frontend/tests/unit/apiClient.test.ts` — `apiFetch` attaches `Authorization: Bearer <token>` when a token is stored via `setStoredToken`, omits it when none is stored; a `401` response clears the stored token and emits the signed-out signal (contracts/ui-contracts.md)
- [X] T014 [P] [US1] Unit test for `frontend/tests/unit/AuthContext.test.tsx` — the initial `GET /api/auth/me` check sets `currentUser` (or leaves it `null`) and flips `isLoading` to `false`; `signup`/`login` store the returned token and set `currentUser`; `logout` clears the token and `currentUser` even if the network call fails; reacts to `apiClient`'s 401 signal by signing out
- [X] T015 [P] [US1] Unit test for `frontend/tests/unit/LoginScreen.test.tsx` — submits email/password via `useAuth().login`; shows an inline `role="alert"` error on failure with no navigation away from the form
- [X] T016 [P] [US1] Unit test for `frontend/tests/unit/SignupScreen.test.tsx` — submits email/password via `useAuth().signup`; shows an inline error on a duplicate-email failure; a link/toggle to the login form (FR-001)

### Implementation for User Story 1

- [X] T017 [US1] Implement `backend/app/auth/service.py` — `hash_password`/`verify_password` (bcrypt, T001), `create_user`, `authenticate`, `create_session`, `resolve_session`, `revoke_session`, and the first-signup backfill of null-`user_id` corpora/documents (research.md §3) — depends on T011 failing first, T012 failing first, T007
- [X] T018 [US1] Add `SignupRequest`/`LoginRequest`/`UserResponse`/`AuthResponse` schemas in `backend/app/auth/schemas.py`
- [X] T019 [US1] Implement `backend/app/auth/router.py` — `POST /api/auth/signup`, `/login`, `/logout`; `GET /api/auth/me` (contracts/auth-api.md) — depends on T010 failing first, T017, T018
- [X] T020 [US1] Mount the auth router in `backend/app/main.py`
- [X] T021 [P] [US1] Implement `frontend/src/lib/apiClient.ts` — `apiFetch`, `getStoredToken`/`setStoredToken`, `appendTokenQueryParam`, the 401 signal (research.md §6, contracts/ui-contracts.md) — depends on T013 failing first
- [X] T022 [P] [US1] Implement `frontend/src/lib/authApi.ts` — signup/login/logout/me calls via `apiFetch` — depends on T019, T021
- [X] T023 [US1] Implement `frontend/src/context/AuthContext.tsx` — depends on T014 failing first, T022
- [X] T024 [P] [US1] Implement `frontend/src/components/auth/LoginScreen.tsx` — depends on T015 failing first, T023
- [X] T025 [P] [US1] Implement `frontend/src/components/auth/SignupScreen.tsx` — depends on T016 failing first, T023
- [X] T026 [US1] Update `frontend/src/app/App.tsx` — wrap in `AuthProvider` (outermost); while `isLoading`, render a minimal loading state; render `LoginScreen`/`SignupScreen` when signed out, the existing `CorpusProvider` + screen-switcher unchanged when signed in (contracts/ui-contracts.md) — depends on T023, T024, T025

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Everything requires login, and stays private per account (Priority: P1) 🎯 MVP (with US1)

**Goal**: Every existing backend endpoint requires a valid session and scopes/asserts
ownership by the logged-in user; every existing frontend API module attaches the session
token (including the two SSE streams, via a query parameter).

**Independent Test**: Two accounts, each with their own corpus/documents — confirm neither
can see or reach the other's data (by listing, and by directly requesting the other's IDs),
and that signing out blocks every screen.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T027 [P] [US2] Unit test for `backend/tests/unit/test_auth_dependencies.py` — `require_user` resolves a valid token from either the `Authorization` header or a `token` query parameter to its `User`; raises `401` for a missing, invalid, or revoked token from either source (research.md §5, §9)
- [X] T028 [P] [US2] Unit test for `backend/tests/unit/test_ownership_scoping.py` — across corpora/sources/chunking/embeddings/playground/metrics: a second user's request for the first user's corpus/document/chunk/turn id gets the same `404` used for a nonexistent id (never a distinguishable `403`); every listing endpoint returns only the requesting user's own rows (FR-008, FR-009)
- [X] T029 [P] [US2] Unit test update for `backend/tests/unit/test_corpora_service.py` — corpus name uniqueness is scoped per user (two different users may each have a corpus named the same thing; one user may not have two)
- [X] T030 [P] [US2] Unit test for `backend/tests/unit/test_document_corpus_ownership.py` — attaching a document to a corpus owned by a different user is rejected (research.md §7)
- [X] T031 [P] [US2] Unit test for `frontend/tests/integration/App.auth-gate.test.tsx` — signed-out renders `LoginScreen`/`SignupScreen` and no BYORAG screen is reachable; signed-in renders the existing screen-switcher exactly as before (FR-006)
- [X] T032 [P] [US2] Integration test for `frontend/tests/integration/apiModules.auth-header.test.ts` — one representative existing api module (e.g. `corporaApi.listCorpora`) sends `Authorization: Bearer <token>` end-to-end once refactored to call `apiFetch` (existing frontend tests that stub `global.fetch` directly are expected to keep passing unchanged, since `apiFetch` still calls the same global `fetch` — verify no existing frontend test file needs edits beyond this new one)

### Implementation for User Story 2

- [X] T033 [US2] Implement `backend/app/auth/dependencies.py` — `require_user` FastAPI dependency reading the `Authorization` header or a `token` query parameter (research.md §5, §9) — depends on T027 failing first, T017
- [X] T034 [US2] Add an ownership-assertion lookup alongside the existing `get_corpus_or_none`/`get_document_or_none` in `backend/app/db/lookups.py` (e.g. `get_corpus_owned_by`, `get_document_owned_by` — returns `None` for both "doesn't exist" and "not yours") — depends on T028 failing first
- [X] T035 [US2] Update `backend/app/corpora/service.py` + `router.py` — every function/endpoint requires the current user; list/create/rename/delete scoped and asserted by `user_id`; name-uniqueness check scoped per user (data-model.md) — depends on T029 failing first, T033, T034
- [X] T036 [US2] Update `backend/app/sources/service.py` + `router.py` — every function/endpoint requires the current user; list/upload/delete/attach/unlink scoped and asserted by `user_id`; `attach_document_to_corpus` rejects attaching across a different owner (research.md §7) — depends on T030 failing first, T033, T034
- [X] T037 [US2] Update `backend/app/chunking/router.py`, `embeddings/router.py`, `playground/router.py`, `metrics/router.py`, and `system/router.py` — every endpoint requires the current user via `require_user`; underlying service calls scoped/asserted by `user_id` — depends on T028 failing first, T033, T034
- [X] T038 [US2] Update `backend/tests/conftest.py` — the `client` fixture becomes authenticated by default: it creates a test user directly via `auth_service.create_user`/`create_session` against `db_session` (bypassing a live HTTP round-trip and bcrypt's deliberate slowness in test setup) and wraps `TestClient` so every request automatically carries `Authorization: Bearer <token>`; add a new `anonymous_client` fixture (a plain, unauthenticated `TestClient`) for the handful of tests that specifically assert `401`-without-auth behavior; update the `corpus_id` fixture to use the (now-authenticated) `client`. This keeps the large majority of existing backend tests passing with no per-file changes, since they already request the `client` fixture by name — depends on T019, T033
- [X] T039 [P] [US2] Update `frontend/src/lib/corporaApi.ts`, `sourcesApi.ts`, `chunkingApi.ts`, `embeddingsApi.ts`, `playgroundApi.ts`, `metricsApi.ts` (and any other direct `fetch` callers) to call `apiFetch` instead of the global `fetch`; `chunkingApi.ts`/`embeddingsApi.ts`'s `EventSource` URL construction uses `appendTokenQueryParam` (research.md §5, §6) — depends on T032 failing first, T021

**Checkpoint**: User Stories 1 and 2 together are the MVP — the app is fully multi-user, gated, and per-account isolated.

---

## Phase 5: User Story 3 - Uploaded PDFs live in the database, not on local disk (Priority: P2)

**Goal**: A document's PDF content is stored in `Document.content` (Foundational, T005)
instead of the local filesystem; every existing capability that reads it keeps working
unchanged from the user's point of view.

**Independent Test**: Upload a PDF, restart the backend process, confirm the document still
previews, chunks, and in-context-previews correctly with nothing left over on local disk.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T040 [P] [US3] Unit test update for `backend/tests/unit/test_sources_service_corpus_links.py` (and sibling existing sources unit tests) — `save_file` stores the uploaded bytes in `Document.content` rather than writing to `pdfs_dir`; the file-reading helper returns bytes; `delete_documents`/`unlink_document_from_corpus` no longer touch the local filesystem at all (research.md §8)
- [X] T041 [P] [US3] Unit test update for `backend/tests/unit/test_chunking_service.py` — `extract_text_pages` accepts `bytes` (wrapped in `io.BytesIO`) instead of a `Path`, and every existing caller in `chunking/service.py` (`_stream_chunk_computation`, `compute_structured_preview`) is updated to pass `document.content` instead of `Path(document.storage_path)`
- [X] T042 [P] [US3] Contract test update for `backend/tests/contract/` covering `GET /api/sources/{id}/file` — still returns the same PDF bytes and `application/pdf` content type as before, now sourced from the database
- [X] T043 [P] [US3] Integration test for `backend/tests/integration/test_pdf_survives_restart.py` — upload a document, drop any reference to a local file path entirely (e.g. delete the test's `pdfs_dir` after upload), confirm preview/chunking/structured-preview still succeed purely from `Document.content` (SC-004)

### Implementation for User Story 3

- [X] T044 [US3] Update `backend/app/chunking/service.py`'s `extract_text_pages` to accept `bytes` and wrap in `io.BytesIO` for `pypdf.PdfReader`; update its callers (`_stream_chunk_computation`, `compute_structured_preview`) to pass `document.content` (research.md §8) — depends on T041 failing first
- [X] T045 [US3] Rewrite `backend/app/sources/service.py` — `save_file` writes into `Document.content` instead of the local `pdfs_dir`; the file-reading helper reads `Document.content` directly; `delete_documents`/`unlink_document_from_corpus` drop their local-file-unlink steps entirely (research.md §8) — depends on T040 failing first, T044
- [X] T046 [US3] Update `backend/app/sources/router.py`'s `GET /{document_id}/file` endpoint — switch from `FileResponse` to `Response(content=..., media_type="application/pdf")` (research.md §8) — depends on T042 failing first, T045

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all three stories

- [X] T047 [P] Run every scenario in `specs/024-user-authentication/quickstart.md` end-to-end against the running stack
- [X] T048 Run the full backend (`pytest`) and frontend (`vitest run`) suites once more to confirm no regressions across all three stories
- [X] T049 [P] Update `README.md`'s "Running the app" section (env vars, setup steps) to describe signing up/logging in and to remove the now-inaccurate `PDFS_DIR`-centric local-storage instructions, closing the gap flagged when the constitution was amended for this feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (needs `bcrypt` installed before any auth code, though the schema itself doesn't need it — sequenced first regardless for simplicity) — BLOCKS all three user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational **and** User Story 1 (needs the auth service/router — `create_session`/`resolve_session`, `POST /api/auth/login` — to exist before "require a valid session" is meaningful; needs `apiClient.ts` from US1 before existing frontend modules can be refactored to use it)
- **User Story 3 (Phase 5)**: Depends on Foundational only (the `Document.content` column) — independent of US1/US2 in principle, though practically built after them
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on User Story 2 or 3
- **User Story 2 (P1)**: Depends on User Story 1 (see above) — the two ship together as the MVP
- **User Story 3 (P2)**: No dependency on User Story 1 or 2

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- US1: service before router (T017 before T019), router before frontend api client usage (T019 before T022), api client before context (T021/T022 before T023), context before screens (T023 before T024/T025), screens before App wiring (T024/T025 before T026)
- US2: dependency + lookup helper before every router update (T033/T034 before T035/T036/T037), auth router (US1) before the test-fixture auto-auth change (T019 before T038), api client (US1) before the existing-module refactor (T021 before T039)
- US3: `extract_text_pages` change before `sources/service.py`'s rewrite (T044 before T045), service rewrite before the router's response-type change (T045 before T046)
- Story complete before moving to the next phase

### Parallel Opportunities

- Foundational: T002 and T003 run in parallel (different models, same file — coordinate if working simultaneously); T006 is standalone
- US1: T010–T016 (all tests) run in parallel with each other; T021 runs in parallel with the backend-side T017–T020 chain (different codebases); T024 and T025 run in parallel with each other
- US2: T027–T032 (all tests) run in parallel with each other; T039 runs in parallel with the backend-side T033–T038 chain
- US3: T040–T043 (all tests) run in parallel with each other
- US1 and US3 could be implemented in parallel by different developers once Foundational is done (no shared files) — US2 cannot start until US1's auth service/router exist

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for backend/tests/contract/test_auth_api.py"
Task: "Unit test for backend/tests/unit/test_auth_service.py"
Task: "Integration test for backend/tests/integration/test_first_signup_backfill.py"
Task: "Unit test for frontend/tests/unit/apiClient.test.ts"
Task: "Unit test for frontend/tests/unit/AuthContext.test.tsx"
Task: "Unit test for frontend/tests/unit/LoginScreen.test.tsx"
Task: "Unit test for frontend/tests/unit/SignupScreen.test.tsx"

# Once backend tests are failing, implement the backend chain in order:
Task: "Implement backend/app/auth/service.py"
Task: "Add schemas in backend/app/auth/schemas.py"
Task: "Implement backend/app/auth/router.py"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 together)

1. Complete Phase 2: Foundational
2. Complete Phase 3: User Story 1
3. Complete Phase 4: User Story 2
4. **STOP and VALIDATE**: Confirm sign-up/login/logout works, and that a second account
   cannot see or reach the first account's data anywhere in the app
5. Deploy/demo if ready — this is the actual point of the feature (spec.md: "This is the
   actual point of adding authentication")

### Incremental Delivery

1. Foundational → User Story 1 → test independently
2. Add User Story 2 → test independently → deploy/demo (MVP!)
3. Add User Story 3 → test independently → deploy/demo
4. Each story adds value without breaking the others

### Parallel Team Strategy

Once Phase 2 (Foundational) is done:
- Developer A: User Story 1, then User Story 2 (sequential — US2 depends on US1)
- Developer B: User Story 3 (fully independent, can start immediately alongside A)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- This feature's security-sensitive surface (password hashing, session validation,
  cross-account access denial) warrants extra scrutiny during review — treat T011, T027,
  and T028 as the highest-value tests in the whole feature.

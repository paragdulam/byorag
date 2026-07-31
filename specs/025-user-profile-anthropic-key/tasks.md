---

description: "Task list for User Profile & Personal Anthropic API Key"
---

# Tasks: User Profile & Personal Anthropic API Key

**Input**: Design documents from `/specs/025-user-profile-anthropic-key/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level),
tests are NON-NEGOTIABLE and are included below for every user story at the appropriate
level(s) — backend unit/contract/integration (pytest) and frontend unit (vitest) / e2e
(Playwright), matching this repo's existing test-directory conventions.

**Organization**: Tasks are grouped by user story (spec.md priorities: US1, US2 both P1;
US3 P2) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes exact file path(s)

## Path Conventions

Existing web-app split (plan.md Project Structure): `backend/app/`, `backend/tests/{unit,contract,integration}/`, `frontend/src/`, `frontend/tests/{unit,integration,e2e}/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and configuration every later task needs available.

- [X] T001 Add `cryptography>=43` to `backend/pyproject.toml` dependencies (research.md §1)
- [X] T002 [P] Add `key_encryption_secret` (from `KEY_ENCRYPTION_SECRET` env var) to `Settings` in `backend/app/config.py`, and add `KEY_ENCRYPTION_SECRET: ${KEY_ENCRYPTION_SECRET:-}` to the `backend` service's `environment` block in `docker-compose.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The Profile section's backend and frontend skeleton that every user story adds content into.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Create the `backend/app/profile/` package (`__init__.py`, `router.py` with an `APIRouter(prefix="/api/profile", tags=["profile"])` and no routes yet, empty `service.py`, empty `schemas.py`) and register `profile_router` in `backend/app/main.py` alongside the other `app.include_router(...)` calls
- [X] T004 [P] Add `'profile'` to the `ScreenId` union in `frontend/src/components/layout/SidebarNav.tsx`; create a placeholder `frontend/src/components/profile/ProfileScreen.tsx` (renders a heading only, for now); add a Profile entry point reachable from every screen in `frontend/src/components/layout/TopBar.tsx` (icon button, matching its existing Notifications/Search buttons); wire the `'profile'` screen to render `ProfileScreen` in `frontend/src/app/App.tsx`'s screen-switcher (FR-001)

**Checkpoint**: Profile section exists and is reachable (empty), backend `/api/profile` router is mounted (empty) — user story implementation can now begin.

---

## Phase 3: User Story 1 - View account info and log out (Priority: P1) 🎯 MVP

**Goal**: A logged-in user opens Profile, sees their email and account-creation date, and can log out from there.

**Independent Test**: Log in, open Profile, confirm displayed info matches the account, click Log out, confirm session ends and login screen appears. No dependency on any Anthropic-key work.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> Write these first; confirm they fail before implementing.

- [X] T005 [P] [US1] Contract test: `GET /api/auth/me` response includes `createdAt` in `backend/tests/contract/test_auth_api.py`
- [X] T006 [P] [US1] Unit test: `ProfileScreen` renders the current user's email and `createdAt`, and its Log out button calls `useAuth().logout()` in `frontend/tests/unit/ProfileScreen.test.tsx`
- [X] T007 [P] [US1] E2E test: logged-in user opens Profile, sees their email, clicks Log out, lands back on the login screen in `frontend/tests/e2e/profile.spec.ts`

### Implementation for User Story 1

- [X] T008 [US1] Add `createdAt: str` to `UserResponse` in `backend/app/auth/schemas.py` and populate it from `user.created_at` (ISO-8601) in the `/me` handler in `backend/app/auth/router.py` (also update `_to_auth_response`'s `UserResponse` construction for signup/login consistency)
- [X] T009 [P] [US1] Add `createdAt: string` to the `AuthUser` interface and pass it through in `frontend/src/lib/authApi.ts`
- [X] T010 [US1] Build the account-info section (email, formatted `createdAt`) and a "Log out" button wired to `useAuth().logout()` in `frontend/src/components/profile/ProfileScreen.tsx`, replacing the T004 placeholder (depends on T009)

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable.

---

## Phase 4: User Story 2 - Add or update a personal Anthropic key (Priority: P1)

**Goal**: A logged-in user adds/replaces their own Anthropic API key from Profile; it is live-validated, stored securely, and used for that user's Generation and quality-scoring requests, with Playground/Metrics gated in the nav until a key exists.

**Independent Test**: Add a valid key in Profile → generate an answer in Playground successfully; separately, submit an invalid key and confirm it's rejected and not stored.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

- [X] T011 [P] [US2] Unit tests for `backend/app/profile/service.py`: encrypt/decrypt round-trip returns the original plaintext, masked form shows only the last 4 characters, and `validate_key` maps `anthropic.AuthenticationError` → invalid vs. `anthropic.APIConnectionError`/`APITimeoutError` → unreachable (research.md §1–2) in `backend/tests/unit/test_profile_service.py`
- [X] T012 [P] [US2] Contract tests for `GET`/`PUT /api/profile/anthropic-key`: no key → `hasKey: false`; valid key → `200` with masked form; empty/whitespace key → `422`; Anthropic-rejected key → `400`, previous key (if any) unchanged; Anthropic unreachable → `502` in `backend/tests/contract/test_profile_api.py` (new file)
- [X] T013 [P] [US2] Contract test: `POST /api/playground/turns/{turnId}/generate` returns `400` when the acting user has no key, and succeeds using that user's stored key when one exists, in `backend/tests/contract/test_playground_generate.py`
- [X] T014 [P] [US2] Integration test: `evaluation_service.score_turn` leaves a turn unscored when the acting (owning) user has no key, and scores it using that user's key when one exists, in `backend/tests/integration/test_evaluation_scoring_pipeline.py`
- [X] T015 [P] [US2] Unit test: `AuthContext` fetches `GET /api/profile/anthropic-key` after resolving `currentUser` and exposes `hasAnthropicKey`; `refreshAnthropicKeyStatus()` re-fetches it, in `frontend/tests/unit/AuthContext.test.tsx`
- [X] T016 [P] [US2] Unit test: `SidebarNav` renders Playground and Metrics as `aria-disabled` with an explanatory `title` tooltip when `hasAnthropicKey` is `false`, and enabled/clickable when `true`, in `frontend/tests/unit/SidebarNav.test.tsx` (new file)
- [X] T017 [P] [US2] Unit test: `ProfileScreen`'s key form — empty state submits to `PUT`, success shows the masked value, a `400`/`422`/`502` response renders an inline error without clearing the input, in `frontend/tests/unit/ProfileScreen.test.tsx`

### Implementation for User Story 2

- [X] T018 [P] [US2] Add the `UserAnthropicKey` model (`user_anthropic_keys`: `id`, unique `user_id` FK → `users.id` `ON DELETE CASCADE`, `encrypted_key`, `last_four`, `created_at`, `updated_at`) to `backend/app/db/models.py` (data-model.md)
- [X] T019 [P] [US2] Implement `AnthropicKeyStatus` (`hasKey: bool`, `maskedKey: str | None`) and `SetAnthropicKeyRequest` (`apiKey: str`) in `backend/app/profile/schemas.py`
- [X] T020 [US2] Implement `backend/app/profile/service.py`: Fernet key derivation from `settings.key_encryption_secret` (SHA-256 → urlsafe-base64), `encrypt`/`decrypt`, `mask_key` (last 4 chars), `validate_key(api_key)` (via `client.models.list(limit=1)`, raising typed errors for invalid vs. unreachable), `get_status(db, user_id)`, `upsert_key(db, user_id, api_key)` (validates then upserts), `resolve_decrypted_key(db, user_id) -> str | None` (depends on T018, T019)
- [X] T021 [US2] Implement `GET`/`PUT /api/profile/anthropic-key` in `backend/app/profile/router.py`, mapping service exceptions to `422`/`400`/`502` per contracts/profile-api.md (depends on T020)
- [X] T022 [P] [US2] Add an `api_key: str` parameter to `GenerationProvider.generate` in `backend/app/generation/providers/base.py` and update `AnthropicProvider.generate` in `backend/app/generation/providers/anthropic_provider.py` to build its `Anthropic(api_key=...)` client from the parameter instead of `settings.anthropic_api_key`
- [X] T023 [US2] In `backend/app/playground/service.py::generate_answer`, resolve the acting user's key via `profile.service.resolve_decrypted_key` before calling the provider; raise a new `NoApiKeyError` when none exists; map it to `400` (with a message pointing at Profile) in `backend/app/playground/router.py`'s `generate_answer` handler (depends on T020, T022)
- [X] T024 [P] [US2] Add an `api_key: str` parameter to `EvaluationJudge.score` in `backend/app/evaluation/strategies/base.py` and update `AnthropicJudge.score` in `backend/app/evaluation/strategies/anthropic_judge.py` to use it instead of `settings.anthropic_api_key`
- [X] T025 [US2] In `backend/app/evaluation/service.py::score_turn`, resolve the turn's owning user (`turn.document.user_id if turn.document is not None else turn.corpus.user_id`, mirroring `db/lookups.py::get_conversation_turn_owned_by`), look up their key via `profile.service.resolve_decrypted_key`, and return early (turn stays unscored) if none exists, before calling the judge (depends on T020, T024)
- [X] T026 [US2] Remove the now-dead `anthropic_api_key` setting from `backend/app/config.py` and the `ANTHROPIC_API_KEY` line from the `backend` service's `environment` block in `docker-compose.yml` (research.md §3 — no shared/fallback key remains once T023 and T025 land) (depends on T023, T025)
- [X] T027 [P] [US2] Create `frontend/src/lib/profileApi.ts` with `getAnthropicKeyStatus()` and `setAnthropicKey(apiKey: string)`, following the existing `authApi.ts` request/error-parsing pattern
- [X] T028 [US2] Extend `frontend/src/context/AuthContext.tsx`: add `hasAnthropicKey` (fetched via `profileApi.getAnthropicKeyStatus()` right after `currentUser` resolves, and reset to `false` on logout) and `refreshAnthropicKeyStatus()` to the context value (depends on T027)
- [X] T029 [US2] Update `frontend/src/components/layout/SidebarNav.tsx`: read `hasAnthropicKey` from `AuthContext`; for the `Playground`/`Metrics` `NAV_ITEMS` entries, when `false`, render `aria-disabled="true"`, a muted style, a `title` tooltip ("Add a personal Anthropic key in your Profile to use this."), and skip the `onNavigate` call (depends on T028)
- [X] T030 [US2] Build the Anthropic-key section of `frontend/src/components/profile/ProfileScreen.tsx`: no-key state (input + Save, calling `profileApi.setAnthropicKey`), key-on-file state (masked value + Replace), inline `role="alert"` error display, and a call to `refreshAnthropicKeyStatus()` on every successful save (depends on T027, T028)

**Checkpoint**: User Stories 1 AND 2 both work independently — a user can view/log out, and separately add a key and generate/score with it, with Playground/Metrics gated correctly.

---

## Phase 5: User Story 3 - Delete a personal Anthropic key (Priority: P2)

**Goal**: A logged-in user removes their saved key from Profile; Playground/Metrics become gated again exactly as if no key had ever been saved.

**Independent Test**: Save a key, delete it from Profile, confirm it's gone (even masked) and that Playground/Metrics are disabled again, and a subsequent generation attempt is blocked the same as a user who never had a key.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

- [X] T031 [P] [US3] Contract test: `DELETE /api/profile/anthropic-key` removes the key (subsequent `GET` shows `hasKey: false`) and returns `204` even when no key exists (idempotent), in `backend/tests/contract/test_profile_api.py`
- [X] T032 [P] [US3] Contract test: `POST /api/playground/turns/{turnId}/generate` returns `400` again after the key is deleted — never falling back to any other key — in `backend/tests/contract/test_playground_generate.py`
- [X] T033 [P] [US3] Unit test: `ProfileScreen`'s Delete button removes the stored key, returns the UI to the empty-state form, and calls `refreshAnthropicKeyStatus()`, in `frontend/tests/unit/ProfileScreen.test.tsx`
- [X] T034 [P] [US3] E2E test: add a key (Playground/Metrics become enabled) → delete it (Playground/Metrics disabled again with tooltip), in `frontend/tests/e2e/profile.spec.ts`

### Implementation for User Story 3

- [X] T035 [US3] Implement `delete_key(db, user_id)` in `backend/app/profile/service.py` (removes the `UserAnthropicKey` row if present; no-op otherwise) (depends on T020)
- [X] T036 [US3] Implement `DELETE /api/profile/anthropic-key` (`204`, always) in `backend/app/profile/router.py` (depends on T035)
- [X] T037 [P] [US3] Add `deleteAnthropicKey()` to `frontend/src/lib/profileApi.ts`
- [X] T038 [US3] Add a Delete button (with a confirm step, matching this app's existing destructive-action pattern) to `frontend/src/components/profile/ProfileScreen.tsx`'s key section, calling `profileApi.deleteAnthropicKey()` then `refreshAnthropicKeyStatus()` (depends on T037, T030)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T039 [P] Update `README.md`'s tech-stack/env-var documentation: add `KEY_ENCRYPTION_SECRET`, remove the now-inaccurate description of a shared `ANTHROPIC_API_KEY` used for Generation, and note that each user supplies their own Anthropic key via Profile
- [X] T040 Run every scenario in `quickstart.md` end-to-end against a local stack and fix any gaps found — validated via the automated suite (backend contract/unit/integration tests with mocked Anthropic responses + Playwright e2e against a real running stack, PUT route-mocked per tests/e2e/playground.spec.ts's existing convention). The literal steps that need a **real** Anthropic API key (US2 steps 4–7's live `models.list`/generation calls) were not run against the actual Anthropic API in this environment — see completion report.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–5)**: All depend on Foundational completion.
  - US1 (T005–T010) has no dependency on US2 or US3 — can be built, tested, and demoed alone.
  - US2 (T011–T030) has no dependency on US1's tasks completing, only on Foundational — can proceed in parallel with US1 if staffed, though both are P1 so sequential (US1 then US2) is the default reading order below.
  - US3 (T031–T038) depends on US2's `ProfileScreen` key section (T030) and `profile/service.py` (T020) existing to extend — build after US2.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Tests are written first and MUST fail before their corresponding implementation task.
- Backend: model → schemas → service → router, mirroring T018→T019→T020→T021.
- Provider/judge signature changes (T022, T024) are independent of the profile service itself and of each other — both `[P]`.
- Frontend: API client → context → nav/screen consumers, mirroring T027→T028→(T029, T030).

### Parallel Opportunities

- T001 and T002 (Setup) — different files.
- T003 and T004 (Foundational) — backend vs. frontend, different files.
- All `[P]` test tasks within a story phase (e.g., T011–T017) — different files, no shared dependencies.
- T018, T019, T022, T024 (US2 implementation) — four independent files, none depending on the others.
- T027 (US2) and T037 (US3, once reached) — independent additions to the same `profileApi.ts` file are sequential in practice (US3 extends the file US2 creates), so only T027 is marked `[P]` within its own phase.

---

## Parallel Example: User Story 2

```bash
# Tests, launched together:
Task: "Unit tests for profile/service.py encryption + validation in backend/tests/unit/test_profile_service.py"
Task: "Contract tests for GET/PUT /api/profile/anthropic-key in backend/tests/contract/test_profile_api.py"
Task: "Contract test: generate blocked/succeeds based on key in backend/tests/contract/test_playground_generate.py"
Task: "Integration test: score_turn skip/succeed based on key in backend/tests/integration/test_evaluation_scoring_pipeline.py"
Task: "Unit test: AuthContext hasAnthropicKey in frontend/tests/unit/AuthContext.test.tsx"
Task: "Unit test: SidebarNav gating in frontend/tests/unit/SidebarNav.test.tsx"
Task: "Unit test: ProfileScreen key form in frontend/tests/unit/ProfileScreen.test.tsx"

# Independent implementation files, launched together:
Task: "UserAnthropicKey model in backend/app/db/models.py"
Task: "profile schemas in backend/app/profile/schemas.py"
Task: "api_key param on GenerationProvider/AnthropicProvider"
Task: "api_key param on EvaluationJudge/AnthropicJudge"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Profile viewing + logout works end-to-end on its own
5. Deploy/demo if ready — this alone already improves on today (no in-app logout exists yet)

### Incremental Delivery

1. Setup + Foundational → Profile section exists, empty
2. Add US1 → view info + log out → validate → demo
3. Add US2 → bring-your-own-key for Generation + Metrics scoring, with nav gating → validate → demo (this is the feature's core ask)
4. Add US3 → delete key → validate → demo
5. Polish → docs + full quickstart pass

### Parallel Team Strategy

1. Team completes Setup + Foundational together (T001–T004).
2. Developer A takes US1 (small, backend field + frontend display).
3. Developer B starts US2's backend (T018–T026) while Developer C starts US2's frontend
   (T027–T030) against the contracts/ documents — they only need to agree on the
   `/api/profile/anthropic-key` shape already fixed in contracts/profile-api.md.
4. US3 starts once US2's `ProfileScreen` and `profile/service.py` land.

# Implementation Plan: User Profile & Personal Anthropic API Key

**Branch**: `025-user-profile-anthropic-key` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-user-profile-anthropic-key/spec.md`

## Summary

Add a Profile section (account info + logout) reachable from anywhere in the app, and let
each logged-in user add/update/delete their own personal Anthropic API key. Once a user
has a key, it — not any shared server key — is used for both their Playground answer
generation and their Metrics quality scoring; without one, Playground and Metrics stay
disabled in the nav with an explanatory tooltip, and the corresponding backend requests are
rejected. Keys are live-validated against Anthropic at save time and stored encrypted
(reversibly — they must be decrypted to call Anthropic on the user's behalf), never
returned in full once saved.

## Technical Context

**Language/Version**: Python 3.12 (backend, existing), TypeScript + React 19 (frontend,
existing) — no new language/runtime.

**Primary Dependencies**: FastAPI, SQLAlchemy 2.0, psycopg3, the `anthropic` SDK
(`>=0.40`, already a dependency — `client.models.list()` used for live key validation,
research.md §2), `bcrypt` (existing, unrelated to this feature). **New**: `cryptography`
(`Fernet`) for reversible at-rest encryption of the stored key (research.md §1) — no other
new dependency, frontend or backend.

**Storage**: PostgreSQL (existing, `Base.metadata.create_all` — this repo has no migration
tool, data-model.md's new `user_anthropic_keys` table is added the same way every other
table was).

**Testing**: `pytest` + `httpx` (backend, existing pattern — unit tests for
encryption/validation helpers, integration tests for the new router and the changed
generate/score-turn behavior); `vitest` + `@testing-library/react` (frontend, existing
pattern — `ProfileScreen`, `SidebarNav` gating, `AuthContext` additions).

**Target Platform**: Linux server via Docker/docker-compose (existing, unchanged).

**Project Type**: Web application (frontend + backend) — Option 2 structure below.

**Performance Goals**: None beyond existing interactive-UI expectations; key validation
latency is bounded by Anthropic's own API response time for `models.list`, not a new SLA
this feature introduces.

**Constraints**: No shared/server-default key may be used as a fallback for Generation or
quality scoring once this ships (FR-013, FR-017) — `settings.anthropic_api_key` /
`ANTHROPIC_API_KEY` become dead code and are removed, not left as an unused fallback. The
plaintext key must never appear in an API response after the moment it's first saved
(FR-010).

**Scale/Scope**: One optional `UserAnthropicKey` row per existing `User` row — no new
scale dimension beyond the current user base.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture** — PASS. `GenerationProvider.generate` and
  `EvaluationJudge.score` gain an `api_key` parameter (research.md §3, §4) but remain
  registered/swappable via `GENERATION_PROVIDERS`/`JUDGES` exactly as today; no
  hardcoded branching added.
- **II. Test-First, Test at Every Level** — PASS (enforced at task-breakdown time,
  `/speckit-tasks`). New service logic (encryption, validation, key resolution) needs unit
  tests; new router endpoints and the changed generate/score-turn paths need integration
  tests; new frontend components/gating need component tests — same bar as every prior
  feature.
- **III. Multi-User Simplicity (Right-Sized Complexity)** — PASS. The key is strictly
  per-user (unique `user_id`, data-model.md), with no sharing, roles, or admin oversight
  introduced — a direct, non-speculative extension of the existing per-user ownership
  model, not new complexity beyond what the spec asks for.
- **IV. Fixed Technology Stack** — PASS, no amendment needed. Frontend, backend, vector
  store, relational database, and deployment model are all unchanged. Adding
  `cryptography` is an ordinary library dependency for an implementation concern (like
  `bcrypt` for password hashing in 024-user-authentication), not a change to any of the
  stack choices Principle IV actually fixes (framework/language/vector DB/relational
  DB/containerization).
- **V. Experiment Observability & Reproducibility** — PASS. Quality-scoring
  configuration/traceability (judge, model, aggregation) is unchanged; only the credential
  source used to produce a score changes, and a turn that goes unscored for lack of a key
  is already a state the aggregation logic (`aggregate_pipeline_scores`) handles today
  (excluded from aggregates, not a zero).

No violations — Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/025-user-profile-anthropic-key/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── profile-api.md
│   └── ui-contracts.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── profile/                              # NEW package
│   │   ├── router.py                         # GET/PUT/DELETE /api/profile/anthropic-key
│   │   ├── service.py                        # encrypt/decrypt, upsert, live validation, key resolution
│   │   └── schemas.py                        # AnthropicKeyStatus, SetAnthropicKeyRequest
│   ├── auth/
│   │   ├── router.py                         # /me gains createdAt (contracts/profile-api.md)
│   │   └── schemas.py                        # UserResponse gains createdAt
│   ├── db/
│   │   └── models.py                         # + UserAnthropicKey (data-model.md)
│   ├── generation/
│   │   └── providers/
│   │       ├── base.py                       # GenerationProvider.generate gains api_key
│   │       └── anthropic_provider.py         # builds Anthropic(api_key=...) from the param
│   ├── evaluation/
│   │   ├── service.py                        # score_turn resolves owner's key, no-ops without one
│   │   └── strategies/
│   │       ├── base.py                       # EvaluationJudge.score gains api_key
│   │       └── anthropic_judge.py
│   ├── playground/
│   │   ├── router.py                         # maps NoApiKeyError → 400
│   │   └── service.py                        # generate_answer resolves acting user's key first
│   └── config.py                             # + key_encryption_secret; − anthropic_api_key (dead code removed)
└── tests/
    ├── unit/                                 # profile/service.py encryption + validation-error mapping
    └── integration/                          # profile router; playground generate without/with key; score_turn skip behavior

frontend/
├── src/
│   ├── components/
│   │   ├── profile/                          # NEW
│   │   │   └── ProfileScreen.tsx
│   │   └── layout/
│   │       └── SidebarNav.tsx                # Playground/Metrics disabled + tooltip when no key
│   ├── context/
│   │   └── AuthContext.tsx                   # + hasAnthropicKey, refreshAnthropicKeyStatus
│   ├── lib/
│   │   ├── profileApi.ts                     # NEW — GET/PUT/DELETE /api/profile/anthropic-key
│   │   └── authApi.ts                        # AuthUser gains createdAt
│   └── app/
│       └── App.tsx                           # ScreenId 'profile' → ProfileScreen
└── src/**/*.test.tsx                         # existing co-located test convention
```

**Structure Decision**: Existing `backend/` + `frontend/` split (Option 2 — this repo has
had both since before 024-user-authentication). This feature adds one new backend package
(`app/profile/`) and one new frontend feature folder (`components/profile/`), following
the same one-package-per-concern convention as `app/playground/`, `app/evaluation/`, and
`components/auth/`; every other touched file is an existing module gaining a parameter or
a field, not a new architectural seam.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*

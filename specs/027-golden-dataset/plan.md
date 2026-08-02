# Implementation Plan: Golden Dataset Creation (Manual & LLM-Generated)

**Branch**: `027-golden-dataset` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/027-golden-dataset/spec.md`

## Summary

Add a per-corpus Golden Dataset: reference records of question + evidence-chunk-snapshots +
preferred-answer, created either by a subject-matter expert (mandatory evidence-chunk selection
from a merged, labeled question-search + answer-search candidate list) or by an LLM (single or
batch, always landing in `pending_review` until a human approves via the same shared editor).

Technical approach: entirely additive — one new backend module (`backend/app/golden_dataset/`)
and two new database tables, both built entirely on top of infrastructure that already exists and
is not otherwise modified: the registered BERT embedding model (`EMBEDDING_MODELS["bert"]`) to
embed question/answer text, the registered cosine-similarity retrieval strategy
(`RETRIEVAL_STRATEGIES["cosine-similarity"]`) called twice per candidate search (once per query
text) with results merged via Reciprocal Rank Fusion, and the registered Anthropic generation
provider (`GENERATION_PROVIDERS["anthropic"]`) for both answer-drafting and synthetic
question/answer generation — the same per-user-API-key call shape Playground's `generate_answer`
already uses. Batch generation is a client-side sequential loop (`frontend/src/lib/batchRunner.ts`,
already used for embeddings' Entire-Corpus flow) calling the single-entry-generation endpoint
repeatedly — no new server-side batch/streaming infrastructure is needed. The two new tables need
no migration script: this codebase creates tables via `Base.metadata.create_all` on startup, which
only ever creates missing tables, so purely-additive schema changes (unlike this feature) require
nothing beyond the new SQLAlchemy model classes.

## Technical Context

**Language/Version**: Python 3.12 (backend, `uv`-managed), TypeScript ~6.0.2 / React 19.2.7
(frontend, Vite)

**Primary Dependencies**: FastAPI, SQLAlchemy, `pgvector` (backend, all already in use) —
reusing the existing `EMBEDDING_MODELS`, `RETRIEVAL_STRATEGIES`, and `GENERATION_PROVIDERS`
registries as-is; `anthropic` SDK (already in use, via the existing `AnthropicProvider`); React 19
(frontend, already in use, reusing the existing checkbox-multi-select and expand/collapse chunk-list
idioms). No new dependencies.

**Storage**: PostgreSQL — two new tables (`golden_dataset_entries`, `golden_dataset_entry_chunks`),
created automatically by `Base.metadata.create_all` on next backend startup; no migration script
needed since neither table nor any existing table's schema is altered.

**Testing**: pytest (`backend/tests/contract`, `backend/tests/unit`), Vitest
(`frontend/tests/unit`, `frontend/tests/integration`), Playwright (`frontend/tests/e2e`) — matches
existing project conventions.

**Target Platform**: Browser frontend + local Docker-composed backend (per constitution's fixed
stack) — no new infrastructure.

**Project Type**: Web application (existing `backend/` + `frontend/` split, both touched).

**Performance Goals**: Manual-entry candidate search (two cosine searches + RRF merge) should feel
like an ordinary Playground turn — dominated by the same BERT-embedding cost Playground already
pays per query, no new latency class introduced. Batch generation has no strict latency target
beyond "runs sequentially with visible per-item progress, one entry's failure doesn't block the
rest" (spec FR-010b) — matches `runSequentialBatch`'s existing behavior verbatim.

**Constraints**: No new dependencies; only the existing `"cosine-similarity"` retrieval strategy is
used (spec Assumptions — a different similarity approach could be swapped in later without a
redesign, but none is built now); every generation call (answer-drafting, synthetic question/answer
generation) requires the corpus owner's own Anthropic key, resolved the same way
`playground/service.py::generate_answer` already does — the "Golden Dataset" nav entry should be
gated behind `hasAnthropicKey` the same way Playground/Metrics already are; evidence chunk
snapshots use `ondelete="CASCADE"` on their document link (not the softer `SET NULL` pattern
`ConversationTurnChunk` uses) because spec FR-019 requires golden entries to be deleted, not
orphaned, when their source document is deleted.

**Scale/Scope**: One new backend module (router/schemas/service, no `strategies/` subfolder needed
— cosine-only for this version), two new tables, 8 new endpoints (candidate search, draft-answer,
create/list/get/update/delete entry, single-entry generation); one new frontend screen plus a
shared entry-editor component, a review-queue list, and batch-generation progress UI reusing the
existing `batchRunner.ts`. No changes to `embeddings/`, `retrieval/`, or `generation/` modules
themselves — pure consumption of their existing registries.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: PASS. Candidate search and generation are built entirely on
  the existing `EMBEDDING_MODELS`/`RETRIEVAL_STRATEGIES`/`GENERATION_PROVIDERS` registries — no
  hardcoded branching around a strategy choice is introduced. Resolving always to
  `"cosine-similarity"` for now is the same pattern Playground itself already uses
  (`DEFAULT_RETRIEVAL_STRATEGY`), not a new violation, and the registry remains swappable for a
  future similarity approach without touching this feature's surrounding code.
- **II. Test-First, Test at Every Level**: PASS (commitment carried into tasks.md). Backend:
  contract tests for all 8 endpoints, unit tests for the RRF-merge function and the cascade-delete
  behavior. Frontend: unit tests for the shared entry editor, the checkbox candidate list, and the
  batch-review queue; an integration test for the full manual-creation flow; an e2e test covering
  manual creation, single LLM generation + approval, and a small batch generation end-to-end.
- **III. Multi-User Simplicity (Right-Sized Complexity)**: PASS. Golden dataset entries follow the
  exact same per-corpus, single-owner scoping as every other entity in this codebase — no new
  sharing, roles, or permissions concept. The "human approval" requirement (spec FR-011) is
  satisfied by the corpus's single owner reviewing their own generated entries — there is no
  multi-reviewer/approval-chain concept, consistent with this app having no multi-user
  collaboration within one corpus.
- **IV. Fixed Technology Stack**: PASS. No new libraries, frameworks, or infrastructure — reuses
  FastAPI, SQLAlchemy, pgvector, the Anthropic SDK, and React, all already integrated.
- **V. Experiment Observability & Reproducibility**: PASS, and this feature directly advances this
  principle — a golden dataset is itself a durable, reproducible reference (question + evidence +
  answer, snapshotted so it survives re-chunking) that future experiment comparisons can be
  measured against. Actually wiring that comparison into Metrics' scoring is explicitly deferred
  (spec Assumptions) but this feature's data model is what makes that future wiring possible.

No violations. Complexity Tracking is not needed.

**Post-Phase 1 re-check**: Design artifacts (research.md, data-model.md, contracts/) introduce no
new dependencies, no changes to existing modules' internals, and no schema changes beyond two new,
purely-additive tables. All five gates remain PASS with no changes to the assessment above.

## Project Structure

### Documentation (this feature)

```text
specs/027-golden-dataset/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── golden_dataset/                  # NEW module, flat layout matching corpora/playground
│   │   ├── __init__.py
│   │   ├── router.py                    # APIRouter(prefix="/api/golden-dataset", ...), 8 endpoints
│   │   ├── schemas.py                   # Pydantic request/response models
│   │   └── service.py                   # candidate search + RRF merge, CRUD, generation, cascade
│   ├── db/
│   │   └── models.py                    # + GoldenDatasetEntry, GoldenDatasetEntryChunk
│   └── main.py                          # + include_router(golden_dataset_router)
└── tests/
    ├── contract/
    │   └── test_golden_dataset_api.py   # NEW — all 8 endpoints
    └── unit/
        ├── test_golden_dataset_rrf.py   # NEW — merge/rank-fusion math
        └── test_golden_dataset_cascade.py  # NEW — document-delete cascades entries; corpus-delete
                                          #        cascades corpus-only entries (research.md §6)

frontend/
├── src/
│   ├── components/
│   │   ├── golden-dataset/                       # NEW
│   │   │   ├── GoldenDatasetScreen.tsx           # list + filters + "+ New Entry" split button
│   │   │   ├── GoldenEntryEditor.tsx             # shared editor: question, answer, chunk picker
│   │   │   ├── EvidenceChunkPicker.tsx           # checkbox candidate list w/ matched-via badges
│   │   │   ├── GoldenReviewQueue.tsx             # pending-review list, approve/reject actions
│   │   │   └── BatchGenerationProgress.tsx       # wraps batchRunner.ts for this feature's entries
│   │   └── layout/
│   │       └── SidebarNav.tsx                    # + 'golden-dataset' ScreenId/nav item
│   ├── app/
│   │   └── App.tsx                               # + ternary branch for the new screen
│   └── lib/
│       └── goldenDatasetApi.ts                   # NEW — typed fetch wrappers for the 8 endpoints
└── tests/
    ├── unit/
    │   ├── GoldenEntryEditor.test.tsx            # NEW
    │   ├── EvidenceChunkPicker.test.tsx           # NEW
    │   └── GoldenReviewQueue.test.tsx             # NEW
    ├── integration/
    │   └── GoldenDatasetScreen.test.tsx           # NEW — manual-creation flow end-to-end (mocked API)
    └── e2e/
        └── golden-dataset.spec.ts                 # NEW — manual + single-generate + batch, real stack
```

**Structure Decision**: Existing `backend/` + `frontend/` web-application split, unchanged. One new
backend module (flat layout, no `strategies/` subfolder — cosine-only for this version), two new
model classes appended to the existing `models.py`, one router registered in `main.py`. One new
frontend feature directory plus small additions to the existing nav/routing files. No existing
module's internals (`embeddings/`, `retrieval/`, `generation/`, `playground/`) are modified — this
feature only calls into their already-public registries/services.

## Complexity Tracking

*No violations — table not needed.*

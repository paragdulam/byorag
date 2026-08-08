# Implementation Plan: UI/UX Polish Across Corpora, Sources, Chunking, Embeddings, Vector View, and Playground

**Branch**: `033-ui-ux-polish` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/033-ui-ux-polish/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Six independent UI/UX changes, one per screen. Two of them (US1, US6) carry real weight beyond
styling: US1 changes the corpus↔document relationship from many-to-many to one-to-many (a schema
migration, plus removal of the now-meaningless "attach document to another corpus" feature) so
that a Corpora-screen delete action can be unconditionally destructive instead of ambiguous; US6
changes the Playground's answer-generation prompt so the LLM emits inline citation markers tied
to specific retrieved chunks, which the frontend renders as clickable info icons. US2–US5 are
layout/typography-only. US3's chunk "Copy Link" reuses the chunk deep-link already built in
032-deep-linking/034 — no new routing work.

## Technical Context

**Language/Version**: TypeScript 5 / React 19 (frontend); Python 3.12 (backend)

**Primary Dependencies**: React 19, Vite, react-router (existing, from 032-deep-linking); FastAPI/SQLAlchemy (backend, existing); Anthropic SDK (existing `GenerationProvider`). No new frontend or backend dependencies — the Actions popover and both modals are built from this repo's existing patterns (see research.md).

**Storage**: PostgreSQL — one migration: `documents.corpus_id` becomes a direct, required foreign key (replacing the `document_corpora` many-to-many join table) per US1/FR-001.

**Testing**: Vitest (unit/integration) + Playwright (e2e) for the frontend; pytest for the backend migration/service/router changes — matching every prior feature in this repo.

**Target Platform**: Web (existing Vite-built React SPA + FastAPI backend, unchanged deployment)

**Project Type**: Web application (existing `frontend/` + `backend/` split)

**Performance Goals**: No new performance requirements; citation-marker parsing and popover rendering are synchronous, client-side, and operate on already-loaded turn data.

**Constraints**: Citation generation MUST stay provider-agnostic (Principle I) — achieved by changing only the shared prompt template in `app/playground/service.py`, not the `GenerationProvider` protocol, so any current or future provider produces the same marker syntax. The corpus/document migration MUST resolve existing multi-corpus document rows deterministically (research.md §1) since the schema no longer allows a document to belong to more than one corpus.

**Scale/Scope**: 6 screens touched (5 frontend-only, 1 — Corpora/Sources — with a backend schema + endpoint change); 2 new reusable frontend primitives (a dismiss-on-outside-click popover hook, and a second modal instance reusing the existing `ComparisonModal` dialog pattern).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture** — Citation markers are produced by changing the shared prompt
  template (`app/playground/service.py`), which every `GenerationProvider` already consumes
  identically (confirmed: `GenerationProvider.generate(prompt, api_key) -> GenerationResult(model,
  answer)` is provider-agnostic today, per `backend/app/generation/providers/base.py`). No
  provider-specific citation logic is introduced, and the `answer` field's shape (plain string)
  doesn't change — only its *content* gains inline markers. Pass.
- **II. Test-First, Test at Every Level** — Plan requires unit tests (typography audit
  assertions, citation-marker parsing, popover dismiss behavior), integration tests (document
  delete cascade, corpus/document one-to-many enforcement, chunk copy-link), and e2e tests
  (delete-with-confirmation flow, citation-to-chunk-modal flow) before/alongside implementation,
  per this repo's established pattern. Pass (enforced in `/speckit-tasks`).
- **III. Multi-User Simplicity** — No cross-account sharing introduced or removed; the
  many-to-many → one-to-many change is *within* a single owning account's documents/corpora, not
  a multi-user concern. Pass.
- **IV. Fixed Technology Stack** — No change to React/Python/Qdrant/PostgreSQL/Docker. The
  corpus/document relationship change is a schema migration *within* the existing PostgreSQL
  database, not a stack change. Pass.
- **V. Experiment Observability & Reproducibility** — Citation markers *improve* traceability
  (each answer segment now traceable to the specific chunk that produced it) rather than
  weakening it. Pass.

No violations requiring Complexity Tracking justification.

## Project Structure

### Documentation (this feature)

```text
specs/033-ui-ux-polish/
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
├── app/db/models.py               # Document/DocumentCorpus -> Document.corpus_id (FK, one-to-many);
│                                     drop DocumentCorpus/document_corpora table
├── app/db/migrations/              # new Alembic-style migration (or equivalent already used here)
├── app/sources/
│   ├── router.py                   # remove POST /{id}/corpora, DELETE /{id}/corpora/{corpus_id};
│   │                                  reuse existing POST /api/sources/delete for the new
│   │                                  Corpora-screen delete action
│   └── service.py                  # remove attach_document_to_corpus/unlink_...; content-hash
│                                     dedup uniqueness moves from (user, hash) to (user, corpus, hash)
├── app/corpora/                    # deletion stays RESTRICT-while-non-empty (unchanged) — now
│                                     naturally satisfied by deleting every document first
└── app/playground/service.py       # shared prompt template gains citation-marker instructions
                                      (FR-020) — no change to generation/providers/*

frontend/
├── src/
│   ├── router/urlScheme.ts         # unchanged — buildChunkingChunkLink already exists (034)
│   ├── hooks/
│   │   └── useClickOutside.ts      # NEW — small reusable hook for the Actions popover (FR-016)
│   ├── components/
│   │   ├── shared/
│   │   │   └── ConfirmModal.tsx    # NEW — reuses ComparisonModal's dialog pattern (FR-003)
│   │   ├── corpora/CorporaScreen.tsx        # per-document delete icon + confirm modal + link (US1)
│   │   ├── sources/
│   │   │   ├── DataSourcesScreen.tsx        # remove UploadDropzone card, add header Upload button (US2)
│   │   │   └── DocumentList.tsx             # remove attach/remove-from-corpus controls (US1/US2)
│   │   ├── chunking/FixedSizeChunkingScreen.tsx  # per-chunk Copy Link (US3)
│   │   ├── embeddings/EmbeddingsScreen.tsx       # typography only (US4)
│   │   ├── vector-view/VectorViewScreen.tsx      # typography only (US5)
│   │   └── playground/
│   │       ├── PlaygroundTurnDetail.tsx     # Actions popover, merged answer/chunks, citation
│   │       │                                  icons, chunk-citation modal (US6)
│   │       └── AnswerCitations.tsx          # NEW — parses `[N]` markers, renders info icons
└── tests/
    ├── unit/            # ConfirmModal, useClickOutside, AnswerCitations parsing, typography
    ├── integration/     # per-screen delete/link/popover flows
    └── e2e/             # delete-a-document, citation-to-chunk-modal end-to-end
```

**Structure Decision**: Existing web application layout (`frontend/` + `backend/`). Five of six
stories are frontend-only; US1 additionally touches the backend (`sources` module, `db/models.py`,
a migration) for the corpus/document relationship change, and US6 additionally touches
`app/playground/service.py`'s shared prompt template. Two new small, generic frontend pieces are
introduced (`useClickOutside`, `ConfirmModal`) since neither a popover-dismiss hook nor a second
modal instance exists yet — both follow patterns already established elsewhere in this codebase
(`ComparisonModal.tsx`'s dialog structure; the existing `window.confirm`-based delete flows'
intent, upgraded to a real modal per FR-003).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A — no Constitution Check violations.

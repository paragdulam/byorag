# Implementation Plan: Playground Split-Screen Chat Interface

**Branch**: `017-playground-chat-interface` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-playground-chat-interface/spec.md`

## Summary

Redesign the Playground into a two-panel screen: a left conversation panel (question input +
send, growing chat history of question/answer turns) and a right retrieval panel (Generate
control, retrieved-chunk list, query-embedding preview) that always reflects whichever turn is
currently selected. Sending a question retrieves and **persists** a new turn (question, retrieved
chunks, chunk embedding matches, query embedding) to the database; clicking Generate sends that
turn's question and chunks to a pluggable LLM provider and persists the model used, the exact
prompt, and the response. Every generated answer is clickable to re-inspect its own turn's
retrieval-and-generation record, conversations reload automatically per document, and a failed
generation can be retried against the same already-retrieved chunks.

Per Constitution Principle I (Pluggable RAG Architecture), generation — the one pipeline stage this
project hasn't implemented yet — is added behind a new `GenerationProvider` Protocol and
`GENERATION_PROVIDERS` registry, mirroring the existing `STRATEGIES` (chunking), `EMBEDDING_MODELS`
(embeddings), and `RETRIEVAL_STRATEGIES` (retrieval) registries exactly. Anthropic's API is
registered today; OpenAI, Gemini, local Hugging Face models, and Ollama are all addable later as
new provider modules with zero router/service/frontend changes, satisfying the explicit
requirement that swapping the LLM provider needs little to no frontend change.

## Technical Context

**Language/Version**: Python 3.12 (backend, FastAPI); TypeScript 5 (frontend, React 19, Vite)

**Primary Dependencies**: FastAPI, SQLAlchemy, `pgvector`, the existing `transformers`/`torch`
BERT embedding strategy and `cosine-similarity` retrieval strategy (both reused from
013/016 unchanged), `anthropic` (new — official Python SDK for the Anthropic Messages API), React

**Storage**: PostgreSQL + pgvector — two new tables (`conversation_turns`,
`conversation_turn_chunks`) via the existing `Base.metadata.create_all` schema management (no
Alembic in this project); no changes to existing `documents`/`chunks`/`embeddings` tables

**Testing**: pytest (contract, unit, integration) for the backend, with the Anthropic API client
mocked in tests (no real network calls in the test suite); Vitest + React Testing Library for
frontend components/hooks; Playwright for the end-to-end chat + persistence flow

**Target Platform**: Existing byorag web app (local single-user, Docker Compose)

**Project Type**: Web application (existing `frontend/` + `backend/` split)

**Performance Goals**: Retrieval cost is unchanged from 016 (one BERT CPU inference + one indexed
`pgvector` query). Generation adds one network round-trip to Anthropic's API per Generate click;
no fixed latency SLA is in scope (deferred as low-impact per `/speckit-clarify`) beyond the
UI never appearing to hang (FR-012's loading indicator).

**Constraints**: No streaming — the answer is revealed as a single block once generation
completes (per Clarifications). Send/Generate are disabled while a request is in flight
(FR-013) — enforced client-side; no server-side locking is needed since each request is
independently idempotent-safe. A turn's retrieved chunks are **snapshotted** (chunk index +
content copied into `conversation_turn_chunks`) rather than only foreign-keyed to the live
`Chunk` row, because saving a new chunk set (012/016) deletes and replaces a document's prior
`Chunk` rows — a live-only FK would silently corrupt historical turns' evidence the first time a
document is re-chunked, breaking FR-018 and Constitution Principle V. A missing/invalid
`ANTHROPIC_API_KEY` fails only the Generate action (clear error + retry control), not application
startup — retrieval-only usage must keep working even if generation isn't configured yet.

**Scale/Scope**: One new backend module (`app/generation/`), extensions to the existing
`app/playground/` module (two new persisted tables, three endpoint changes), one frontend screen
rewrite (`PlaygroundScreen.tsx` plus new sub-components), one rewritten hook, one extended API
client module.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: Generation is the RAG pipeline stage this principle names
  that the project hasn't implemented until now. It is added behind a `GenerationProvider`
  Protocol and `GENERATION_PROVIDERS` registry (`app/generation/providers/`), registering
  `"anthropic"` — exactly mirroring `STRATEGIES`, `EMBEDDING_MODELS`, and `RETRIEVAL_STRATEGIES`.
  The playground service looks the provider up by a config key, never branches on provider name.
  PASS.
- **II. Test-First, Test at Every Level (NON-NEGOTIABLE)**: Contract tests for the turn
  create/list/generate endpoints, unit tests for the Anthropic provider (mocked client) and the
  prompt builder, an integration test for the full retrieve → generate → reload persistence cycle,
  and frontend component/hook/e2e tests for the chat UI are part of the task breakdown, written
  before implementation. PASS (satisfied in tasks).
- **III. Single-User Simplicity (YAGNI)**: No auth is added for the new endpoints (matches every
  existing endpoint). No user-facing LLM picker is built now — the spec explicitly scopes model
  selection as read-only/fixed today and flags a future dropdown as out of scope. PASS.
- **IV. Fixed Technology Stack**: The fixed-stack list (frontend framework, backend language,
  vector store, relational DB, source storage, deployment) is unchanged — no new element is added
  there. The Anthropic API is a *pluggable strategy implementation* for the generation stage,
  exactly like `bert` is for embeddings or `cosine-similarity` is for retrieval — neither of those
  is enumerated in the fixed-stack list either, precisely because Principle I requires this whole
  category of choice to stay swappable. No constitution amendment is needed. PASS.
- **V. Experiment Observability & Reproducibility**: This feature is a direct, substantial
  implementation of this principle for the generation stage — every turn's retrieved chunks, the
  specific embedding matched, the query embedding, the LLM provider/model, the exact prompt, and
  the response are persisted together and remain inspectable indefinitely, even after the source
  chunks are later replaced by re-chunking. PASS.

No violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/017-playground-chat-interface/
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
│   ├── playground/
│   │   ├── router.py                  # MODIFIED — GET /context (unchanged), GET /turns,
│   │   │                               #   POST /turns, POST /turns/{turnId}/generate
│   │   │                               #   (replaces the 016 POST /search endpoint)
│   │   ├── schemas.py                 # MODIFIED — TurnOut, TurnChunkOut, CreateTurnRequest,
│   │   │                               #   ListTurnsResponse
│   │   └── service.py                 # MODIFIED — create_turn (retrieve + persist),
│   │                                   #   list_turns, generate_answer (build prompt,
│   │                                   #   call provider, persist result or error)
│   ├── generation/                    # NEW — mirrors retrieval/ and embeddings/models/ layout
│   │   ├── __init__.py
│   │   └── providers/
│   │       ├── __init__.py            # imports anthropic_provider to register "anthropic"
│   │       ├── base.py                # GenerationProvider Protocol, GENERATION_PROVIDERS
│   │       │                          #   registry, GenerationError
│   │       └── anthropic_provider.py  # registers "anthropic" via the `anthropic` SDK
│   ├── db/
│   │   └── models.py                  # MODIFIED — add ConversationTurn, ConversationTurnChunk
│   ├── config.py                      # MODIFIED — generation_provider, anthropic_api_key,
│   │                                   #   anthropic_model settings (env-var driven)
│   └── main.py                        # unchanged — playground router already registered
└── tests/
    ├── contract/
    │   ├── test_playground_turns.py           # NEW — GET/POST /turns
    │   └── test_playground_generate.py        # NEW — POST /turns/{id}/generate
    ├── unit/
    │   ├── test_anthropic_provider.py         # NEW — mocked Anthropic client
    │   └── test_playground_service.py         # MODIFIED — turn creation/generation logic
    └── integration/
        └── test_playground_conversation_persistence.py  # NEW — retrieve → generate →
                                                            #   reload → revisit-past-turn cycle

frontend/
├── src/
│   ├── components/playground/
│   │   ├── PlaygroundScreen.tsx        # MODIFIED — split-screen layout container
│   │   ├── ConversationPanel.tsx       # NEW — left side: turn list, input, send button
│   │   ├── TurnBubble.tsx              # NEW — one question + its clickable answer/status
│   │   └── RetrievalPanel.tsx          # NEW — right side: Generate, chunk list, embedding
│   ├── hooks/
│   │   └── usePlaygroundConversation.ts  # NEW — replaces usePlaygroundSearch; manages the
│   │                                     #   turn list, selected turn, send/generate/retry
│   ├── lib/
│   │   └── playgroundApi.ts            # MODIFIED — listTurns, createTurn, generateAnswer
│   └── types/
│       └── playground.ts               # MODIFIED — Turn, TurnChunk types
└── tests/
    ├── unit/
    │   ├── PlaygroundScreen.test.tsx         # MODIFIED
    │   └── usePlaygroundConversation.test.ts # NEW — replaces usePlaygroundSearch.test.ts
    └── e2e/
        └── playground.spec.ts           # MODIFIED — chat flow, reload persistence, revisit
```

**Structure Decision**: Existing `frontend/` + `backend/` web-application layout, unchanged. One
new backend package (`app/generation/`) follows the exact shape already established by
`app/retrieval/` and `app/embeddings/models/` (Protocol + registry + concrete implementation
registered on import). `app/playground/` is extended, not restructured. The 016
`POST /api/playground/search` endpoint is replaced by `POST /api/playground/turns` (see
research.md Decision 2) because persistence changes its contract fundamentally — silently
reusing the old ephemeral-endpoint contract for a now-persisted action would be misleading.

## Complexity Tracking

*No violations — this section is not applicable.*

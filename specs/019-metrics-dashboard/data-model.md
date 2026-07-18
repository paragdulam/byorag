# Phase 1 Data Model: Metrics Dashboard

## Overview

This feature reads existing entities (`Corpus`, `Document`, `DocumentCorpus`, `Chunk`, `Embedding`) as-is, extends `ConversationTurn`/`ConversationTurnChunk` to support corpus-scoped questions, and adds one new table for quality scores. See `research.md` §3 and §6 for the rationale behind each schema change, and the operational note about resetting the local dev database (no ALTER-based migrations in this stack).

## Extended Entities

### ConversationTurn (extended)

Existing table (`app/db/models.py`); new/changed columns only:

| Column | Type | Change | Notes |
|---|---|---|---|
| `document_id` | UUID FK → `documents.id`, `ON DELETE CASCADE` | now **nullable** | Set when `scope = "document"`; null when `scope = "corpus"`. |
| `corpus_id` | UUID FK → `corpora.id`, `ON DELETE CASCADE` | **new**, nullable | Set when `scope = "corpus"`; null when `scope = "document"`. |
| `scope` | String, not null | **new** | `"document"` or `"corpus"`. Determines which of `document_id`/`corpus_id` is populated. |

Validation rule: exactly one of `document_id`/`corpus_id` is non-null, consistent with `scope`. Enforced at the service layer when a turn is created (mirrors how existing validation in `create_turn` already checks preconditions before persisting).

All other existing columns (`question`, `embedding_model`, `query_embedding`, `llm_provider`, `llm_model`, `prompt`, `answer`, `error`, `created_at`, `answered_at`) are unchanged and apply identically to both scopes.

### ConversationTurnChunk (extended)

| Column | Type | Change | Notes |
|---|---|---|---|
| `document_id` | UUID, nullable (no FK — a snapshot value, matching the existing `chunk_index`/`content` snapshot fields) | **new** | Which document this retrieved chunk snapshot came from. Always populated for `scope = "corpus"` turns (a corpus-wide answer can draw chunks from more than one document); may be left null for `scope = "document"` turns since the caller already knows the document from the parent turn. |

No other changes; `chunk_id`/`embedding_id` remain best-effort live links exactly as before (research.md of 017).

## New Entities

### TurnQualityScore

One row per successfully judged `ConversationTurn` — absence of a row means "not yet scored" (research.md §6).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID, primary key | |
| `turn_id` | UUID FK → `conversation_turns.id`, `ON DELETE CASCADE`, unique | One score set per turn. |
| `context_precision` | Float, not null | 0.0–1.0. |
| `context_recall` | Float, not null | 0.0–1.0. |
| `response_relevancy` | Float, not null | 0.0–1.0. |
| `faithfulness` | Float, not null | 0.0–1.0. |
| `judge` | String, not null | Registry key of the `EvaluationJudge` that produced this score (mirrors `Chunk.strategy`/`Embedding.model` storing registry keys), e.g. `"anthropic"`. |
| `scored_at` | DateTime (timezone-aware), not null | |

Relationship: `ConversationTurn.quality_score: TurnQualityScore | None` (one-to-one via `turn_id`).

## Derived Concept: RAG Pipeline

Not a stored table — a query-time grouping key, per research.md §5:

```
Pipeline = (corpus_id, chunking_strategy, embedding_model)
```

For a given corpus, the set of pipelines is derived from distinct `(Chunk.strategy, Embedding.model)` pairs found among chunks belonging to that corpus's documents (via `document_corpora`) that have at least one saved embedding. Per-pipeline figures shown on the Metrics screen:

- **Chunk count**: `count(Chunk)` for documents in the corpus, filtered to `Chunk.strategy`.
- **Embedding model**: the `Embedding.model` value itself (part of the pipeline key).
- **Question count**: `count(ConversationTurn)` where the turn's document (for `scope = "document"`) or corpus (for `scope = "corpus"`) belongs to this corpus, joined to confirm the turn's retrieved chunks used this pipeline's `embedding_model` (a turn always records `embedding_model` already).
- **Answer count**: same filter, `answer IS NOT NULL`.
- **Scope breakdown**: same filter, grouped by `scope`.
- **Quality scores**: average of `TurnQualityScore` columns joined to turns matching the same filter; sample size = count of joined `TurnQualityScore` rows (needed to distinguish "no data yet" from "score is genuinely 0").

## Entity Relationship Summary

```
Corpus ──< DocumentCorpus >── Document ──< Chunk ──< Embedding
  │                                          │
  │                                          └──< ConversationTurnChunk >── ConversationTurn
  │                                                                              │
  └──────────────────────< ConversationTurn (scope="corpus") ───────────────────┘
                                                                                  │
                                                                    TurnQualityScore (0..1)
```

## State / Lifecycle Notes

- A `ConversationTurn` follows the same derived-status rules already documented on the model (no chunks retrieved / retrieved-not-yet-generated / errored / answered) — unchanged by this feature.
- A `TurnQualityScore` only ever exists for a turn that reached the "answered" state; it is created once, asynchronously, after `answered_at` is set, and is not updated afterward (re-asking is a new turn, not an edit to an existing one — consistent with the append-only turn history already in place).

# Phase 0 Research: Vector View Screen

No open `NEEDS CLARIFICATION` markers remain from the spec or Technical Context — the one real
fork (multi-embedding display) was already resolved interactively before drafting the spec
(secondary picker, per FR-007). This document records the technical decisions made while turning
the spec into a concrete plan.

## 1. Reading saved embeddings: per-chunk, not per-document

**Decision**: Add `GET /api/embeddings/saved?chunkId=` — returns all saved `Embedding` rows for
**one** chunk (id, model, createdAt, dims, full vector), not a bulk per-document endpoint. The
frontend fetches this reactively whenever the selected chunk changes, mirroring how
`useChunkEmbeddings` already reactively fetches `savedChunks` whenever the selected document
changes.

**Rationale**: Consistent with this project's established reactive-per-selection loading pattern
(documents load on corpus change, saved chunks load on document change) rather than introducing a
new "bulk load everything up front" shape. It also avoids transmitting every saved embedding for
every chunk of a document (potentially many, given `013`'s accumulate-not-replace design) when the
user is only looking at one chunk at a time.

**Alternatives considered**:
- *`GET /api/embeddings/saved?documentId=` returning all chunks' embeddings at once*: rejected —
  larger payload for no benefit, since the UI only ever shows one chunk's embeddings at a time; also
  inconsistent with the per-selection loading pattern used everywhere else in this app.
- *Two-step: list metadata only, then fetch one vector by embedding id on selection*: rejected as
  premature optimization — a chunk's saved-embedding count is expected to stay small in practice
  (spec Scale/Scope), so the extra round-trip buys little; the existing generate/save endpoints
  already return full vectors for up to 200 chunks in one response, so returning full vectors for a
  handful of a single chunk's saved embeddings is comparatively lightweight.

## 2. Projection method picker: a small server-driven registry, not a hardcoded frontend list

**Decision**: Add a `PROJECTION_METHODS` registry in `backend/app/embeddings/projection_methods.py`
(dict keyed by id, e.g. `{"vector": {"label": "Vector", "available": True}, "umap": {"label":
"UMAP", "available": False}, "pca": {"label": "PCA", "available": False}}`), exposed via
`GET /api/embeddings/projection-methods`. The frontend renders every entry in the dropdown but
only lets `available: true` entries actually change the display; selecting an unavailable one
shows a "not available yet" message (FR-011) instead of doing nothing or erroring.

**Rationale**: Mirrors `013`'s `EMBEDDING_MODELS` registry exactly (constitution Principle I —
pluggable, registry-driven, not hardcoded branching), so adding real UMAP/PCA support later is
"implement the projection + flip `available` to `True`," not a picker redesign. A server-driven
list (vs. a hardcoded frontend array) keeps the backend as the single source of truth for what's
real vs. placeholder, consistent with how the embedding-model dropdown already works.

**Alternatives considered**:
- *Hardcode the three option labels directly in the frontend component*: rejected — works today
  but duplicates the "what's actually available" decision in two places once UMAP/PCA are
  implemented, and breaks from the established registry pattern for no reason.
- *Omit UMAP/PCA from the dropdown entirely until implemented*: rejected — the spec explicitly
  asks for them to be visible-but-unavailable now (FR-011), to establish the picker's future shape.

## 3. Default selection when a chunk has multiple saved embeddings

**Decision**: `GET /api/embeddings/saved?chunkId=` returns the chunk's saved embeddings ordered by
`created_at` descending (most recent first); the frontend pre-selects the first (most recent) entry
in the secondary picker by default, while still letting the user pick any other one (FR-007).

**Rationale**: A sensible, low-risk default — showing the most recent save immediately avoids an
empty right-pane on first selection, and doesn't contradict the resolved clarification (the user
can still choose any specific saved embedding; only the *default* choice needed a decision, and any
reasonable default here is easily reversible in the UI).

**Alternatives considered**:
- *No default — force an explicit choice before showing anything*: rejected — adds a click for the
  common case (a chunk with only one saved embedding still needs "no default" logic to not feel
  broken) for no real benefit.

## 4. Matrix/grid rendering is presentation-only

**Decision**: The 768-value flat vector is reshaped client-side into a grid for display (e.g., a
fixed number of columns per row, chosen for readability), computed purely in the frontend from the
already-fetched `vector: number[]` array. No backend change, no new stored shape.

**Rationale**: `pgvector`'s `vector` type is inherently a flat array; "matrix" in the spec (FR-006)
describes a *display* requirement (avoid one giant unbroken list), not a different storage or
transmission shape. Keeping this reshaping in the frontend avoids adding a formatting concern to
the API contract, and matches the spec's own Assumptions ("read from DB directly" = exact values,
not a different representation).

**Alternatives considered**:
- *Backend reshapes the vector into rows before sending it*: rejected — couples a purely visual
  decision (how many columns look good) to the API contract; the frontend already has everything it
  needs to do this locally, matching how chunking's UI-only formatting decisions are handled.

## 5. Gating "Move to Vector View" — extend the existing hook, don't add new state elsewhere

**Decision**: Add `hasSavedOnce: boolean` to `useChunkEmbeddings` — a one-way latch set `true` on
the first successful `save()` this session (same shape as `useFixedSizeChunking`'s existing
`hasSavedOnce`, `012`), and use it to enable/disable the new "Move to Vector View" button.

**Rationale**: Directly implements spec FR-002 ("mirrors how the Chunking screen gates its own
'Move to Embeddings'"), reusing an already-proven pattern instead of inventing a new one. Since
`useChunkEmbeddings` already tracks `saveStatus`, adding the latch is a small, localized change.

**Alternatives considered**:
- *Gate on `preview !== null` (has generated) instead of a save latch*: rejected — spec FR-002 is
  explicit that the gate is about a **save** having succeeded, not merely a preview, matching the
  reasoning that Vector View only has something meaningful to show once data is actually persisted.

## 6. Playground is a genuine minimal placeholder, not deferred entirely

**Decision**: Add a `PlaygroundScreen` component (mirrors the original pre-`013` Embeddings
placeholder: a heading and a short "coming soon" message, no functional controls), wired into
`App.tsx`/`SidebarNav.tsx` as a real, navigable screen.

**Rationale**: The spec requires "Move to Playground" to actually navigate somewhere (FR-013,
User Story 4 Acceptance Scenario 2) — a dead link or a no-op button would fail that requirement.
Building only a placeholder (not real Playground functionality) matches the spec's own Assumptions
and constitution Principle III (YAGNI) — don't build a feature nothing has specified yet.

**Alternatives considered**:
- *"Move to Playground" disabled/hidden until Playground is a real feature*: rejected — spec User
  Story 4 explicitly asks for the button to exist and navigate now, not to be deferred.

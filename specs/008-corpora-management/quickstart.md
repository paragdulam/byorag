# Quickstart: Corpora Management with Persistent Storage

Validates the feature end-to-end: multiple corpora, corpus-scoped Sources, many-to-many
document↔corpus association, cross-restart persistence, and the Chunking nav chevron.

## Prerequisites

- Docker (for `docker compose up`) **or** a local PostgreSQL 16 install.
- Backend deps installed (`uv sync` / existing project tooling) including the new `sqlalchemy` and
  `psycopg` dependencies added by this feature.

## 1. Start PostgreSQL

**Via Docker Compose** (recommended, matches `research.md` §4):

```bash
docker compose up -d postgres
```

**Or, against a local install**, export before starting the backend:

```bash
export DATABASE_URL="postgresql+psycopg://byorag:byorag@localhost:5432/byorag"
createdb byorag   # first time only
```

## 2. Start the app

```bash
docker compose up --build
```

On backend startup, watch the logs for the one-time legacy-PDF migration (`research.md` §2): any
files already present in `PDFS_DIR` from a prior session are logged as migrated into a new
`Uncategorized` corpus.

## 3. Validate: multiple corpora (User Story 1)

1. Open the app. If no corpora exist yet, the Corpora nav section shows an empty/prompt state.
2. Create a corpus named `Research Notes`. Confirm it appears in the Corpora section and becomes
   active (spec Acceptance Scenario 1–2).
3. Create a second corpus named `Product Docs`. Confirm both are listed.
4. Attempt to create another corpus also named `Research Notes` — confirm it's rejected with a
   clear error (`contracts/corpora-api.md`, `409`).
5. Click between the two corpora — confirm the Sources view's document list changes accordingly
   (initially empty for both).

## 4. Validate: many-to-many document↔corpus (User Story 2)

1. With `Research Notes` active, upload a PDF. Confirm it appears in `Research Notes`'s Sources
   view.
2. Attach the same document to `Product Docs` (without re-uploading — via whatever "add existing
   document" UI action this feature ships, backed by
   `POST /api/sources/{documentId}/corpora`). Confirm it now appears in both corpora's Sources
   views.
3. Re-upload the exact same file into `Product Docs` again — confirm no duplicate entry appears
   (dedup, `research.md` §3) and no new chunking run is triggered.
4. Remove the document from `Research Notes` only. Confirm it disappears from `Research Notes`'s
   Sources view but remains visible in `Product Docs`.
5. Remove the document from `Product Docs` (its last remaining corpus). Confirm it is now gone from
   every corpus — this is a full delete (FR-008), not just an unlink.

## 5. Validate: persistence across restarts (User Story 3)

1. Create a corpus, upload a document, and run a fixed-size chunking pass on it from the Chunking
   screen.
2. `docker compose restart backend` (or stop/start the local backend process).
3. Reload the app. Confirm the corpus, the document, and the chunk count/results from step 1 are
   all still present and correctly linked (spec Acceptance Scenario, User Story 3).
4. Stop the `postgres` service and reload the app — confirm a clear error is shown rather than an
   empty/blank state (spec Acceptance Scenario 2, User Story 3).

## 6. Validate: Chunking nav chevron (User Story 4)

1. Look at the left nav — confirm a chevron is visible next to "Chunking" and absent next to
   "Sources", "Embeddings", and any other non-expandable item.
2. Click "Chunking" to expand it — confirm the chevron's orientation changes.
3. Click again to collapse — confirm the chevron returns to its original orientation.

## 7. Run the automated test suites

```bash
# Backend — requires DATABASE_URL pointed at a byorag_test database (research.md §10)
cd backend && DATABASE_URL="postgresql+psycopg://byorag:byorag@localhost:5432/byorag_test" pytest

# Frontend
cd frontend && npm run test        # unit
cd frontend && npm run test:e2e    # e2e (Playwright)
```

All suites are expected to pass with zero skips before this feature is considered done
(Constitution Principle II).

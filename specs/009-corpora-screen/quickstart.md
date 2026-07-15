# Quickstart: Dedicated Corpora Screen with App-Wide Scoping

Validates the feature end-to-end: the dedicated Corpora screen, its full CRUD (including document
management), the retained sidebar quick-switcher, and consistent cross-section scoping.

## Prerequisites

- Everything from `008-corpora-management`'s quickstart already running (PostgreSQL reachable,
  backend + frontend started). No new services or dependencies are introduced by this feature.

## 1. Validate: the Corpora screen exists and is reachable (User Story 1)

1. Open the app. Confirm "Corpora" appears in the left nav as its own clickable item, positioned
   above "Sources" (alongside "Sources"/"Chunking"/"Embeddings", not just the existing inline
   quick-switcher list).
2. Click "Corpora". Confirm it navigates to a dedicated screen (URL/screen change, same as clicking
   "Sources").
3. With no corpora yet, confirm the screen shows an empty/prompt state inviting corpus creation.
4. Create a corpus named "Research Notes" from the screen. Confirm it appears in the screen's list.
5. Select it. Confirm the screen clearly marks it as the active corpus.

## 2. Validate: the sidebar quick-switcher still works (Clarification, research.md §3)

1. From any screen (not just the Corpora screen), confirm the sidebar's existing corpora list is
   still visible.
2. Create a second corpus, "Product Docs", either from the sidebar's "+ New Corpus" control or the
   Corpora screen — confirm it shows up in both places.
3. Click a corpus name directly in the sidebar list. Confirm it becomes active without navigating
   away from the current screen.

## 3. Validate: cross-section scoping (User Story 2)

1. With "Research Notes" active, upload a document via the Sources screen.
2. Switch to "Product Docs" (from either the sidebar or the Corpora screen). Confirm the Sources
   screen immediately shows an empty list for "Product Docs" — no reload needed.
3. Open the Chunking screen's document picker. Confirm it only offers documents belonging to
   "Product Docs" (currently none).
4. Switch back to "Research Notes". Confirm Sources and Chunking both immediately reflect it again.

## 4. Validate: managing a corpus's documents from the Corpora screen (User Story 3)

1. On the Corpora screen, select "Research Notes" (which has the previously uploaded document).
   Confirm its document list is visible there.
2. Use the "add existing document" picker to attach that same document to "Product Docs" without
   re-uploading it (backed by `GET /api/sources/all`, `contracts/list-all-documents-api.md`).
   Confirm it now appears in "Product Docs" too.
3. Remove the document from "Research Notes" via the Corpora screen. Confirm it disappears from
   "Research Notes" but remains in "Product Docs".

## 5. Validate: deleting a corpus from the screen (User Story 4)

1. Attempt to delete "Product Docs" while it still has the document attached. Confirm the deletion
   is blocked with a clear message.
2. Remove the document from "Product Docs" too (its last remaining corpus — confirm it's now fully
   deleted, consistent with `008-corpora-management`'s cascade rule).
3. Delete the now-empty "Product Docs" corpus from the screen. Confirm it disappears from both the
   screen's list and the sidebar's quick-switcher.
4. If "Product Docs" was active at the time, confirm the app automatically selects "Research Notes"
   (the remaining corpus) as active, with Sources/Chunking reflecting the change immediately.

## 6. Run the automated test suites

```bash
# Backend
cd backend && DATABASE_URL="postgresql+psycopg://byorag:byorag@localhost:5432/byorag_test" pytest

# Frontend
cd frontend && npm run test        # unit
cd frontend && npm run test:e2e    # e2e (Playwright)
```

All suites are expected to pass with zero skips before this feature is considered done
(Constitution Principle II).

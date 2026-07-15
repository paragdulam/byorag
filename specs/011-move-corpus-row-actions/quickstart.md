# Quickstart: Move Corpus Row Actions to the Corpora Screen

Validates the correction end-to-end: "Make Active" and "Delete" now live on the Corpora screen's
list, and are gone from the sidebar dropdown, which still lets you switch corpora by clicking a
row.

## Prerequisites

- Everything from `008-corpora-management`/`009-corpora-screen`/`010-corpora-dropdown-nav`'s
  quickstarts already running (PostgreSQL reachable, backend + frontend started). No new services
  or dependencies.

## 1. Validate: Make Active and Delete on the Corpora screen (User Story 1)

1. Navigate to the "Corpora" nav item. Create two corpora, "Reports" and "Notes", from the
   screen's own create form (unchanged from `009`).
2. Confirm each row in "All Corpora" shows the corpus name, and the active one shows "ACTIVE"
   instead of a "Make Active" button — the non-active one shows a "Make Active" button next to it.
3. Click "Make Active" next to "Reports". Confirm it becomes active immediately (its row now shows
   "ACTIVE"; "Notes" now shows a "Make Active" button instead).
4. Click "Delete" next to "Notes" (empty). Confirm a confirmation prompt appears; confirm it, and
   confirm "Notes" disappears from the list everywhere (Corpora screen and the sidebar dropdown).
5. Upload a document into "Reports" via the Sources screen, then return to the Corpora screen and
   click "Delete" next to "Reports". Confirm deletion is blocked with a clear message and "Reports"
   remains in the list.
6. Remove the document from "Reports", then delete it again from its row. Confirm it now succeeds.

## 2. Validate: the sidebar dropdown no longer has action buttons (User Story 2)

1. Create two corpora again (from the Corpora screen).
2. Open the sidebar dropdown. Confirm no "Make Active" or "Delete" button appears next to either
   corpus.
3. Click the non-active corpus's name directly in the open dropdown. Confirm it becomes active
   immediately (reflected in the dropdown's collapsed label and, e.g., the Sources screen), with no
   page reload.
4. Confirm the dropdown otherwise behaves as before (`010-corpora-dropdown-nav`): closed by
   default, opens/closes via its toggle, an outside click, or Escape.

## 3. Run the automated test suites

```bash
# Backend (unchanged by this feature — included for completeness)
cd backend && DATABASE_URL="postgresql+psycopg://byorag:byorag@localhost:5432/byorag_test" pytest

# Frontend
cd frontend && npm run test        # unit + integration
cd frontend && npm run test:e2e    # e2e (Playwright)
```

All suites are expected to pass with zero skips before this feature is considered done
(Constitution Principle II) — including the existing specs updated per research.md §4.

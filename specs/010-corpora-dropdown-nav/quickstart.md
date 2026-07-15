# Quickstart: Corpora Dropdown in the Left Navigation

Validates the feature end-to-end: the dropdown's collapsed/open states, per-row make-active and
delete actions, and that the dedicated Corpora screen (`009-corpora-screen`) is unaffected.

## Prerequisites

- Everything from `008-corpora-management`/`009-corpora-screen`'s quickstarts already running
  (PostgreSQL reachable, backend + frontend started). No new services or dependencies.

## 1. Validate: dropdown collapsed/open states (User Story 1)

1. Open the app with no corpora yet. Confirm the sidebar shows a closed dropdown reading something
   like "No corpus selected" — not an inline list.
2. Click the dropdown. Confirm it opens and shows an empty list, with **no create-corpus control**
   inside it (amended during implementation — creating a corpus now happens only from the
   dedicated Corpora screen).
3. Navigate to the "Corpora" nav item and create a corpus named "Research Notes" from that screen's
   own create form. Confirm it becomes active.
4. Reopen the sidebar dropdown. Confirm "Research Notes" now appears in its list and its collapsed
   label reads "Research Notes".
5. Click the dropdown's toggle again. Confirm it closes.
6. Click elsewhere on the page (outside the dropdown) while it's open. Confirm that also closes it.

## 2. Validate: make a corpus active from the dropdown (User Story 2)

1. Create a second corpus, "Product Docs", from the dedicated Corpora screen.
2. With the dropdown open, confirm "Research Notes" is clearly marked as active and "Product Docs"
   shows a "Make Active" action.
3. Click "Make Active" next to "Product Docs". Confirm it becomes active immediately (dropdown
   updates its indication; no page reload).
4. Navigate to the Sources screen. Confirm it now shows "Product Docs"'s (empty) document list —
   confirming the change propagated app-wide, consistent with `008-corpora-management`'s existing
   cross-section scoping.

## 3. Validate: delete a corpus from the dropdown (User Story 3)

1. Open the dropdown, upload nothing into "Research Notes" yet — attempt to click "Delete" next to
   "Product Docs" while it's empty. Confirm a confirmation prompt appears; confirm it, and confirm
   "Product Docs" disappears from the list everywhere (dropdown, and the dedicated Corpora screen).
2. Upload a document into "Research Notes" via the Sources screen, then reopen the dropdown and
   attempt to delete "Research Notes". Confirm deletion is blocked with a clear message.
3. Remove the document from "Research Notes" (via the Sources screen or the Corpora screen), then
   delete "Research Notes" from the dropdown again. Confirm it succeeds now that it's empty, and
   confirm the dropdown's collapsed label shows "No corpus selected" since no corpora remain.

## 4. Validate: the dedicated Corpora screen is unaffected

1. Create two corpora again. Navigate to the "Corpora" nav item (leads to the dedicated screen from
   `009-corpora-screen`).
2. Confirm the screen's own corpora list, create form, document management, and delete action all
   still work exactly as before — independent of the sidebar dropdown's open/closed state.

## 5. Run the automated test suites

```bash
# Backend (unchanged by this feature — included for completeness)
cd backend && DATABASE_URL="postgresql+psycopg://byorag:byorag@localhost:5432/byorag_test" pytest

# Frontend
cd frontend && npm run test        # unit
cd frontend && npm run test:e2e    # e2e (Playwright)
```

All suites are expected to pass with zero skips before this feature is considered done
(Constitution Principle II) — including the existing e2e specs updated per research.md §3.

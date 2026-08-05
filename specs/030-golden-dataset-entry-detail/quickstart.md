# Quickstart: Validating Golden Dataset Entry Scoping & Read-Only Answer View

No `contracts/` directory — this feature has no backend/API surface change (see
[research.md](./research.md)'s first finding). Validation is entirely through running the app
and its test suites.

## Prerequisites

- Repo running per the existing project setup (Docker Compose backend + `npm run dev` for
  `frontend/`).
- A corpus with at least two documents, each with at least one **approved** golden dataset
  entry, plus at least one pending-review entry (for the FR-007 negative check). Existing
  manual-creation and LLM-generation flows on the Golden Dataset screen can produce these; no
  new fixtures are required beyond what `golden-dataset.spec.ts` already builds.

## Automated validation

```bash
cd frontend
npm run test              # unit + integration: GoldenEntryList.test.tsx,
                           # GoldenEntryDetail.test.tsx, GoldenDatasetScreen.test.tsx
npm run test:e2e -- golden-dataset.spec.ts
```

Expected: all new/extended cases pass —
- unit: `GoldenEntryList` shows only approved-row click → expand; pending/rejected rows don't
  expand; deleting an expanded row closes its detail; `GoldenEntryDetail` renders question +
  answer with zero form controls.
- integration: `GoldenDatasetScreen` shows the full corpus's entries under "Entire Corpus" and
  only one document's entries when that document is selected, updating immediately on
  selection change.
- e2e: the full flow against a real backend — approve an entry, switch scope, click its
  question, see the answer, confirm no editable field exists, delete it.

## Manual validation (matches spec Acceptance Scenarios)

1. **Scope filtering** (User Story 1): On the Golden Dataset screen, with entries existing for
   two different documents in the same corpus, select "Entire Corpus" — confirm every entry
   from both documents is listed. Select one specific document — confirm only that document's
   entries remain, and switching between documents updates the list immediately with no reload.
   Select a document with zero entries of its own — confirm the existing "no entries yet"
   empty state appears rather than another document's entries.
2. **Read-only answer view** (User Story 2): Click the question of an approved entry — confirm
   its full preferred answer appears. Look for any input field, textarea, or save/submit
   button anywhere in that view — confirm none exists. Click a second approved entry's
   question — confirm its own answer appears (not the first entry's), and the first entry's
   expanded answer is unaffected (still open, still showing its own content).
3. **Non-approved rows unaffected** (Edge case / FR-007): Click the question of a pending-review
   or rejected entry in the same list — confirm nothing new opens; existing review behavior
   (via the Pending Review section) is unchanged.
4. **Delete interaction** (FR-008/FR-009): With an approved entry's answer expanded, click
   Delete on that entry — confirm both the row and its expanded answer disappear together, and
   the delete confirmation/behavior matches what it does today for any other row.

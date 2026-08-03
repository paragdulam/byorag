# Quickstart: Validating the PDF Preview Page Indicator

No contracts/ directory — this feature is UI-only with no backend or API surface (see
[plan.md](./plan.md) Project Structure). Validation is entirely through running the app and
its test suites.

## Prerequisites

- Repo running per the existing project setup (Docker Compose backend + `npm run dev` for
  `frontend/`, or however you normally run this app locally).
- At least one corpus with a multi-page PDF source document already uploaded (any existing
  seeded/test document works — reuse fixtures already used by
  `frontend/tests/e2e/data-sources-screen.spec.ts` / `golden-dataset.spec.ts` if running
  manually against a fresh environment).

## Automated validation

```bash
cd frontend
npm run test              # unit + integration: pdfPageVisibility.test.ts,
                           # SourceDocumentPreview.test.tsx
npm run test:e2e -- data-sources-screen.spec.ts golden-dataset.spec.ts
```

Expected: all new/extended cases pass —
- unit: `mostVisiblePage()` picks the highest-ratio entry, returns `null` for an empty list.
- integration: indicator text absent during loading/error/empty states; present as
  `"Page 1 of N"` once a document with N pages finishes loading; resets on document switch.
- e2e: indicator visible in both the Data Sources screen's preview pane and the Golden
  Dataset screen's split-view preview pane.

## Manual validation (matches spec Acceptance Scenarios)

1. **Data Sources screen** (User Story 1): Select a multi-page PDF document. Confirm the
   toolbar (next to the zoom controls) shows `Page 1 of N`. Scroll down through the document;
   confirm the page number advances as later pages become predominantly visible, and
   decreases again when scrolling back up.
2. **Zoom interaction** (User Story 2): While viewing a specific page (e.g., `Page 2 of N`),
   click zoom in/out. Confirm the indicator still reads `Page 2 of N` immediately after —
   no jump caused purely by the zoom change.
3. **Loading/error/empty states** (User Story 3): Reload the screen with no document selected
   — confirm no indicator is shown. Select a document — confirm no indicator (or a
   non-numeric placeholder) appears during the brief loading state, then the correct
   `Page 1 of N` appears once loaded. If a document fails to load (e.g., a corrupted fixture),
   confirm "Preview unavailable" shows with no indicator alongside it.
4. **Golden Dataset screen split view** (FR-002): Repeat step 1 in the Golden Dataset
   screen's document preview pane — same behavior, same component.
5. **Fullscreen** (Edge case): Toggle fullscreen on either screen mid-scroll; confirm the
   indicator continues showing the correct current page in the fullscreen layout.
6. **Document switch** (FR-008): With `Page 3 of N` showing, select a different document;
   confirm the indicator resets to that new document's own `Page 1 of M` (not a stale
   `Page 3 of N` from the previous document) once it loads.

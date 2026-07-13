# Quickstart: Validating the Data Sources Screen

## Prerequisites

- Node.js 20 LTS installed
- Repository checked out on branch `001-data-sources-screen`
- From repo root: `cd frontend`

## Setup

```bash
npm install
```

## Run it

```bash
npm run dev
```

Open the printed local URL. You should see the "Data Sources" screen
matching `assets/sources/screen.png`: sidebar nav with "Sources" active, top
bar, an "Upload PDF Documents" drop zone with "Max size: 50MB" / "PDF only"
chips, a static "Vector Storage" widget, and an (initially empty, or
pre-populated per your manual testing) Document List.

## Manual validation scenarios

Each maps to an acceptance scenario in `spec.md`:

1. **Upload via drag-and-drop (US1 #1)**: Drag a small PDF onto the drop
   zone. It should appear in the Document List within ~2s, showing name,
   size, upload time, and a status chip that starts at "Processing" and
   flips to "Processed" shortly after (US1 #4).
2. **Upload via browse (US1 #2)**: Click the drop zone, pick a PDF from the
   file dialog. Same result as above.
3. **Multi-file upload (US1 #3)**: Drag two or more valid PDFs at once; each
   appears as its own row.
4. **Reject non-PDF (US2 #1)**: Drag a `.txt` file onto the drop zone. It
   must NOT appear in the list; a visible error message must name the file
   and explain it isn't a PDF.
5. **Reject oversized file (US2 #2)**: Drag a PDF larger than 50MB. Same
   rejection behavior, with a size-specific message.
6. **Mixed batch (US2 #3)**: Drag one valid PDF and one invalid file
   together; only the valid one appears in the list, the invalid one is
   reported as rejected.
7. **Export CSV, populated (US3 #1)**: With at least one document listed,
   click "Export CSV"; confirm the downloaded file has one row per listed
   document with name/size/date/status columns.
8. **Export CSV, empty (US3 #2)**: With an empty list, click "Export CSV";
   confirm the downloaded file has only the header row.
9. **Reload resets state (Edge case)**: After uploading documents, reload the
   page; confirm the Document List is empty again (no persistence, per
   FR-009).

## Automated tests

```bash
npm run test        # Vitest: unit + integration/component tests
npm run test:e2e     # Playwright: full upload -> list -> export flow
```

All of the manual scenarios above have a corresponding automated test named
in `plan.md`'s Project Structure (`tests/unit`, `tests/integration`,
`tests/e2e`) — see `tasks.md` for the exact task breakdown once generated.

## Design reference

- Visual reference: `assets/sources/screen.png`
- Design tokens / style rules: `assets/sources/DESIGN.md`

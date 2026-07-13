# BYORAG Frontend

React + TypeScript + Vite app for the BYORAG experimentation tool. Currently
implements the **Data Sources** screen (`specs/001-data-sources-screen/`):
drag-and-drop / browse PDF upload, a document list with simulated
processing status, and CSV export — all session-only, no backend yet.

## Prerequisites

- Node.js 20+ (tested on Node 22)
- npm

## Install

```bash
cd frontend
npm install
```

## Run the app

```bash
npm run dev
```

Open the printed URL (defaults to `http://localhost:5173`).

## Run tests

```bash
npm run test       # Vitest: unit + integration/component tests
npm run test:e2e   # Playwright: end-to-end upload -> list -> export flow
```

`test:e2e` starts its own dev server automatically (see `playwright.config.ts`).
To install Playwright's browser binaries the first time:

```bash
npx playwright install chromium
```

## Build for production

```bash
npm run build      # type-checks then builds to dist/
npm run preview    # serve the production build locally
```

## Lint

```bash
npm run lint
```

## Run with Docker

```bash
docker build -t byorag-frontend .
docker run -p 8080:80 byorag-frontend
```

Then open `http://localhost:8080`.

## Project structure

See `specs/001-data-sources-screen/plan.md` for the full structure and
design rationale. Key paths:

- `src/components/` — UI components (`layout/` app shell, `sources/` screen)
- `src/hooks/useSourceDocuments.ts` — in-memory document/upload state
- `src/lib/` — `fileValidation`, `formatFileSize`, `exportCsv`
- `tests/unit`, `tests/integration`, `tests/e2e` — test suites per constitution Principle II

## Design reference

- Visual reference: `../assets/sources/screen.png`
- Design tokens / style rules: `../assets/sources/DESIGN.md` (mapped into `src/styles/tailwind.css`)

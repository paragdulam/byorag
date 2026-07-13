# Phase 0 Research: Data Sources Screen

All Technical Context items were resolvable directly from the constitution's
Fixed Technology Stack and the feature spec's constraints, without external
unknowns. Decisions below are recorded in the standard format for traceability.

## Build tooling

- **Decision**: Vite + React + TypeScript template.
- **Rationale**: Fast dev server and HMR for iterating on a single visual
  screen; standard, low-config pairing with React that the constitution
  already names as an example (`Technology Stack & Environment`).
- **Alternatives considered**: Create React App (unmaintained, slower dev
  loop); Next.js (adds server-side rendering/routing machinery this
  single-screen, single-user tool doesn't need yet — rejected per
  Principle III, YAGNI).

## Styling approach

- **Decision**: Tailwind CSS, configured with a theme extension that maps
  directly to the color/typography/spacing tokens in
  `assets/sources/DESIGN.md` (e.g., `surface`, `surface-container`,
  `primary`, `on-surface`, the Inter/JetBrains Mono font families, and the
  4px spacing scale).
- **Rationale**: The design is token-driven (explicit hex values, named
  surfaces, a strict 4px grid); Tailwind's theme config is a direct,
  low-friction mapping for those tokens and keeps utility classes consistent
  with the "Sophisticated Industrial" spacing/shape rules (4px/8px corner
  radii, 1px borders instead of shadows).
- **Alternatives considered**: Hand-rolled CSS modules (more boilerplate to
  keep tokens in sync across components); CSS-in-JS (extra runtime
  dependency not justified for a static-token design system).

## Upload interaction

- **Decision**: Native HTML5 Drag-and-Drop events (`onDragOver`/`onDrop`) on
  the upload area, plus a hidden `<input type="file" multiple accept=".pdf">`
  triggered by click, for the "click to browse" path.
- **Rationale**: Fully covers FR-001/FR-002/FR-003 (drag-and-drop, browse,
  multi-file) with zero extra dependencies; validation logic (type/size) is
  identical regardless of entry path, so it's implemented once in
  `lib/fileValidation.ts` and called from both handlers.
- **Alternatives considered**: `react-dropzone` — a well-known library, but
  an added dependency for behavior the native APIs already cover at this
  scope; rejected per Principle III (YAGNI).

## Status simulation (Processing → Processed)

- **Decision**: On add, a document is inserted with status `processing`;
  a `setTimeout` (short, fixed delay — e.g. 1.5s) flips it to `processed`.
  This lives in the `useSourceDocuments` hook so it's isolated and testable
  (fake timers in unit/integration tests).
- **Rationale**: Matches FR-008 and the spec's documented assumption that
  this is a simulated transition, not real pipeline status, since no
  ingestion backend exists yet.
- **Alternatives considered**: Always showing "Processed" immediately —
  rejected because the spec's acceptance scenario (US1 #4) and the design
  screenshot both explicitly show a transient "Processing" state.

## CSV export

- **Decision**: Build the CSV as a string client-side from the current
  in-memory document list (name, size, upload date, status columns) and
  trigger a download via a `Blob` + temporary `<a download>` element — no
  network call.
- **Rationale**: Matches FR-010/FR-009 (no backend involved); standard,
  dependency-free browser pattern.
- **Alternatives considered**: A CSV-generation library (e.g. `papaparse`) —
  unnecessary for four flat, pre-escaped columns; rejected per Principle III.

## Testing stack

- **Decision**: Vitest + React Testing Library for unit tests (validation,
  formatting, CSV builder) and component/integration tests (upload area,
  document list rendering, status transition with fake timers); Playwright
  for one end-to-end spec that drives the real browser through
  upload → list → export, matching constitution Principle II's requirement
  for tests "at every level."
- **Rationale**: Vitest is the natural pairing with a Vite-based React app
  (shared config/transform pipeline); React Testing Library is the standard
  for behavior-focused component tests; Playwright is already the team's
  documented browser-automation tool (`browser-harness` global skill) and
  integrates cleanly with a Vite dev server for e2e.
- **Alternatives considered**: Jest — works, but requires extra config to
  align with Vite's ESM/transform pipeline that Vitest gets for free;
  Cypress — comparable to Playwright but the team already standardizes on
  Playwright-style automation.

## Containerization

- **Decision**: A single-stage-build `Dockerfile` for `frontend/` (Node
  build stage → static file server, e.g. `nginx` or `vite preview`) is added
  in this feature; a repository-root `docker-compose.yml` wiring
  frontend + backend + Qdrant is deferred to the feature that introduces the
  backend and Qdrant integration.
- **Rationale**: Constitution Principle IV requires the app to run via
  Docker, but there is no backend or Qdrant service to compose with yet;
  shipping an empty `backend/` container now would violate Principle III
  (YAGNI) for no benefit. Recorded explicitly in `plan.md`'s Complexity
  Tracking table.
- **Alternatives considered**: Skip Dockerfile entirely until backend
  exists — rejected because it's a small, real step toward Principle IV
  compliance that this feature can deliver on its own without waiting.

# BYORAG

An experimentation tool for building and comparing RAG (Retrieval-Augmented
Generation) pipelines. See `.specify/memory/constitution.md` for the
project's guiding principles.

## Running the app

The app is a React frontend backed by a Python (FastAPI) API that persists
uploaded PDFs to a local `pdfs/` directory — see
`specs/002-persist-pdf-sources/`.

### Option A: Docker Compose (recommended)

```bash
docker compose up --build
```

This runs the backend (`http://localhost:8000`, PDFs stored in a named
Docker volume so they survive container restarts) and the frontend
(`http://localhost:5173`).

### Option B: Run locally

```bash
# Terminal 1: backend
cd backend
uv sync
PDFS_DIR=./pdfs uv run uvicorn app.main:app --reload --port 8000

# Terminal 2: frontend
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api/*` requests to `http://localhost:8000`
(see `frontend/vite.config.ts`), so no extra configuration is needed.

Full instructions (tests, production build) are in
[`frontend/README.md`](frontend/README.md) and
[`backend/README.md`](backend/README.md). See
[`specs/002-persist-pdf-sources/quickstart.md`](specs/002-persist-pdf-sources/quickstart.md)
for an end-to-end validation walkthrough.

## Project layout

- `frontend/` — React + TypeScript + Vite app
- `backend/` — Python + FastAPI source-persistence API
- `specs/` — feature specs, plans, and tasks
- `assets/` — design references (mockups, design tokens)
- `.specify/` — project constitution and spec-driven workflow templates
- `docker-compose.yml` — runs frontend + backend together, with a named
  volume for persisted PDFs

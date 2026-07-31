# BYORAG

**Build (and compare) your own Retrieval-Augmented Generation pipelines.**

BYORAG is a local experimentation tool for RAG, built around per-user accounts so each
user's corpora and experiments stay private to them. Upload PDFs, chunk them,
generate embeddings, inspect the vectors, chat against the retrieved context, and score
the result — every stage is a swappable strategy, so you can change one variable at a
time and see what actually moves the needle.

It exists because there is no universally "correct" way to chunk a document, choose an
embedding model, or retrieve context — RAG quality is subjective and workload-dependent.
BYORAG makes the whole pipeline visible and adjustable instead of hiding it behind a
single hardcoded configuration.

## What you can do with it

| Screen | What it's for |
|---|---|
| **Corpora** | Group source documents into named collections (corpora) you can switch between; a document can belong to more than one corpus. |
| **Sources** | Upload PDFs, browse the document list, and read any document's original PDF side-by-side — expandable to a fullscreen reading view. |
| **Chunking → Fixed Size Chunking** | Configure chunk size and overlap, preview/save the resulting chunks, and select any chunk to see it (plus its neighbors) highlighted directly on the real PDF page(s) it came from, structure and overlap annotation preserved. |
| **Embeddings** | Pick an embedding model (BERT out of the box), generate embeddings for a document's or an entire corpus's saved chunks, and save them to the vector store. |
| **Vector View** | Inspect a chunk's raw embedding vector as a matrix, or project every chunk's vector into 2D (UMAP or PCA) to see how they cluster. |
| **Playground** | Ask a question against a single document or a whole corpus. See the query's embedding, the chunks retrieved by cosine similarity, and a generated answer — as a running chat, so you can ask follow-ups. |
| **Metrics** | Compare RAG pipelines (chunking strategy × embedding model × retrieval strategy) per corpus: chunk/question/answer counts, and LLM-judged quality scores — context precision, context recall, response relevancy, and faithfulness. |

## How it's built

Every stage of the pipeline sits behind a small, registry-based strategy interface, so a
new implementation is a registration, not a rewrite of the surrounding app:

```
PDF upload → Chunking strategy → Embedding model → Retrieval strategy → Generation provider → Evaluation judge
             (fixed-size ✅)      (BERT ✅)          (cosine similarity ✅)  (Anthropic Claude ✅)  (LLM-as-judge ✅)
```

- **Chunking** — `backend/app/chunking/strategies/` (currently: fixed-size, word-count based, with configurable overlap)
- **Embeddings** — `backend/app/embeddings/models/` (currently: `bert-base-uncased`, mean-pooled, 768-dim)
- **Retrieval** — `backend/app/retrieval/strategies/` (currently: cosine similarity over pgvector)
- **Generation** — `backend/app/generation/providers/` (currently: Anthropic Claude)
- **Evaluation** — `backend/app/evaluation/strategies/` (currently: an Anthropic-backed LLM judge scoring context precision/recall, response relevancy, and faithfulness)

Everything downstream of a saved chunk — embeddings, retrieval results, chat turns,
quality scores — stays traceable back to the configuration that produced it, so
different pipelines run on the same corpus can be compared meaningfully in Metrics.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, `react-pdf`, `recharts` |
| Backend | Python 3.12, FastAPI, SQLAlchemy |
| Data | PostgreSQL with the `pgvector` extension — one database for relational metadata (corpora, documents, chunks), vector storage, and PDF content itself |
| ML / NLP | `transformers` + `torch` (BERT embeddings), `scikit-learn` + `umap-learn` (2D projections) |
| LLM | Anthropic Claude — used for both chat generation and judge-based evaluation |
| Testing | `pytest` (backend), `Vitest` (frontend unit/integration), `Playwright` (frontend e2e) |
| Deployment | Docker / Docker Compose |

## Running the app

### Option A: Docker Compose (recommended)

```bash
docker compose up --build
```

This runs Postgres (with `pgvector`), the backend (`http://localhost:8000`), and the
frontend (`http://localhost:5173`) together, with named volumes so uploaded PDFs and the
database survive container restarts.

Set `KEY_ENCRYPTION_SECRET` (any string) before starting — it's used to encrypt each
user's personal Anthropic API key at rest:

```bash
export KEY_ENCRYPTION_SECRET=some-random-string
docker compose up --build
```

### Option B: Run locally

```bash
# Postgres with pgvector (skip if you already have one running)
docker run -d --name byorag-postgres -p 5432:5432 \
  -e POSTGRES_USER=byorag -e POSTGRES_PASSWORD=byorag -e POSTGRES_DB=byorag \
  pgvector/pgvector:pg16

# Terminal 1: backend
cd backend
uv sync
PDFS_DIR=./pdfs KEY_ENCRYPTION_SECRET=some-random-string uv run uvicorn app.main:app --reload --port 8000

# Terminal 2: frontend
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api/*` requests to `http://localhost:8000` (see
`frontend/vite.config.ts`), so no extra frontend configuration is needed.

Either way, once the app is up, open it in the browser and sign up for an account —
every corpus, document, and everything nested under it belongs to exactly one account, so
there's nothing to upload or browse until you're signed in. The very first account ever
created on a given database automatically claims any pre-existing corpora/documents (e.g.
if you're upgrading a pre-multi-user install).

To use Playground (chat generation) or Metrics (judge scoring), each user adds their own
Anthropic API key from the Profile screen (top-right icon) — there is no shared/server-
wide key. Playground and Metrics stay disabled in the sidebar, with an explanatory
tooltip, until a personal key is on file.

### Environment variables (backend)

| Variable | Default | Purpose |
|---|---|---|
| `PDFS_DIR` | `./pdfs` | A one-time legacy-import source directory only — any PDFs found here at startup are migrated into the database and claimed by the first account to sign up. Uploaded PDFs are stored directly in Postgres, not on disk, so this is unused in ordinary operation. |
| `DATABASE_URL` | `postgresql+psycopg://byorag:byorag@localhost:5432/byorag` | Postgres connection string |
| `KEY_ENCRYPTION_SECRET` | *(none)* | Any string; used to encrypt each user's personal Anthropic API key at rest (Profile screen). Required for Playground/Metrics to work for any user. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Model used for both generation and evaluation, with each user's own key |
| `GENERATION_PROVIDER` | `anthropic` | Registry key for the active generation provider |

## Testing

```bash
# Backend
cd backend && uv run pytest

# Frontend — unit + integration
cd frontend && npm run test

# Frontend — end-to-end (starts its own dev server)
cd frontend && npm run test:e2e
```

The project follows test-first development: every feature has unit tests, integration
tests for multi-step flows, and (for user-facing flows) end-to-end coverage. See
`backend/tests/` and `frontend/tests/`.

## Development workflow

Features are built through a spec-driven workflow (spec → plan → tasks → implement) —
every feature under `specs/` has a specification, an implementation plan, and a task
breakdown before any code is written. The ground rules for that process live in
[`.specify/memory/constitution.md`](.specify/memory/constitution.md): pluggable pipeline
stages, test-first development, multi-user simplicity (per-user data ownership, without
premature sharing/roles/SSO complexity), a fixed technology stack, and full experiment
traceability.

## Project layout

```
frontend/    React + TypeScript + Vite app (one component tree per screen, see above)
backend/     Python + FastAPI API (one module per pipeline stage/screen: chunking,
             embeddings, retrieval, generation, evaluation, corpora, sources, metrics,
             playground, system)
specs/       Feature specs, plans, and tasks — one directory per feature, in build order
assets/      Original design references (mockups, design tokens)
.specify/    Project constitution and spec-driven workflow templates
docker-compose.yml   Runs Postgres + backend + frontend together
```

# byorag backend

Source-document persistence API for the BYORAG Data Sources screen. See
`/specs/002-persist-pdf-sources/` for the feature spec, plan, and contracts.

Also exposes `GET /api/system/capacity`, which reports the host machine's
processor/GPU/memory (via `psutil`, plus a best-effort `nvidia-smi` GPU
check) and a derived, order-of-magnitude PDF processing capacity estimate
for local RAG. See `/specs/003-system-capacity-widget/` for the feature
spec, plan, and contract.

Also exposes `POST /api/chunking/run`, which extracts a selected document's
text (via `pypdf`) and splits it using a registered chunking strategy —
currently only `"fixed-size"` (word-count-based splitting) is implemented,
behind a small pluggable strategy registry so more can be added later. See
`/specs/005-fixed-size-chunking/` for the feature spec, plan, and contract.

## Running locally

```bash
uv sync
PDFS_DIR=./pdfs uv run uvicorn app.main:app --reload --port 8000
```

## Running tests

```bash
uv run pytest
```

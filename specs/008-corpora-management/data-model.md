# Phase 1 Data Model: Corpora Management with Persistent Storage

All four entities are persisted in PostgreSQL (`research.md` §1–§2). Raw PDF bytes continue to live
on the filesystem (`PDFS_DIR`, unchanged from `002-persist-pdf-sources`); the tables below store
metadata and relationships only.

## Corpus

Represents a named collection — a user's area of interest (spec Key Entities, FR-001).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | primary key, server-generated | |
| `name` | text | `NOT NULL`, `UNIQUE` | FR-014 — rejecting a duplicate name is a `409` at the API layer, backed by this constraint. |
| `created_at` | timestamptz | `NOT NULL`, default `now()` | |

**Validation rules**:
- `name` must be non-empty after trimming whitespace (spec Edge Cases) — enforced at the API/schema
  layer (Pydantic), not just the DB `NOT NULL`.
- No `is_default`/`is_protected` flag — the "Uncategorized" corpus created by the startup migration
  (`research.md` §2) is an ordinary row, renamable and deletable like any other once empty
  (Clarification: default-corpus protection).

**Lifecycle**: Created via `POST /api/corpora`. Deleted via `DELETE /api/corpora/{id}`, blocked
(`409`) while any `document_corpora` row references it (FR-013, `research.md` §5).

## Document

Represents an uploaded source file (spec Key Entities). Metadata only — the file itself stays in
`PDFS_DIR`.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | primary key, server-generated | Replaces the current on-disk-filename-as-id scheme from `002-persist-pdf-sources`, since a filename is no longer guaranteed unique across dedup'd re-uploads. |
| `name` | text | `NOT NULL` | Original uploaded filename, shown in the UI; not unique (Assumption: documents may share a file name across corpora). |
| `content_hash` | text (64-char hex) | `NOT NULL`, `UNIQUE` | SHA-256 of file bytes (`research.md` §3); drives upload dedup. |
| `storage_path` | text | `NOT NULL` | Path within `PDFS_DIR` where the bytes are stored. |
| `size_bytes` | integer | `NOT NULL` | |
| `status` | text | `NOT NULL`, one of `processing` \| `processed` | Carried over from `002-persist-pdf-sources`. |
| `uploaded_at` | timestamptz | `NOT NULL`, default `now()` | |

**Validation rules** (unchanged from `002-persist-pdf-sources`, still enforced server-side):
- File name must end in `.pdf` (case-insensitive) or declare `content-type: application/pdf`.
- File size must be ≤ 50MB.

**Relationships**:
- Many-to-many with `Corpus` via `document_corpora` (FR-010).
- One-to-many with `Chunk` (FR-011) — a document's chunks are independent of how many corpora it
  belongs to.

**Lifecycle / invariant**: A `Document` row only exists while it has at least one `document_corpora`
row (spec Key Entities: "A document must belong to at least one corpus to exist"). Upload
(`POST /api/sources`) always creates or links exactly one association to the target corpus.
Unlinking a document from its last corpus deletes the `Document` row, all its `Chunk` rows, and its
file (`research.md` §6, FR-008).

## DocumentCorpus (join table: `document_corpora`)

The many-to-many association between `Document` and `Corpus` (spec Key Entities).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `document_id` | UUID | `NOT NULL`, FK → `documents.id` `ON DELETE CASCADE` | |
| `corpus_id` | UUID | `NOT NULL`, FK → `corpora.id` `ON DELETE RESTRICT` | `RESTRICT` is the defense-in-depth backstop behind the application-level guard in `research.md` §5. |
| `added_at` | timestamptz | `NOT NULL`, default `now()` | |

**Primary key**: composite (`document_id`, `corpus_id`) — a document can only be linked to a given
corpus once (attaching an already-linked document again, FR-006, is a no-op).

## Chunk

A segment of a document produced by a chunking strategy run (spec Key Entities, FR-011).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | primary key, server-generated | |
| `document_id` | UUID | `NOT NULL`, FK → `documents.id` `ON DELETE CASCADE` | Belongs to exactly one document, regardless of the document's corpus memberships. |
| `index` | integer | `NOT NULL` | Position within the document's chunk sequence (matches existing `Chunk.index` in `chunking/schemas.py`). |
| `content` | text | `NOT NULL` | |
| `strategy` | text | `NOT NULL` | e.g. `"fixed-size"` — carried over from `ChunkingResult.strategy` for traceability (Constitution V). |
| `chunk_size` | integer | `NOT NULL` | From `ChunkingResult.chunkSize`. |
| `overlap` | integer | `NOT NULL` | From `ChunkingResult.overlap`. |

**Unique constraint**: (`document_id`, `index`) — one row per position per document.

**Lifecycle**: Written by the chunking stream's terminal `result` event (`research.md` §9). A
re-run for the same document deletes and replaces all of that document's `Chunk` rows in one
transaction (no run history is retained — `research.md` §9 alternatives).

## Entity-Relationship Summary

```
Corpus (1) ──< document_corpora >── (1) Document (1) ──< Chunk
        many-to-many                              one-to-many
```

- `Corpus` ↔ `Document`: many-to-many via `document_corpora` (FR-010).
- `Document` → `Chunk`: one-to-many, independent of corpus membership (FR-011).
- A `Document` with zero `document_corpora` rows cannot exist (enforced by the unlink transaction in
  `research.md` §6, not by a DB constraint — SQL has no native "must have ≥1 child" constraint on the
  parent-optional side of a join table).

## Relationship to existing frontend types

`frontend/src/types/sourceDocument.ts` (from `001`/`002`) already defines `SourceDocument`; this
feature:
- Adds `corpusIds: string[]` (or equivalent) is **not** needed on the wire type itself — the Sources
  API stays scoped to one corpus at a time via a `corpusId` query param (`contracts/sources-api.md`),
  so a `SourceDocument` in a given response is implicitly "in this corpus."
- `SourceDocument.id` changes from the on-disk filename to the server-generated `Document.id` (UUID)
  — a breaking change from `002-persist-pdf-sources`, required because filenames are no longer
  guaranteed unique once dedup'd re-uploads are possible.

A new `frontend/src/types/corpus.ts` is added:

```ts
export interface Corpus {
  id: string
  name: string
  createdAt: Date
}
```

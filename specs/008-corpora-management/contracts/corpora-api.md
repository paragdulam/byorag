# Contract: Corpora API

Base path: `/api/corpora`. No authentication (single local user, Constitution III).

New in this feature — there is no prior `corpora` endpoint to replace.

---

## `GET /api/corpora`

Lists all corpora, ordered by `created_at` ascending.

**Response**: `200 OK`

```json
{
  "corpora": [
    { "id": "b3f1...", "name": "Uncategorized", "createdAt": "2026-07-14T10:00:00Z" },
    { "id": "9ac2...", "name": "Contract Law Research", "createdAt": "2026-07-14T10:05:00Z" }
  ]
}
```

An empty `corpora` array is a valid response (spec User Story 1, Acceptance Scenario 1 — no corpora
exist yet) and only occurs before the startup migration has ever run or on a fresh database with no
legacy PDFs and no user-created corpora.

---

## `POST /api/corpora`

Creates a new corpus (FR-001).

**Request body**:

```json
{ "name": "Contract Law Research" }
```

**Response**: `201 Created`

```json
{ "id": "9ac2...", "name": "Contract Law Research", "createdAt": "2026-07-14T10:05:00Z" }
```

**Errors**:
- `400 Bad Request` — `name` missing, empty, or whitespace-only:
  ```json
  { "detail": "Corpus name must not be empty" }
  ```
- `409 Conflict` — a corpus with this name already exists (FR-014, case-sensitive match):
  ```json
  { "detail": "A corpus named 'Contract Law Research' already exists" }
  ```

---

## `PATCH /api/corpora/{id}`

Renames a corpus. Applies uniformly to every corpus, including the system-created "Uncategorized"
one (Clarification: ordinary, not protected).

**Request body**:

```json
{ "name": "Renamed Corpus" }
```

**Response**: `200 OK` — same shape as `POST /api/corpora`.

**Errors**: same `400`/`409` conditions as `POST /api/corpora`; `404 Not Found` if `id` doesn't
exist.

---

## `DELETE /api/corpora/{id}`

Deletes a corpus. Blocked while any document is still associated with it (FR-013).

**Response**: `204 No Content` on success.

**Errors**:
- `404 Not Found` — no corpus with this `id`.
- `409 Conflict` — the corpus still has associated documents:
  ```json
  { "detail": "Cannot delete corpus 'Contract Law Research': 3 document(s) still associated. Remove or reassign them first." }
  ```

---

**Field semantics**:
- `id` — server-generated UUID, stable for the corpus's lifetime.
- `createdAt` — ISO 8601 UTC datetime, set once at creation, unaffected by rename.
- There is no "active corpus" concept on the backend (`research.md` §7) — the frontend tracks which
  corpus is currently selected and passes its `id` as `corpusId` on every corpus-scoped request to
  the Sources API (`contracts/sources-api.md`).

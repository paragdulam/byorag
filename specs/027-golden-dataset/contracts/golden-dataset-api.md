# Contract: Golden Dataset API

Base path: `/api/golden-dataset`. Session-cookie authenticated like every other endpoint
(`require_user` dependency); every route enforces corpus/document/entry ownership via
`get_corpus_owned_by`/`get_document_owned_by`/`get_golden_dataset_entry_owned_by`
(`backend/app/db/lookups.py`), returning `404` for both "doesn't exist" and "not yours" —
consistent with every other feature's ownership-check convention.

Scope on every request is exactly one of `documentId` or `corpusId` (never both, never neither),
same `_require_exactly_one_scope` pattern `playground/service.py` already enforces.

---

## `POST /api/golden-dataset/candidates`

Runs the merged question-search + answer-search candidate lookup (research.md §1). Called live
while the manual-creation editor is open — never persists anything.

**Request**:
```json
{
  "corpusId": "b6b8...",
  "documentId": null,
  "question": "What is the notice period for termination?",
  "answer": "Either party may terminate with 30 days written notice."
}
```
`answer` is optional — omit or send `null`/`""` while the SME hasn't written one yet; the search
then runs question-only (still returns candidates, just without any `matchedAnswer: true` results).

**Response** `200`:
```json
{
  "candidates": [
    {
      "chunkId": "c1a2...",
      "documentId": "d9f0...",
      "chunkIndex": 12,
      "content": "Either party may terminate this agreement...",
      "matchedQuestion": true,
      "matchedAnswer": true
    }
  ]
}
```
Ordered by combined RRF score descending, `rrfScore` itself not included in the response (ordering
is sufficient; the number has no independent meaning to a user — data-model.md). Up to ~10
candidates (research.md §1's default).

**Errors**: `400` — neither/both of `documentId`/`corpusId` given, or `question` blank.
`404` — corpus/document not found or not owned by the caller.

---

## `POST /api/golden-dataset/draft-answer`

Drafts an answer grounded only in the given chunk contents (FR-007). Never persists anything;
requires the caller's own Anthropic key (research.md §9).

**Request**:
```json
{
  "question": "What is the notice period for termination?",
  "chunks": [
    { "chunkIndex": 12, "content": "Either party may terminate this agreement..." }
  ]
}
```

**Response** `200`:
```json
{ "draftAnswer": "Either party may terminate the agreement with 30 days' written notice." }
```

**Errors**: `400` — `chunks` empty, or the caller has no Anthropic key on file (matches
`NoApiKeyError`'s existing HTTP mapping in `playground/router.py`). `502` — the Anthropic call
itself failed (`GenerationError`).

---

## `POST /api/golden-dataset/entries`

Creates a manual entry (FR-001). Saved as `approved` immediately (FR-008).

**Request**:
```json
{
  "corpusId": "b6b8...",
  "documentId": null,
  "question": "What is the notice period for termination?",
  "preferredAnswer": "Either party may terminate with 30 days written notice.",
  "chunks": [
    { "chunkId": "c1a2...", "documentId": "d9f0...", "chunkIndex": 12, "content": "Either party may terminate this agreement..." }
  ]
}
```
`chunks[].chunkId` is a best-effort live reference (may later go `null` on re-chunk, per
data-model.md); `content`/`chunkIndex`/`documentId` are what actually get snapshotted (FR-016) —
the client sends the exact content it showed the user, not just an id, so the snapshot is
independent of any server-side re-fetch racing a concurrent re-chunk.

**Response** `201`: a full `GoldenDatasetEntryOut` (see GET below).

**Errors**: `400` — `chunks` empty (FR-002/SC-005 — "at least one evidence chunk required").
`404` — corpus/document not found or not owned.

---

## `GET /api/golden-dataset/entries`

Lists/filters entries for a corpus (FR-015).

**Request** (query params): `corpusId` (required), `status` (optional, repeatable —
`approved`/`pending_review`/`rejected`), `source` (optional, repeatable —
`manual`/`llm_generated`).

**Response** `200`:
```json
{
  "entries": [
    {
      "id": "e1...",
      "corpusId": "b6b8...",
      "documentId": "d9f0...",
      "question": "What is the notice period for termination?",
      "status": "approved",
      "source": "manual",
      "createdAt": "2026-08-01T10:00:00Z"
    }
  ]
}
```
List items are a summary shape (no `preferredAnswer`/`chunks` — fetched via GET-one when a row is
opened in the editor), matching how `DocumentList`/`RetrievalPanel` already separate list rows from
full detail fetches elsewhere in this codebase.

---

## `GET /api/golden-dataset/entries/{id}`

Fetches one entry in full, for the shared editor.

**Response** `200`:
```json
{
  "id": "e1...",
  "corpusId": "b6b8...",
  "documentId": "d9f0...",
  "question": "What is the notice period for termination?",
  "preferredAnswer": "Either party may terminate with 30 days written notice.",
  "status": "approved",
  "source": "manual",
  "chunks": [
    { "id": "gec1...", "chunkId": "c1a2...", "documentId": "d9f0...", "chunkIndex": 12, "content": "Either party may terminate this agreement..." }
  ],
  "createdAt": "2026-08-01T10:00:00Z",
  "updatedAt": "2026-08-01T10:00:00Z",
  "reviewedAt": null
}
```

**Errors**: `404` — not found or not owned.

---

## `PATCH /api/golden-dataset/entries/{id}`

One endpoint for every post-creation change the shared editor makes: editing an approved entry
(FR-017), reviewing/approving/rejecting a pending entry (FR-012, FR-013), and reopening a rejected
one (FR-013a) — all are "change some fields and/or move the status," so they share one request
shape rather than one endpoint per transition.

**Request** (all fields optional — send only what changed):
```json
{
  "question": "…",
  "preferredAnswer": "…",
  "chunks": [ { "chunkId": "…", "documentId": "…", "chunkIndex": 12, "content": "…" } ],
  "status": "approved"
}
```
`status` may be set to any of `approved`/`pending_review`/`rejected` regardless of the entry's
current status (data-model.md's state diagram — no transition is blocked except the invariant
below).

**Response** `200`: the updated `GoldenDatasetEntryOut` (same shape as GET-one).

**Errors**: `400` — the request would leave `status: "approved"` with zero chunks (FR-002/FR-018's
invariant applies to every save, not just creation). `404` — not found or not owned.

---

## `DELETE /api/golden-dataset/entries/{id}`

FR-018. Cascades to its `GoldenDatasetEntryChunk` rows automatically (data-model.md).

**Response** `204`.

**Errors**: `404` — not found or not owned.

---

## `POST /api/golden-dataset/generate`

Generates one complete candidate entry from a corpus, optionally narrowed to one document within
it (FR-009), evidence-first (research.md §5). Always saved as `pending_review` (FR-011) — batch
generation (User Story 3) is N sequential calls to this same endpoint from the frontend
(research.md §4), not a separate batch endpoint.

**Request**: `corpusId` is always required — unlike `/candidates` (which XORs documentId/corpusId
for its search operation), a generated entry always needs a home corpus for
`GoldenDatasetEntry.corpus_id`, which is never null (data-model.md — corpus is the entry's
always-on scope, document is an optional narrowing, not an alternative). `documentId`, when given,
narrows which document's chunks generation samples from; omitted or null means "anywhere in the
corpus" (research.md §5 addendum).
```json
{ "corpusId": "b6b8...", "documentId": null }
```

**Response** `201`: a full `GoldenDatasetEntryOut` with `"source": "llm_generated"`,
`"status": "pending_review"`.

**Errors**: `400` — the scope has no chunked content to generate from, or the caller has no
Anthropic key on file. `502` — the Anthropic call failed; per spec FR-010a, nothing is saved in
this case (the frontend's batch loop treats this response as that item's failure and continues to
the next).

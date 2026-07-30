# Data Model: User Authentication & Per-User Data Ownership

## New entities

### User

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (string) | Primary key |
| `email` | string | Unique (case-insensitively — normalized to lowercase before storage/lookup) |
| `password_hash` | string | `bcrypt` hash (research.md §1); never serialized in any API response |
| `created_at` | datetime (tz-aware) | |

**Validation rules**: `email` must be non-empty and unique; rejected with `409` on
duplicate signup (Edge Cases). `password_hash` is never null once a row exists — a `User`
row is only ever created alongside a hashed password in the same transaction.

### Session

| Field | Type | Notes |
|---|---|---|
| `id` / `token` | string | Opaque random token (primary key or unique-indexed); returned to the client once, at signup/login |
| `user_id` | UUID (string), FK → `users.id`, `ON DELETE CASCADE` | |
| `created_at` | datetime (tz-aware) | |
| `revoked_at` | datetime (tz-aware), nullable | `NULL` = still active; set at logout |

**Lifecycle**: created at signup/login, `revoked_at` set at logout. No `expires_at` column
— FR-004 requires the session to persist across normal browser restarts until explicit
logout, with no forced expiry (matching the "no rate limiting/lockout, no automatic
timeout" simplicity clarified for this feature). A user can hold more than one active
`Session` row at once (Edge Cases: multiple devices/browsers stay independently logged
in).

## Extended entities

### Corpus *(existing, extended)*

| Field | Change |
|---|---|
| `user_id` | **New.** UUID (string), FK → `users.id`. Nullable at the DB level only to tolerate rows that predate this feature (research.md §2); every application-level read/write treats a null `user_id` as inaccessible. |
| `name` uniqueness | **Changed.** Was globally unique; now unique **per `user_id`** (two different accounts may each have a corpus named "Research"). |

Everything already nested under a `Corpus` (via existing FKs — `documents` through
`document_corpora`, and directly, `chunks`, `embeddings`, `conversation_turns`,
`turn_quality_scores`) inherits its access scope from the corpus's `user_id` — no new
`user_id` column is needed on those descendant tables themselves, except `Document` (below),
which gets one for direct-query efficiency (research.md §7).

### Document *(existing, extended)*

| Field | Change |
|---|---|
| `user_id` | **New.** UUID (string), FK → `users.id`. Set once, at upload, to the uploading user's id. Nullable at the DB level only for the same pre-existing-row reason as `Corpus.user_id`. |
| `content` | **New.** `bytes` (`LargeBinary`). The PDF's raw content, replacing `storage_path`. |
| `storage_path` | **Removed.** |

**New invariant**: a `Document` may only be linked (via `DocumentCorpus`) to `Corpus` rows
sharing its own `user_id` — enforced in `attach_document_to_corpus` and at upload time
(research.md §7), not at the database level (mirrors how this codebase already validates
other cross-field invariants — e.g. `ConversationTurn.scope` vs. its `document_id`/
`corpus_id` — at the service layer rather than via a DB constraint).

## Relationships (new/changed only)

```
User 1──* Session
User 1──* Corpus            (Corpus.user_id)
User 1──* Document          (Document.user_id, denormalized — see research.md §7)
Corpus *──* Document          (via DocumentCorpus, unchanged — but now constrained to
                               same-owner corpora/documents only)
```

## Authorization semantics (cross-cutting, not a new entity)

- Every request must resolve to a valid, non-revoked `Session` → `User` (via
  `require_user`, research.md §9) or receive `401`.
- Every corpus-or-document-scoped read/write additionally asserts
  `row.user_id == current_user.id`; a mismatch (or a row belonging to no one, i.e. not yet
  backfilled) returns the same `404` used for "doesn't exist" — never a `403` — so a
  cross-account ID probe is indistinguishable from a typo (FR-009).
- The very first `User` ever created inherits every `Corpus`/`Document` row still lacking a
  `user_id`, inside its own signup transaction (research.md §3, FR-013).

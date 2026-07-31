# Data Model: User Profile & Personal Anthropic API Key

## New entity

### UserAnthropicKey (`user_anthropic_keys`)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (string) | Primary key |
| `user_id` | UUID (string), FK → `users.id`, `ON DELETE CASCADE`, **unique** | One row per user — a unique index enforces "at most one active key" (spec Key Entities) at the DB level, not just in the service layer |
| `encrypted_key` | string (`Text`) | `Fernet` ciphertext (base64), research.md §1 — never the plaintext key |
| `last_four` | string(4) | Last 4 characters of the plaintext key, stored alongside the ciphertext purely for masked display (FR-010); never enough on its own to reconstruct the key |
| `created_at` | datetime (tz-aware) | Set once, at first save |
| `updated_at` | datetime (tz-aware) | Bumped on every replace (add→update transitions through the same row) |

**Validation rules**:
- `user_id` is unique — adding a key when one already exists is an **update** (upsert),
  never a second row (spec Assumptions: "at most one personal key per user").
- `encrypted_key` and `last_four` are always written together in the same transaction —
  never a row with one set and not the other.
- Row is only created/replaced after live validation succeeds (FR-008) — a failed
  validation touches no row.
- Deleting removes the row entirely (not a soft-delete/nulled flag) — matches FR-007 and
  Edge Cases ("no longer shown, even in masked form").

**Relationships**:
```
User 1──0..1 UserAnthropicKey   (UserAnthropicKey.user_id, unique)
```

No relationship to `Corpus`/`Document`/`ConversationTurn` — the key is resolved
per-request from the *acting* user (the one making the Generation call or owning the turn
being scored), not stored against any of those rows (research.md §3, §4).

## Extended entity

### User *(existing, extended — API surface only, no schema change)*

`GET /api/auth/me`'s response gains `createdAt` (already a column on `users`, per
024-user-authentication's `data-model.md`; simply not exposed until now). No new column,
no migration beyond the new `UserAnthropicKey` table.

## Derived / call-time concept (not a stored entity)

**Acting user's Anthropic key availability** — not a database field, but state the
frontend needs on load and after every add/update/delete: whether `UserAnthropicKey`
exists for the current user, plus its masked form. Sourced from `GET
/api/profile/anthropic-key` (contracts/profile-api.md) and held in `AuthContext` so
`SidebarNav` can gate Playground/Metrics without a separate fetch per screen
(research.md §5).

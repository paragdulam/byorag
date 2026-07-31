# Contract: Profile & Anthropic Key API

New router, `app/profile/router.py`, mounted at `/api/profile`. Every endpoint below
requires a valid session (`Authorization: Bearer <token>`, via `require_user` — same as
every other non-auth endpoint since 024-user-authentication) and operates only on the
calling user's own data (FR-004, FR-011).

## `GET /api/profile/anthropic-key`

**Request**: none.

**Response 200**:
```jsonc
// A key is on file:
{ "hasKey": true, "maskedKey": "sk-ant-...wxyz" }

// No key on file:
{ "hasKey": false, "maskedKey": null }
```

**Behavior**: Never returns the plaintext key (FR-010, SC-004). `maskedKey` shows only the
last 4 characters (data-model.md). Used both by the Profile screen and by `AuthContext` on
load to decide whether Playground/Metrics should render enabled (research.md §5).

## `PUT /api/profile/anthropic-key`

Add **or** update — the same endpoint, since at most one key exists per user
(data-model.md); the service layer upserts.

**Request**:
```jsonc
{ "apiKey": "sk-ant-..." }
```

**Response 200**:
```jsonc
{ "hasKey": true, "maskedKey": "sk-ant-...wxyz" }
```

**Behavior**:
1. Reject empty/whitespace-only `apiKey` before any live call (FR-009) → `422`.
2. Live-validate against Anthropic (`client.models.list(limit=1)`, research.md §2).
3. On success: encrypt, upsert the `UserAnthropicKey` row, return the new masked form.
4. On failure: no row is touched — a prior key (if any) is left exactly as it was
   (FR-008, spec Acceptance Scenario US2.4).

**Errors**:
- `422` — empty/whitespace key (FR-009).
- `400` — Anthropic rejected the key as invalid (`AuthenticationError`) — message
  distinguishes this from...
- `502` — Anthropic was unreachable/timed out while validating (`APIConnectionError`/
  `APITimeoutError`) — "couldn't verify the key right now, try again" (Edge Cases), not the
  same message as an actually-invalid key.

## `DELETE /api/profile/anthropic-key`

**Request**: none.

**Response**: `204`, whether or not a key existed (idempotent — mirrors `POST
/api/auth/logout`'s idempotent-revoke pattern; spec US3 Acceptance Scenario 3: "no error
occurs" when there's nothing to delete).

**Behavior**: Removes the `UserAnthropicKey` row entirely, if present.

## `GET /api/auth/me` — response shape change (existing endpoint)

```jsonc
{ "id": "uuid", "email": "person@example.com", "createdAt": "2026-07-31T12:00:00Z" }
```

`createdAt` is new (data-model.md — existing `users.created_at` column, not previously
exposed). Powers the Profile screen's account-info display (FR-002). No behavior change to
auth itself.

## Existing endpoints — behavior change (not new contracts, cross-cutting)

**`POST /api/playground/turns/{turnId}/generate`**:
- Resolves the acting user's `UserAnthropicKey` before calling the generation provider.
- `400` — no valid key on file, with a message directing the user to Profile (FR-013;
  same status-code family as this endpoint's existing `UnsupportedModelError`/
  `NoSavedEmbeddingsError` → `400`s).
- The background quality-scoring task (`evaluation_service.score_turn`) is unaffected by
  this response — it independently resolves its own key and no-ops (stays unscored) if the
  acting user has none (FR-017, research.md §4). No new status code here since scoring
  already runs after the response has been sent.

No other existing endpoint's contract changes.

# Contract: Authentication API

New router, `app/auth/router.py`, mounted at `/api/auth`.

## `POST /api/auth/signup`

**Request**:
```jsonc
{ "email": "person@example.com", "password": "at-least-something" }
```

**Response 201**:
```jsonc
{
  "user": { "id": "uuid", "email": "person@example.com" },
  "token": "opaque-session-token"
}
```

**Errors**:
- `400` — empty email or password
- `409` — an account with this email already exists (Edge Cases)

**Side effect**: if this is the very first `User` row ever created, every `Corpus`/
`Document` row still lacking a `user_id` is assigned to this new user in the same
transaction (research.md §3, FR-013).

## `POST /api/auth/login`

**Request**:
```jsonc
{ "email": "person@example.com", "password": "..." }
```

**Response 200**: same shape as signup's response (`user` + `token`).

**Errors**:
- `401` — unknown email or incorrect password, with one **generic** message covering both
  cases (FR-002 — never reveal which part was wrong)

## `POST /api/auth/logout`

**Request**: none (session identified via `Authorization: Bearer <token>`)

**Response**: `204`

**Behavior**: sets `revoked_at` on the current session. Idempotent — logging out an
already-revoked/unknown token still returns `204`.

## `GET /api/auth/me`

**Request**: none (session identified via `Authorization: Bearer <token>`)

**Response 200**:
```jsonc
{ "id": "uuid", "email": "person@example.com" }
```

**Errors**: `401` — no/invalid/revoked session. Used by the frontend on load to determine
whether to render the signed-in app or the login/sign-up screen (no separate "ping"
endpoint needed).

## Token transport (applies to every endpoint below, not just `/api/auth/*`)

Every existing and new endpoint (except the four above) requires a valid session,
supplied as **either**:
- `Authorization: Bearer <token>` header (used by all regular `fetch` calls, via the new
  `apiClient.ts` wrapper — research.md §6), or
- `?token=<token>` query parameter (used only by the two `EventSource`-based streaming
  endpoints, which cannot set custom headers — research.md §5).

Missing/invalid/revoked token → `401` on every one of them.

## Existing endpoints — behavior change (not a new contract, a cross-cutting addition)

Every existing endpoint under `/api/corpora`, `/api/sources`, `/api/chunking`,
`/api/embeddings`, `/api/playground`, `/api/metrics`, and `/api/system` now:
1. Requires the token above (`401` if missing/invalid).
2. Scopes any corpus/document list to the current user's own rows only.
3. Returns the existing `404` (not a new `403`) for any corpus/document ID that exists but
   belongs to a different account (FR-009) — i.e., today's "unknown ID" response is reused
   for "not yours" too.

No endpoint's request/response *body* shape changes — only the authorization gate wrapping
each one.

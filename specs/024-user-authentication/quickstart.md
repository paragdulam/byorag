# Quickstart: User Authentication & Per-User Data Ownership

Validation scenarios proving each user story works end-to-end. Run against a local dev
stack, ideally starting from a **fresh database** so the first-signup backfill (FR-013)
can be exercised meaningfully — or against the existing dev database, to confirm that
scenario against real pre-existing corpora/documents.

## Prerequisites

- Stack running (`docker-compose up` or local `uv run uvicorn` + `npm run dev`).
- Two distinct email addresses available for the two-account scenarios below.

## US1 — Create an account and log in

1. Open the app with no session. **Expect**: the login/sign-up screen, not any BYORAG
   screen (FR-006).
2. Sign up with a new email + password. **Expect**: account created, immediately logged
   in, landing on the app (FR-001, SC-001 — under a minute).
3. Log out, then log back in with the same credentials. **Expect**: logged in again
   (FR-002).
4. Attempt login with the right email but wrong password. **Expect**: rejected with a
   generic error that doesn't reveal whether the email or password was the problem
   (FR-002).
5. Log in, then close and reopen the browser (not just the tab) without logging out.
   **Expect**: still logged in (FR-004).
6. Sign up again with an email that already has an account. **Expect**: rejected with a
   clear "already exists" message (Edge Cases).

## US2 — Everything requires login, and stays private per account

1. While signed out, attempt to navigate directly to any screen (Corpora, Sources,
   Chunking, Embeddings, Vector View, Playground, Metrics). **Expect**: redirected to
   login every time (FR-006, SC-002).
2. Sign up as User A, create a corpus, upload a document into it.
3. Log out, sign up as User B. **Expect**: User B's Corpora screen is empty — User A's
   corpus does not appear (FR-007, FR-008, SC-003).
4. As User B, attempt to reach one of User A's corpus/document IDs directly (e.g. by
   editing a URL/request to a known ID from step 2). **Expect**: denied with the same
   "not found" response used for a nonexistent ID — not a distinguishable
   "forbidden" (FR-009).
5. **Fresh-database-only**: before either signup above, confirm the database already has
   pre-existing corpora/documents (e.g. from prior manual testing). Sign up as the very
   first account. **Expect**: that account's Corpora screen already shows all pre-existing
   corpora, not an empty state (FR-013).

## US3 — PDFs live in the database

1. As a logged-in user, upload a PDF. **Expect**: upload succeeds exactly as before
   (FR-010).
2. Restart the backend process (`docker compose restart backend` or re-run `uvicorn`).
   **Expect**: the same document still previews, opens in fullscreen, chunks, and
   in-context-previews correctly — no broken/missing file (FR-012, SC-004).
3. Inspect the local `pdfs/` directory (or its Docker volume) after the restart.
   **Expect**: no new file was written there for this upload — the content lived only in
   the database (FR-010, FR-011).

## Contract-level checks

- `POST /api/auth/signup` / `/login` return `{ user, token }`; `GET /api/auth/me` returns
  `{ id, email }` for a valid token, `401` otherwise (contracts/auth-api.md).
- Every existing endpoint now returns `401` with no token, and `404` (not `403`) for a
  valid-but-not-owned corpus/document ID (contracts/auth-api.md).
- The two SSE endpoints (chunking and embeddings run/save streams) authenticate via a
  `?token=` query parameter and behave identically to header-based auth otherwise
  (research.md §5).

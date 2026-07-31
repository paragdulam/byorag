# Quickstart: User Profile & Personal Anthropic API Key

Validation scenarios proving each user story works end-to-end. Run against a local dev
stack with at least two distinct user accounts (from 024-user-authentication) and a real,
valid Anthropic API key you're willing to spend a `models.list` call on (no generation
tokens are consumed by validation itself — research.md §2).

## Prerequisites

- Stack running (`docker-compose up`, with `KEY_ENCRYPTION_SECRET` set — see
  contracts/profile-api.md and research.md §1) or local `uv run uvicorn` + `npm run dev`.
- Two logged-in accounts, User A and User B.
- One real Anthropic API key (valid), and a made-up string to use as an invalid one.

## US1 — View account info and log out

1. Log in as User A, open the Profile section from anywhere in the app. **Expect**: email
   and account-creation date shown, nothing from any other account (FR-001, FR-002, FR-004,
   SC-001 — under 10 seconds to find).
2. Click log out from Profile. **Expect**: session ends, back at the login screen, same as
   logging out anywhere else (FR-003).
3. Log in as User B, open Profile. **Expect**: User B's own info only, never User A's.

## US2 — Add or update a personal Anthropic key

1. As a user with no key saved, look at the sidebar. **Expect**: Playground and Metrics
   are disabled with a hover message about needing a personal key (FR-014, SC-007).
2. In Profile, submit the invalid made-up key. **Expect**: rejected with a clear error;
   nothing saved; Playground/Metrics remain disabled.
3. Submit an empty key. **Expect**: rejected before any Anthropic call, "key is required"
   (FR-009).
4. Submit the real, valid key. **Expect**: accepted, masked form shown (last few
   characters only, never the full key — FR-010, SC-004); Playground/Metrics become
   enabled within the same session, no reload needed (FR-015, SC-002 — under a minute end
   to end).
5. Go to Playground, ask a question against an existing corpus/document, generate an
   answer. **Expect**: succeeds using this user's own key (FR-012).
6. Replace the key with a second valid key (or the same one again). **Expect**: re-
   validated, saved, subsequent generation still succeeds (FR-006 [profile], SC-005).
7. Check Metrics for the turn generated in step 5. **Expect**: quality scores present,
   attributed to this user's key (FR-016, SC-006).

## US3 — Delete a personal Anthropic key

1. With a key saved (from US2), delete it from Profile. **Expect**: removed, no longer
   shown even masked (FR-007).
2. Immediately check the sidebar. **Expect**: Playground and Metrics disabled again, same
   hover message as a user who never had a key (FR-015, SC-007).
3. Attempt to generate an answer anyway (e.g. by retrying a previous in-flight request).
   **Expect**: blocked with a clear message pointing at Profile (FR-013, SC-003) — never a
   fallback to any other key.
4. Generate a *new* answer as User A after re-adding a key, then check that a turn
   generated earlier (US2 step 5, while a key existed) still shows its quality score in
   Metrics, while any turn generated during this deleted-key window has none (Edge Cases —
   scores aren't retroactively lost, just not created without a key at generation time).

## Cross-cutting: never another user's key

1. As User A, note the masked form of A's key from Profile.
2. As User B, attempt to call `GET/PUT/DELETE /api/profile/anthropic-key` is naturally
   scoped to B's own session token — there is no ID-based key endpoint to probe (FR-011).
   Confirm B's Profile only ever shows B's own key state, never A's masked value or
   `hasKey` status.

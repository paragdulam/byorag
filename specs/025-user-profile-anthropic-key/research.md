# Research: User Profile & Personal Anthropic API Key

No `NEEDS CLARIFICATION` markers remain in the Technical Context (this feature reuses the
existing fixed stack end-to-end — no new language, framework, database, or deployment
decision is needed). The open technical questions below are implementation-approach
decisions, not stack decisions.

## 1. Reversible storage of the key

**Decision**: Encrypt the key at rest with `cryptography`'s `Fernet` (AES-128-CBC + HMAC,
authenticated symmetric encryption), keyed by a new required backend env var
`KEY_ENCRYPTION_SECRET`. The raw env value is hashed with SHA-256 and base64-urlsafe
encoded to produce a valid 32-byte Fernet key, so operators can set any passphrase rather
than having to pre-generate a correctly-shaped Fernet key.

**Rationale**: Unlike the password (`bcrypt`, one-way — 024-user-authentication), the
Anthropic key must be recovered in plaintext to call Anthropic's API on the user's behalf
(FR-012), so hashing is not an option. `Fernet` is the standard, already-audited choice
for "encrypt a secret at rest, decrypt it later" in Python and needs no new infrastructure
(no KMS/vault service, consistent with Principle IV's fixed stack and Principle III's
right-sized complexity).

**Alternatives considered**:
- Store the key in plaintext — rejected outright; FR-010 requires secure storage and a
  leaked-database scenario would otherwise leak every user's Anthropic billing credential.
- A dedicated secrets manager / KMS (e.g. Vault, AWS KMS) — rejected as infrastructure the
  fixed stack (Principle IV) doesn't include and the project's scale doesn't warrant; would
  itself need a constitution amendment.
- OS keyring — not viable; the backend runs headless in Docker (Principle IV).

## 2. Live key validation at save time

**Decision**: Validate with `client.models.list(limit=1)` using the Anthropic SDK already
in `pyproject.toml` (`anthropic>=0.40`). A successful call confirms the key authenticates;
`anthropic.AuthenticationError` means "invalid key" (FR-008's rejection path);
`anthropic.APIConnectionError`/`APITimeoutError` means "couldn't verify right now" (Edge
Cases).

**Rationale**: `models.list` is the cheapest authenticated call the SDK exposes — it costs
no generation tokens (unlike a `messages.create` probe) and its exception types already
distinguish "bad credential" from "transient failure," which the spec's edge cases need to
tell apart (reject-and-explain vs. reject-and-retry).

**Alternatives considered**: A minimal `messages.create(max_tokens=1, ...)` call — rejected,
it burns a token allotment on every save/update for no benefit over `models.list`.

## 3. Threading the per-user key through Generation

**Decision**: Change the `GenerationProvider` protocol
(`app/generation/providers/base.py`) from `generate(prompt: str)` to
`generate(prompt: str, api_key: str)`, and update `AnthropicProvider` to build its
`Anthropic(api_key=...)` client from the passed-in key instead of `settings.anthropic_api_key`.
`playground/service.py::generate_answer` resolves the acting user's decrypted key first
(new `app/profile/service.py` helper) and raises a new `NoApiKeyError` before calling the
provider if none is on file; the router maps that to a `400` with a message pointing at
Profile (mirrors the existing `UnsupportedModelError`/`NoSavedEmbeddingsError` → `400`
pattern in `playground/router.py`).

**Rationale**: The provider/judge modules should stay ignorant of *whose* key they're
using — that's a call-site (per-request, per-user) concern, not provider config — so this
keeps Principle I's pluggable-provider boundary intact while removing the module's only
remaining dependency on global settings for the credential itself.

**Alternatives considered**: Keep reading `settings.anthropic_api_key` as a fallback when
no personal key exists — explicitly rejected by the FR-013 clarification (no shared/
server-default key for anyone once this ships). `settings.anthropic_api_key` and the
`ANTHROPIC_API_KEY` env var become dead code and are removed (from `config.py` and
`docker-compose.yml`) rather than left as an unused shim.

## 4. Threading the per-user key through quality scoring (Metrics)

**Decision**: `EvaluationJudge.score(...)` gets the same `api_key: str` parameter as the
generation provider. `evaluation/service.py::score_turn(db, turn_id)` resolves the turn's
owning user the same way `db/lookups.py::get_conversation_turn_owned_by` already does
(`turn.document.user_id if turn.document is not None else turn.corpus.user_id`), looks up
that user's key, and returns early (turn stays unscored) if none exists — before ever
calling the judge. This slots into the function's existing swallow-all-failures `try/except`
shape (`score_turn` already treats "judge not configured" and "judge raised" as
no-ops); "no key" becomes one more reason to no-op, not a new failure mode.

**Rationale**: Directly implements the clarified FR-016/FR-017 — same key, same user, same
"skip don't block" semantics the function already has for every other judge failure.

## 5. Proactive UI gating (Playground/Metrics nav)

**Decision**: `AuthContext` (or a small sibling context/hook reading from it) exposes
whether the current user has a key on file, sourced from the same `GET
/api/profile/anthropic-key` status call the Profile screen itself uses, fetched once
alongside `GET /api/auth/me` on load and refreshed after any add/update/delete. `SidebarNav`
disables the `Playground` and `Metrics` `<a>` entries (no `onClick` navigation, `aria-
disabled="true"`, muted styling) and adds a `title`/tooltip attribute with the "add your
Anthropic key" message when that flag is false.

**Rationale**: Matches FR-014/FR-015 and reuses the exact plumbing (`AuthContext` sourcing
`SidebarNav`) 024-user-authentication already established for gating the rest of the app on
login state — no new state-management pattern needed.

**Alternatives considered**: A per-screen guard that redirects away from Playground/Metrics
after navigating in — rejected; the clarified answer is explicitly "disabled in the nav,"
not "enters then bounces."

## 6. Where the new backend module lives

**Decision**: New `app/profile/` package (`router.py`, `service.py`, `schemas.py`) mounted
at `/api/profile`, alongside the existing `app/auth/` package it depends on
(`require_user`). `GET /api/auth/me`'s `UserResponse` gains a `createdAt` field for Profile's
account-info display (FR-002); no new endpoint needed for that part.

**Rationale**: Key management is its own bounded concern (its own table, its own
validate/encrypt logic) distinct from authentication itself, matching how `playground/`,
`evaluation/`, and `metrics/` are already separate packages each owning one concern.

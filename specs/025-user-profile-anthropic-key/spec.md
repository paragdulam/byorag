# Feature Specification: User Profile & Personal Anthropic API Key

**Feature Branch**: `025-user-profile-anthropic-key`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Lets add a profile section in the app. Preferably where user can logout, some User info should be shown in the app. Whatever the information has been collected until now. Lets add a way to add/delete/update anthropic key which is used in Generation part of the app. I want user to come up with their own key"

## Clarifications

### Session 2026-07-31

- Q: When a logged-in user hasn't configured their own Anthropic key yet, what should happen when they try to use Generation? → A: Block Generation with a clear message to add a personal key first. No shared/server-default key is used by anyone once this ships.
- Q: When a user adds or updates their Anthropic key, should the system validate it immediately? → A: Yes — validate with a live test call to Anthropic at save time, and reject the save with a clear error if the key is invalid.
- Q: Does the "no shared/server-default key" rule extend to the answer-quality scoring (LLM-judge) used by Metrics, or does that keep using the existing shared key since it's a different subsystem than user-facing Generation? → A: Quality scoring also requires the acting user's own personal key. If they don't have one, quality scoring is skipped for their turns (the turn stays unscored) — mirroring how any other judge failure is already handled today — while the answer itself is still generated normally as long as the user has a key for Playground generation.
- Q: How should a user with no valid personal key experience Playground/Generation and Metrics — a blocking error only after they try, or something more upfront? → A: Keep the Playground and Metrics navigation entries disabled (non-interactive) for that user, and show on hover that they need to add a personal Anthropic key — surfaced before they can even attempt the action, not just as an error after clicking.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View account info and log out (Priority: P1)

A logged-in user opens a Profile section and sees the information the app has collected about their account, plus a way to log out from there instead of having no visible way to end their session.

**Why this priority**: Today a user can log in but has no in-app way to see who they're logged in as or to log out — this is the foundational, always-useful piece of the feature and has no dependency on the key-management work.

**Independent Test**: Can be fully tested by logging in, opening the Profile section, confirming the displayed account info matches the logged-in account, clicking log out, and confirming the session ends and the user is returned to the login screen.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they open the Profile section, **Then** they see their account's email address and the date their account was created.
2. **Given** a logged-in user viewing their Profile, **When** they click log out, **Then** their session ends and they are returned to the login screen, consistent with logging out anywhere else in the app.
3. **Given** two different users, **When** each opens their own Profile section, **Then** each only ever sees their own account info, never another user's.

---

### User Story 2 - Add or update a personal Anthropic key (Priority: P1)

A logged-in user who wants to use Generation supplies their own Anthropic API key from their Profile section, so answer generation runs against their own account and usage rather than a shared key.

**Why this priority**: This is the core ask — "I want user to come up with their own key" — and without it Generation cannot work at all under the new rule that no shared/server-default key is used as a fallback.

**Independent Test**: Can be fully tested by adding a valid Anthropic key in Profile, then successfully generating an answer in the Playground; and separately by attempting to save an invalid key and confirming it is rejected with a clear error and not stored.

**Acceptance Scenarios**:

1. **Given** a logged-in user with no key saved yet, **When** they submit a valid Anthropic API key in their Profile, **Then** the system validates it against Anthropic, saves it, and confirms success.
2. **Given** a logged-in user with no key saved yet, **When** they attempt to generate an answer, **Then** the request is blocked with a clear message directing them to add a personal key in their Profile.
3. **Given** a logged-in user who just saved a valid key, **When** they generate an answer, **Then** the request succeeds using their own key.
4. **Given** a logged-in user, **When** they submit a key that fails Anthropic's live validation, **Then** the save is rejected with a clear error, and any key they had saved before this attempt is left unchanged.
5. **Given** a logged-in user with a key already saved, **When** they submit a new valid key to replace it, **Then** the new key is validated, saved, and used for all of that user's Generation requests from that point on.
6. **Given** a saved key, **When** the user views their Profile, **Then** the key is shown in a masked form (e.g. only its last few characters) — the full key is never displayed or returned again after the moment it was first saved.
7. **Given** a logged-in user with no key saved, **When** they look at the app's navigation, **Then** the Playground and Metrics entries are shown disabled (non-interactive), and hovering over either shows a message that a personal Anthropic key is required.
8. **Given** a logged-in user who just saved a valid key, **When** they look at the navigation again, **Then** Playground and Metrics become enabled and usable.

---

### User Story 3 - Delete a personal Anthropic key (Priority: P2)

A logged-in user who no longer wants their key stored (e.g. they're rotating it, or want to stop using Generation) removes it from their Profile.

**Why this priority**: Builds on User Story 2 — deletion only matters once a key can exist — and is less frequently used than adding/viewing, but is required to fully satisfy "add/delete/update."

**Independent Test**: Can be fully tested by saving a key, deleting it from Profile, confirming it no longer appears (even in masked form), and confirming a subsequent Generation attempt is blocked exactly as if no key had ever been saved.

**Acceptance Scenarios**:

1. **Given** a logged-in user with a saved key, **When** they delete it from their Profile, **Then** the key is removed and no longer shown, even in masked form.
2. **Given** a logged-in user who just deleted their key, **When** they attempt to generate an answer, **Then** the request is blocked with the same message as a user who never saved a key.
3. **Given** a logged-in user with no key saved, **When** they view their Profile, **Then** there is nothing to delete and no error occurs — the delete action is simply unavailable/inert.
4. **Given** a logged-in user who just deleted their key, **When** they look at the navigation, **Then** Playground and Metrics immediately become disabled again, with the same hover message as a user who never saved a key.

---

### Edge Cases

- A user submits an empty or whitespace-only key: rejected before any live validation call, with a clear "key is required" error.
- A user's previously-valid key is later revoked or expires on Anthropic's side (outside this app): the next Generation attempt fails with a clear error at that point; this is not caught earlier since keys are only live-validated at save time (see Assumptions).
- A user is logged in on two devices/browsers at once and updates their key on one: the other device's next Generation attempt uses the newly saved key too, since the key lives with the account server-side, not the device.
- A user attempts to view, add, update, or delete another user's key directly (e.g. by ID or API call): denied, exactly like other cross-account access in this app.
- The Anthropic validation call itself times out or Anthropic's service is unreachable while saving a key: the save is rejected with a clear "couldn't verify the key right now, try again" error rather than being silently accepted or silently blocked forever.
- A user generates an answer (using their own key) but has no key at the moment quality scoring would run (e.g. they deleted it right after generating): that turn's quality scoring is skipped and it stays unscored in Metrics, the same as any other quality-scoring failure today — the answer itself is unaffected.
- A user's turns that were already scored before they removed their key keep their existing scores; only turns generated while the user has no key go unscored going forward.
- A user has past Metrics data from before they removed (or before they ever added) their key: the Metrics entry is still disabled while they have no key, so that historical data is temporarily inaccessible to them until they add a key again — consistent with Playground being disabled the same way, and not treated as data loss (nothing is deleted).

## Requirements *(mandatory)*

### Functional Requirements

**Profile section (User Story 1)**

- **FR-001**: The system MUST provide a Profile section reachable by a logged-in user from anywhere in the app.
- **FR-002**: The Profile section MUST display the logged-in user's account information collected to date: their email address and their account-creation date.
- **FR-003**: The Profile section MUST let the logged-in user log out, ending their session the same way logging out works elsewhere in the app.
- **FR-004**: The Profile section MUST only ever show the currently logged-in user's own account information.

**Personal Anthropic key management (User Stories 2 & 3)**

- **FR-005**: The system MUST let a logged-in user add a personal Anthropic API key from their Profile section.
- **FR-006**: The system MUST let a logged-in user update (replace) their previously saved personal Anthropic API key.
- **FR-007**: The system MUST let a logged-in user delete their saved personal Anthropic API key.
- **FR-008**: The system MUST validate a key against Anthropic with a live check whenever it is added or updated, and MUST reject the save with a clear, specific error if validation fails, leaving any previously saved key unchanged.
- **FR-009**: The system MUST reject an empty or whitespace-only key before attempting live validation.
- **FR-010**: The system MUST store each user's Anthropic API key securely and MUST NOT return the full key value in any API response once it has been saved — only a masked/partial form (e.g. last 4 characters) may be shown afterward.
- **FR-011**: The system MUST scope each personal Anthropic API key to exactly one user account; a user MUST NOT be able to view, add, update, or delete another user's key.
- **FR-012**: The system MUST use the logged-in user's own saved Anthropic API key for every Generation request that user makes (Playground and any other Generation-consuming feature).
- **FR-013**: The system MUST block a user's Generation requests with a clear, actionable message when that user has no valid personal Anthropic API key saved. No shared or server-default key MUST be used as a fallback for any user.
- **FR-014**: The system MUST show the Playground and Metrics navigation entries as disabled (non-interactive) for a logged-in user who has no valid personal Anthropic API key saved, and MUST show on hover a clear message directing that user to add a personal key in their Profile.
- **FR-015**: The system MUST re-enable the Playground and Metrics navigation entries for a user as soon as they have a valid personal Anthropic API key saved, and MUST disable them again immediately if that key is later deleted.

**Quality scoring (Metrics)**

- **FR-016**: The system MUST use the acting user's own saved Anthropic API key — the same key used for their Generation requests — for that user's answer-quality scoring (LLM-judge), never a shared key or another user's key.
- **FR-017**: When the acting user has no valid personal Anthropic API key saved, the system MUST skip quality scoring for that user's turns (leaving them unscored) rather than blocking or failing the turn itself, consistent with how any other quality-scoring failure is already handled today.

### Key Entities

- **User Anthropic Key**: A personal Anthropic API key belonging to exactly one user account. Holds the key material (stored securely, never returned in full once saved), a masked display value, and enough state to know whether a key is currently on file for that user. At most one active key per user at a time; adding/updating replaces the prior one, deleting removes it entirely.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A logged-in user can find their account info and log out in under 10 seconds from any screen in the app.
- **SC-002**: A user with no prior key can add a valid personal Anthropic key and successfully generate an answer in under 1 minute, with no administrator involvement.
- **SC-003**: 100% of Generation attempts by a user with no saved (or an invalid/deleted) key are blocked with a clear, actionable message — never a silent failure and never a fallback to any other key.
- **SC-004**: 100% of saved Anthropic keys are shown only in masked form anywhere in the product after the moment they are first saved — the full value is never re-displayed or returned by the system.
- **SC-005**: A user who updates or deletes their key sees the change take effect on their very next Generation attempt, with no stale key ever being used.
- **SC-006**: 100% of quality-scoring (Metrics) activity for a given user's turns uses that same user's personal key, with turns generated while the user has no key consistently left unscored rather than scored using any other key.
- **SC-007**: 100% of users with no valid personal key see the Playground and Metrics navigation entries as disabled with an explanatory hover message, rather than a plain/broken control or a silently missing option.

## Assumptions

- Anthropic is the only generation provider this feature adds key management for, matching the request's explicit "anthropic key" scope; other providers, if introduced later, are out of scope here.
- Each user account holds at most one personal Anthropic key at a time; multiple or named keys per user are not requested and are out of scope.
- Keys are validated live against Anthropic only at the moment they are saved (added/updated) — there is no ongoing/periodic re-validation of a key already on file. A key that later becomes invalid on Anthropic's side is only caught the next time the user actually attempts Generation, using the app's existing generation-error handling.
- The Profile section is read-only for account info (email, creation date) plus key management and logout; editing email or password from Profile is not requested and is out of scope for this feature.
- Once this feature ships, the previously shared, server-configured Anthropic key (today's single environment-level key) is no longer used as an automatic fallback for anyone — every user's Generation requests, and that same user's quality-scoring (Metrics) activity, depend on that user's own saved key. How any existing server-level key configuration is handled operationally is a planning-stage/implementation concern, not a specification concern.
- Quality scoring is a background, system-initiated step that already tolerates failure today (a turn simply stays unscored on any judge error); extending that same "skip, don't block" behavior to a missing personal key is a natural fit and requires no new failure-handling concept.
- "Whatever information has been collected until now" is read as the fields already captured on the existing User Account from the authentication feature: email and account-creation date. The password is never shown, consistent with that feature's existing rule that passwords are never exposed.
- Disabling the Metrics navigation entry when a user has no key also temporarily hides that user's historical (already-scored) metrics, not just new scoring — this is accepted as an intentional, consistent extension of "no key, no Playground/Metrics access," not a gap; no data is deleted, only access is gated the same way Playground access is.

# Feature Specification: User Authentication & Per-User Data Ownership

**Feature Branch**: `024-user-authentication`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Lets do this for users. Currently this works for one user only. Lets add authentication module in the app where a user can upload documents only when authenticated and do what all byorag has to offer. Lets save PDFs in database against the corpora table of course."

## Clarifications

### Session 2026-07-29

- Q: Should account creation be open self-service sign-up, or restricted to admin/invite-provisioned accounts? → A: Open self-service sign-up — anyone can create their own account from a public sign-up form.
- Q: Should a user's corpora be strictly private to them, or can corpora be shared/collaborative across accounts? → A: Strictly private per user for now. Sharing/collaboration is explicitly wanted as a **future** feature, not part of this one.
- Q: What should happen to today's existing (unowned) corpora and documents once per-user ownership rolls out? → A: Assign them all to whichever account is registered first.
- Q: What authentication mechanism should account creation and login use? → A: Email + password, entirely self-contained within BYORAG (no third-party OAuth/SSO provider).
- Q: What should happen after repeated failed login attempts for the same account? → A: No rate limiting for now — every attempt is treated the same regardless of how many failures in a row.
- Q: Since anyone can self-register an account, should there be a cap on how much a single account can upload? → A: No quota for now — same unlimited upload behavior as today, just scoped per account instead of global.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create an account and log in (Priority: P1)

Someone who wants to use BYORAG creates an account and logs in with their credentials, so the app knows who they are before letting them touch anything.

**Why this priority**: Nothing else in this feature — gating the app, owning corpora, storing documents per-account — is possible until an account/login mechanism exists. This is the foundation everything else builds on.

**Independent Test**: Can be fully tested by creating a new account, logging out, and logging back in with the same credentials — independent of whether any corpus or document work has happened yet.

**Acceptance Scenarios**:

1. **Given** no account exists yet for a given email, **When** someone submits the public sign-up form with an email and password, **Then** an account is created for them (self-service — no administrator or invite step required) and they are logged in.
2. **Given** an existing account, **When** the owner submits the correct email and password on the login form, **Then** they are logged in and land on the app.
3. **Given** an existing account, **When** someone submits an incorrect password, **Then** login is rejected with a clear error and no session is created.
4. **Given** a logged-in user, **When** they log out, **Then** their session ends and they are returned to the login screen.
5. **Given** a logged-in user closes and reopens the browser without logging out, **When** they return to the app, **Then** they are still logged in (the session persists across a normal browser restart).

---

### User Story 2 - Everything in the app requires being logged in, and stays private to its owner (Priority: P1)

A visitor who is not logged in cannot see or do anything BYORAG offers — no corpora, no documents, no chunking, embeddings, vector view, playground, or metrics. Once logged in, a user only ever sees and works with the corpora (and everything under them — documents, chunks, embeddings, chat history, metrics) that they themselves created; corpora are strictly private per account for this feature.

**Why this priority**: This is the actual point of adding authentication — without it, login would exist but nothing would actually be protected by it. Ties directly with User Story 1 for a minimum viable release.

**Independent Test**: Can be fully tested by having two separate accounts each create their own corpus and documents, and confirming the expected visibility/access rules hold between them, and that logging out blocks access to every screen.

**Acceptance Scenarios**:

1. **Given** no one is logged in, **When** any BYORAG screen or action is attempted (Corpora, Sources, Chunking, Embeddings, Vector View, Playground, Metrics), **Then** the user is redirected to log in first.
2. **Given** two users, A and B, each with their own corpus, **When** user A is logged in, **Then** A only sees A's own corpora in every screen — B's corpora, documents, chunks, embeddings, and chat history never appear (corpora are strictly private per account; sharing/collaboration across accounts is explicitly out of scope for this feature — see Assumptions).
3. **Given** user A is logged in, **When** A attempts to directly access a corpus or document they do not have rights to (e.g. by ID), **Then** the request is denied.
4. **Given** a user has just logged in for the first time with no corpora yet, **When** they reach the Corpora screen, **Then** they see an empty state (not another user's data, not an error).

---

### User Story 3 - Uploaded PDFs live in the database, not on local disk (Priority: P2)

When a user uploads a PDF, its content is saved into the database, associated with the corpus (or corpora) it was added to — not written to a local folder on whatever server happens to handle the request.

**Why this priority**: Builds on User Story 2 (a document only makes sense as *owned* data once ownership exists) and is what makes per-user data actually portable/durable in a multi-user setup — a server restart, redeploy, or move to a second server instance should never lose or strand anyone's documents. It is not required to prove out login and access-gating (User Stories 1–2), so it can ship right after them.

**Independent Test**: Can be fully tested by uploading a PDF, restarting the backend process, and confirming the document still opens and previews correctly with no dependency on anything left over on local disk.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they upload a PDF, **Then** its content is stored in the database (not the local filesystem) and associated with the corpus it was uploaded into.
2. **Given** a document already uploaded this way, **When** the backend process restarts, **Then** the document still previews and downloads correctly.
3. **Given** a document that belongs to one of a user's corpora, **When** that user opens its PDF preview, chunks it, or embeds it, **Then** every existing feature that reads the PDF's content continues to work exactly as it does today.

### Edge Cases

- A user tries to sign up with an email that already has an account: signup is rejected with a clear message (no duplicate accounts, no silent account takeover).
- A logged-in user's session is used from two different browsers/devices at once: both remain logged in independently (no single-session-per-account restriction implied by this feature).
- A user deletes their last remaining corpus: they still have an account and can create a new corpus; this is not the same as deleting the account itself (account deletion is out of scope for this feature).
- An upload is interrupted partway through (e.g. connection drops): no partially-stored document is left behind or shown as if it succeeded.
- Documents and corpora that already exist from before this feature shipped: all get assigned to whichever account is registered first, rather than being discarded or left ownerless.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication (User Story 1)**

- **FR-001**: The system MUST let a new user create an account with an email and password — authentication is entirely self-contained within BYORAG; no third-party OAuth/SSO provider is used.
- **FR-002**: The system MUST let an existing user log in with their email and password, and reject login attempts with an incorrect password or unknown email with a clear, generic error (not revealing which part was wrong). No lockout or rate limiting is applied to repeated failed attempts for this feature (see Assumptions).
- **FR-003**: The system MUST let a logged-in user log out, ending their session.
- **FR-004**: The system MUST keep a user logged in across normal browser restarts until they explicitly log out (i.e., a persistent session, not one that disappears on tab close).
- **FR-005**: The system MUST store passwords securely (never in plain text) and never expose them back to the user or in any API response.

**Access gating & data ownership (User Story 2)**

- **FR-006**: The system MUST require an active login before any BYORAG screen or capability (Corpora, Sources, Chunking, Embeddings, Vector View, Playground, Metrics) can be viewed or used.
- **FR-007**: The system MUST associate every corpus with exactly one user account: the one that created it.
- **FR-008**: The system MUST scope every list, read, and write operation (corpora, documents, chunks, embeddings, chat turns, metrics) to the logged-in user's own corpora only.
- **FR-009**: The system MUST deny (not merely hide) any attempt to read or modify a corpus or the documents/data under it that does not belong to the logged-in user, even via a direct reference (e.g. an ID).
- **FR-013**: The system MUST assign every corpus (and its documents, chunks, embeddings, and chat history) that existed before this feature shipped to whichever user account is registered first, so no pre-existing data is stranded or discarded.

**Database-backed PDF storage (User Story 3)**

- **FR-010**: The system MUST store an uploaded PDF's content in the database rather than the local filesystem.
- **FR-011**: The system MUST associate each stored PDF with the corpus (or corpora) it was uploaded into, consistent with today's document-to-corpus relationship.
- **FR-012**: Every existing capability that reads a document's PDF content (preview, fullscreen reading, chunking, in-context chunk preview) MUST continue to work unchanged from the user's point of view once PDFs are database-backed.

### Key Entities

- **User Account**: A person who can log in — has an email (unique), a securely stored password, and an identity every other entity's ownership traces back to.
- **Session**: Represents one logged-in state for a user; created at login, ended at logout, otherwise persists across normal browser restarts.
- **Corpus** *(existing entity, extended)*: Now belongs to exactly one user account; everything already nested under a corpus (documents, chunks, embeddings, chat history) inherits that same ownership.
- **Document / PDF Content** *(existing entity, extended)*: Its underlying file bytes now live in the database, associated with its corpus (or corpora), instead of a path on local disk.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can create an account and reach a usable, empty Corpora screen in under 1 minute.
- **SC-002**: 100% of BYORAG's screens and actions are unreachable without an active login.
- **SC-003**: 100% of access-control rules (which corpora, documents, chunks, embeddings, and chat history a user can see) hold as expected across at least two independent accounts.
- **SC-004**: 100% of uploaded documents remain fully previewable and usable after a backend restart, with no dependency on local-disk state.

## Assumptions

- Account deletion, password reset/forgot-password flows, and email verification are not requested here and are out of scope for this feature — a follow-up feature can add them if needed.
- Login brute-force protection (attempt rate limiting/lockout) is explicitly deferred — a follow-up feature can add it later if needed.
- No per-account upload/storage quota is introduced by this feature — upload volume remains unlimited per account, matching today's unlimited single-user behavior; a quota can be added later if abuse becomes a real problem.
- **Shared/collaborative corpora (multiple accounts working on the same corpus) are explicitly wanted as a future feature, not this one** — the data model and access rules here (one corpus, one owning account) should be built so that a later feature can extend ownership into shared membership without a full rework, but no sharing/collaboration UI or permissions model is in scope now.
- "Do what all byorag has to offer," per the request, is read as literally every existing screen and capability in the product today (Corpora, Sources, Chunking, Embeddings, Vector View, Playground, Metrics) — none of them are exempted from the login requirement.
- "Save PDFs in database against the corpora table" is read as: PDF content is persisted in the database and associated with the corpus/corpora a document belongs to (preserving today's document-to-corpus many-to-many relationship) — not literally a new column on the corpus table itself, since one corpus can contain many documents and one document can belong to more than one corpus.
- The "first registered account" that inherits all pre-existing corpora/documents (FR-013) is expected to be whoever signs up first after this feature ships in each environment (e.g. the developer, in local/dev use) — there is no separate "admin" concept beyond being first.
- This feature is a deliberate reversal of the project's current "Single-User Simplicity" principle and its local-filesystem-only PDF storage rule — both will need a constitution amendment alongside this feature (tracked at the planning stage, not a specification concern).

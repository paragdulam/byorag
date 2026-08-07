# Feature Specification: Deep Linking & Shareable URLs

**Feature Branch**: `032-deep-linking`

**Created**: 2026-08-07

**Status**: Draft

**Input**: User description: "I want to implement routes in the app as a part of deep linking in future. like in URL specification. I want to build deep linking within the app. I want to create sharable urls which will redirect to appropriate location in the app. This will be helpful in adding Golden Dataset."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The address bar always reflects where I am (Priority: P1)

Today, moving between screens (Sources, Chunking, Embeddings, Vector View, Golden Dataset,
Playground, Metrics, Profile) and switching the active corpus happens entirely inside the app —
the browser's address bar never changes. As a user, I want the URL to update as I navigate so
that I can copy it, bookmark it, or reload the page and land back on the exact screen and corpus
I was working in, instead of always restarting at the default screen.

**Why this priority**: Every other deep-linking capability (sharing a specific record, resuming
a session) depends on the app first having real, navigable URLs. Without this, there is nothing
to share.

**Independent Test**: Sign in, switch corpora and move between two or three screens, copy the
current URL after each move, then open that URL in a fresh browser tab (same signed-in session).
Confirm each URL reopens on the same screen with the same corpus active.

**Acceptance Scenarios**:

1. **Given** a signed-in user on the Sources screen for Corpus A, **When** they switch to the
   Golden Dataset screen, **Then** the browser URL changes to reflect the Golden Dataset screen
   and Corpus A.
2. **Given** a signed-in user with a copied URL for "Metrics screen, Corpus B", **When** they
   paste that URL into a new browser tab while signed in, **Then** the app opens directly on the
   Metrics screen with Corpus B active, without requiring manual navigation.
3. **Given** a signed-in user on any screen, **When** they reload the page, **Then** they remain
   on the same screen and corpus rather than being reset to the default screen.
4. **Given** a signed-in user who has navigated across several screens, **When** they use the
   browser's Back button, **Then** the app returns to the previously visited screen/corpus (and
   Forward moves them ahead again), consistent with normal browser navigation.

---

### User Story 2 - Share a link directly to one Golden Dataset entry (Priority: P2)

As a user reviewing the Golden Dataset, I want to get a shareable link for one specific entry
(question/answer pair) so I can send it to a teammate or Subject Matter Expert. When they open
that link, they should land directly on that entry — not just the general Golden Dataset screen
— so they don't have to search for it themselves.

**Why this priority**: This is the concrete use case that motivated the feature. It depends on
User Story 1's URL foundation but is the first real-world payoff and directly improves Golden
Dataset review workflows (e.g., asking someone to double-check or approve a specific entry).

**Independent Test**: Open a Golden Dataset entry, use its "copy link" action, and open that link
in a new browser session logged in as a different user with access to the same corpus. Confirm
the entry's detail/editor view opens automatically with the correct corpus and entry loaded.

**Acceptance Scenarios**:

1. **Given** a user viewing an entry in the Golden Dataset list, **When** they choose to copy a
   link to that entry, **Then** a URL identifying that specific entry (and its corpus) is placed
   on their clipboard.
2. **Given** a signed-in user who opens a link to a specific Golden Dataset entry, **When** the
   page finishes loading, **Then** the Golden Dataset screen opens with the correct corpus active
   and that entry already open in its detail/editor view.
3. **Given** a user who is not signed in, **When** they open a link to a specific Golden Dataset
   entry, **Then** they are taken through the normal sign-in flow first and then automatically
   continue to that entry afterward, rather than landing on the default screen.
4. **Given** a user who opens a link to an entry that has since been deleted, **When** the page
   loads, **Then** they see a clear "this entry no longer exists" message with a way to return to
   the Golden Dataset list, instead of a blank or broken screen.

---

### Edge Cases

- What happens when a deep link points to a corpus the signed-in user no longer has (or never
  had) access to? The system shows a clear "not found / no access" state rather than a blank
  screen, a crash, or silently falling back to an unrelated corpus.
- What happens when a deep link points to a screen or entry that has been removed or renamed
  since the link was created? The system shows a clear message and a way back to a valid screen.
- What happens when a user opens a deep link in a second browser tab while already signed in and
  working elsewhere in the app in a first tab? Each tab navigates independently based on its own
  URL; one tab's navigation does not force-navigate the other.
- What happens when the URL is manually edited to reference a corpus or entry ID that is
  malformed or does not exist? The system treats it the same as "not found" rather than erroring.
- What happens when a user follows a deep link to an entry but their session expires mid-flow
  (e.g., during the sign-in redirect)? They complete sign-in and are still routed to the original
  target rather than losing that destination.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose a distinct, human-readable URL for each screen in the app
  (Corpora, Sources, Chunking, Embeddings, Vector View, Golden Dataset, Playground, Metrics,
  Profile).
- **FR-002**: The system MUST include the active corpus in the URL whenever a corpus is
  applicable to the current screen, so that URLs uniquely identify both "which screen" and
  "which corpus."
- **FR-003**: The system MUST update the browser URL automatically, without a full page reload,
  whenever the user changes screens or switches the active corpus.
- **FR-004**: The system MUST restore the correct screen and active corpus when a previously
  generated or bookmarked URL is opened or the page is reloaded, for any signed-in user with
  access to that corpus.
- **FR-005**: The system MUST support browser Back/Forward navigation between previously visited
  in-app locations.
- **FR-006**: The system MUST provide a way for a user to obtain a shareable link that points
  directly to one specific Golden Dataset entry.
- **FR-007**: Opening a shareable Golden Dataset entry link MUST navigate the user directly to
  that entry's detail/editor view, with the correct corpus already active, without additional
  manual navigation.
- **FR-008**: If a user opens any deep link (screen-level or entry-level) while not signed in,
  the system MUST route them through the existing sign-in/sign-up flow first and then continue
  automatically to the originally requested location.
- **FR-009**: If a deep link references a corpus or entry that no longer exists, or that the
  signed-in user cannot access, the system MUST display a clear explanatory message and a way to
  return to a valid screen, instead of an error page, blank screen, or crash.
- **FR-010**: Shareable and navigable URLs MUST NOT embed session tokens, credentials, or other
  sensitive data in the visible link.
- **FR-011**: The system MUST NOT change any user-visible behavior of existing screens beyond how
  navigation and the address bar work — this feature is additive routing/sharing on top of
  today's screens and workflows.

### Key Entities *(include if feature involves data)*

- **Route / Location**: The addressable combination of screen, and where applicable, active
  corpus and a specific entity (currently only a Golden Dataset entry) within that corpus. This
  is what a URL represents and what the app restores when a URL is opened.
- **Shareable Link**: A URL a user can copy and send to another user that resolves to a specific
  Route/Location. In this phase, the only entity-level shareable link is for a Golden Dataset
  entry; screen-level shareable links exist for every screen per FR-001.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who copies the current URL and reopens it (same session, or after signing
  back in) lands on the exact same screen and corpus 100% of the time, for every screen in the
  app.
- **SC-002**: Opening a shared Golden Dataset entry link takes a user to that entry's detail view
  in a single step — no manual searching or clicking through the entry list — for at least 95% of
  valid links.
- **SC-003**: A user who opens an invalid, deleted, or inaccessible deep link sees a clear
  explanatory message, with a path back to a valid screen, in under 2 seconds, instead of a blank
  or broken page.
- **SC-004**: Sharing a specific Golden Dataset entry with a teammate takes no more than 2 user
  actions (e.g., open entry, copy link) from the Golden Dataset screen.
- **SC-005**: Browser Back/Forward navigation between at least the last 10 visited in-app
  locations behaves correctly (returns to the exact prior screen/corpus/entry) in manual testing.

## Assumptions

- Screen-level deep linking (FR-001–FR-005) applies to every existing screen in the app today.
  Entity-level deep linking (a URL that opens one specific record, not just a screen) is scoped
  to Golden Dataset entries in this phase, since that is the explicit motivating use case;
  extending entity-level linking to other record types (e.g., a specific Playground turn or
  document) is out of scope here and can be a follow-up feature reusing the same routing
  foundation.
- "Access" to a corpus/entry in this phase is governed by whatever visibility rules already exist
  in the app today (a corpus is only shown to users who can already see it via existing corpus
  listing/selection). This feature does not introduce new permission concepts — role-based access
  control and invite-based signup are being tracked separately and are explicitly out of scope
  here.
- Shareable links are the app's own canonical URLs (no separate URL-shortening or external
  link-management service).
- Deep links are only meaningful for signed-in users; an unauthenticated visitor is always routed
  through the existing login/signup screens before reaching the requested destination, reusing
  current authentication behavior rather than changing it.
- No offline/email-based link distribution mechanism is included — "shareable" means the user can
  copy a link and send it through whatever channel they choose (chat, email, etc.) themselves.

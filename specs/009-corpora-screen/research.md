# Phase 0 Research: Dedicated Corpora Screen with App-Wide Scoping

All items below were resolved by inspecting the existing `008-corpora-management` implementation
(`backend/app/corpora`, `backend/app/sources`, `frontend/src/context/CorpusContext.tsx`,
`frontend/src/components/layout/SidebarNav.tsx`, `frontend/src/app/App.tsx`) and this project's
constitution; no external unknowns remained after that review.

## 1. Discovering documents to attach from the Corpora screen

**Decision**: Add one new read-only endpoint, `GET /api/sources/all`, that returns every document
in the system regardless of corpus, each annotated with the ids of every corpus it's currently
associated with. The Corpora screen's "add existing document" picker fetches this once per corpus
selection and filters out documents already associated with the selected corpus, client-side.

**Rationale**: `008-corpora-management`'s `GET /api/sources` is deliberately corpus-scoped (requires
`corpusId`, 400/404 otherwise) — that contract is already tested and used by the Sources screen and
must not change. But FR-006 needs to let a user attach a document that may currently live in a
*different* corpus, which means browsing documents that aren't necessarily in the corpus being
viewed. There is no existing way to ask "what documents exist, anywhere?" — a new, narrowly-scoped
read endpoint is the smallest addition that unblocks this.

**Alternatives considered**:
- *Fetch every other corpus's document list and merge client-side* — rejected: an N+1 request
  pattern that scales with corpus count, and still requires de-duplicating documents that already
  belong to more than one corpus, which the merge would have to reinvent anyway.
- *Make `corpusId` optional on the existing `GET /api/sources`, returning everything when omitted*
  — rejected: would silently change an already-shipped, tested contract (missing `corpusId` today
  is a `400`), risking a regression for the Sources screen's existing usage.
- *Add a `/api/documents` endpoint under a new router* — rejected: this is a plain read view over
  the same `Document` rows the `sources` module already owns; a new top-level module for one
  endpoint isn't warranted (YAGNI).

## 2. "Selecting" a corpus on the Corpora screen vs. the sidebar quick-switcher

**Decision**: There is exactly one "active corpus" concept, already provided by `CorpusContext`
(`008-corpora-management`). Clicking a corpus row on the new Corpora screen calls the same
`selectCorpus()` the sidebar's quick-switcher already calls — it simultaneously becomes "the corpus
being managed in detail on this screen" and "the app-wide active corpus." There is no separate
"viewing" vs. "active" state.

**Rationale**: Introducing a second, screen-local "currently viewed" corpus distinct from the
app-wide active one would let the two disagree (e.g., viewing Corpus A's documents on the Corpora
screen while Corpus B is still "active" for Sources/Chunking) — precisely the inconsistency FR-010
rules out, and there is no stated user need for viewing one corpus's management details while a
different one stays active elsewhere (YAGNI, Constitution III).

## 3. Sidebar structure: nav item + screen, quick-switcher retained

**Decision** (from the spec's resolved clarification): "Corpora" becomes a real, clickable
top-level nav item — like "Sources" and "Chunking" — positioned above "Sources," navigating to the
new dedicated screen. The existing `CorporaSection` component (the always-visible quick-switcher
list + inline "+ New Corpus" control) is kept exactly as-is, immediately below the BYORAG header
and above the main nav list, so users can still switch the active corpus in one click without
navigating away from whatever screen they're on.

**Rationale**: Matches the resolved clarification exactly; avoids removing an already-shipped,
tested capability (the sidebar quick-switcher) while adding the deeper CRUD surface the spec asks
for.

**Alternatives considered**: Replacing the quick-switcher with a single plain nav link (no inline
list) — explicitly rejected by the clarification answer, since it would require navigating to the
Corpora screen just to switch context, adding friction to the single most frequent action.

## 4. Corpus deletion, document add/remove — reused as-is

**Decision**: The Corpora screen's delete action calls the existing `DELETE /api/corpora/{id}`
(already blocks with `409` while the corpus has documents — FR-008/FR-013 from
`008-corpora-management`); "add existing document" calls the existing
`POST /api/sources/{documentId}/corpora`; "remove from this corpus" calls the existing
`DELETE /api/sources/{documentId}/corpora/{corpusId}` (already cascades to a full document delete
on the last unlink). None of these contracts change.

**Rationale**: All three behaviors are already implemented, tested, and exactly match what FR-006,
FR-007, and FR-008 ask for. Re-deriving them here would duplicate `008-corpora-management`'s work
for no benefit.

## 5. Layout pattern for the new screen

**Decision**: A two-pane layout inside the existing `AppShell` wrapper (same chrome as every other
screen): a left pane listing all corpora (name, active indicator, click-to-select) with a create
control at the top, and a right pane showing the selected corpus's document list plus an
"attach existing document" picker and a "Delete this corpus" action — visually consistent with the
existing `DocumentList`/`DataSourcesScreen` table-and-card style (Tailwind utility classes, no new
UI library).

**Rationale**: Matches the app's existing visual language and component conventions with no new
dependencies; a two-pane list-then-detail layout is the standard shape for "manage a collection,
then manage one item's sub-collection" (corpora → a corpus's documents).

# Phase 0 Research: Deep Linking & Shareable URLs

## 1. Client-side routing approach

**Decision**: Adopt `react-router` (v7, "framework-free" data mode disabled — just
`createBrowserRouter`/`RouterProvider` or the declarative `<Routes>` API) as a new frontend
dependency, rather than hand-rolling History API plumbing.

**Rationale**: The app currently has zero URL routing — `AuthenticatedApp` in
`frontend/src/app/App.tsx` picks a component via an in-memory `activeScreen` string and every
screen receives navigation only through an `onNavigate(screen: ScreenId)` callback prop. Getting
path parsing, `history.pushState`/`popstate` handling, forward/back correctness, and nested
optional segments (screen → corpus → entry) right by hand is exactly the kind of undifferentiated
plumbing a mature router solves, and the spec explicitly requires correct Back/Forward behavior
(FR-005, SC-005) which is easy to get subtly wrong with a hand-rolled `popstate` listener
(especially interacting with React 19's concurrent rendering). `react-router` is the de facto
standard for this in the React ecosystem, actively maintained, and does not require adopting its
data-loading/framework mode — it can be used purely as a URL⇄component sync layer, keeping every
existing screen component's internal data-fetching (via `useEffect`/hooks) unchanged.

**Alternatives considered**:
- *Hand-rolled History API wrapper* (small custom hook around `window.history` +
  `popstate`) — rejected: reinvents back/forward edge cases and nested-param parsing the spec
  depends on (FR-005), for a dependency-avoidance benefit that doesn't outweigh the risk, and
  Constitution Principle IV only fixes the *frontend framework* (React) — adding a routing
  library within React is not a stack change.
- *TanStack Router* — rejected: stronger type-safety story than `react-router`, but adds a
  build-time codegen step and a steeper adoption curve for a single-SPA, screen-plus-one-entity
  route shape that doesn't need its advanced type inference.
- *Hash-based routing* (`#/screen/corpus`) — rejected: works without server-side rewrite config,
  but produces uglier, less "real URL"-feeling shareable links, which cuts against the explicit
  ask for shareable URLs "like in URL specification."

## 2. URL shape

**Decision**: Path-based segments: `/{screen}` for screens with no corpus context (e.g.
`/corpora`, `/profile`), `/{screen}/{corpusId}` for corpus-scoped screens (e.g.
`/playground/:corpusId`, `/metrics/:corpusId`), and `/golden-dataset/:corpusId/:entryId` for a
deep-linked Golden Dataset entry. `screen` values reuse the existing `ScreenId` vocabulary already
defined in `frontend/src/components/layout/SidebarNav.tsx` (`corpora`, `sources`,
`fixed-size-chunking`, `embeddings`, `vector-view`, `golden-dataset`, `playground`, `metrics`,
`profile`) so no renaming/remapping table is needed anywhere else in the app.

**Rationale**: Path segments read as real, human-legible URLs (matches the user's own framing,
"like in URL specification"), avoid query-string ordering/encoding ambiguity, and let
`react-router`'s standard `:param` matching do the parsing. Reusing `ScreenId` string values
verbatim as path segments keeps `SidebarNav`/`AppShell`/every screen's `ScreenId` type and
existing `onNavigate` call sites conceptually unchanged — the router becomes the thing that
*drives* `ScreenId` transitions instead of raw `useState`, rather than a parallel vocabulary.

**Alternatives considered**:
- *Query strings* (`/?screen=playground&corpus=...`) — rejected: works, but is a worse fit for
  "one entity per URL segment" and reads less like a specification-style hierarchical URL.
  Screen-only Corpora/Profile
- *Corpus-first hierarchy* (`/corpus/:corpusId/{screen}`) — considered close alternative; rejected
  in favor of screen-first because two screens (`corpora`, `profile`) have no corpus at all, which
  would force an awkward `/corpus/-/...` placeholder; screen-first lets those two routes omit the
  segment entirely.

## 3. Active corpus: URL as source of truth vs. `localStorage`

**Decision**: The URL becomes the primary source of truth for the active corpus while one is
present in the URL. `CorpusContext`'s existing `localStorage` persistence
(`ACTIVE_CORPUS_STORAGE_KEY`) is kept, but demoted to two supporting roles: (a) resolving which
corpus to redirect to when a user navigates to a corpus-scoped screen with *no* corpus in the URL
yet (e.g. clicking "Playground" in the sidebar with nothing selected — same behavior as today),
and (b) providing a fallback if a corpus segment in the URL doesn't resolve after the corpora list
loads (falls through to the existing "not found" handling, FR-009).

**Rationale**: `CorpusContext.selectCorpus` already exists as the single mutation point for
`activeCorpusId`; the router integration only needs to (1) make `selectCorpus` also update the
URL, and (2) make the router, on initial load/URL-paste, call `selectCorpus` with the corpus ID
parsed from the URL once the async `listCorpora()` fetch resolves. This avoids a second
source-of-truth fight between URL and Context — Context state stays the single value every screen
already reads via `useCorpus()`, and the router is purely what keeps it synchronized with the
address bar.

**Alternatives considered**:
- *URL-only, drop `localStorage` entirely* — rejected: breaks today's behavior where navigating to
  a screen with no corpus in the URL (e.g. via the sidebar, not a pasted link) still resumes the
  last-used corpus; the spec's FR-011 explicitly forbids changing existing behavior.
- *Keep `localStorage` as primary, URL as read-only display* — rejected: this is effectively "no
  deep linking," since a pasted URL for Corpus B would keep showing whatever corpus
  `localStorage` last had, failing FR-004/SC-001 outright.

## 4. Golden Dataset entry deep link → detail view

**Decision**: When `/golden-dataset/:corpusId/:entryId` is the active route, `GoldenDatasetScreen`
passes the parsed `entryId` down to `GoldenEntryList`, which — on mount/entryId-change — calls its
existing `handleQuestionClick`-equivalent expand logic for that entry (the same mechanism the
030-golden-dataset-entry-detail feature already built for click-to-expand) and scrolls that row
into view. If the entry isn't present in the already-loaded `entries` list (e.g. it belongs to a
different document scope, or `GET /api/golden-dataset/entries/{id}` 404s because it was deleted or
isn't owned by this user), the existing `getEntry(entryId)` call's failure path renders the
FR-009 "no longer exists" message instead.

**Rationale**: Feature 030 already built the exact expand/collapse-per-row detail UI this needs
(`GoldenEntryDetail`, keyed by `expandedEntryIds: Set<string>` in `GoldenEntryList.tsx`); reusing
it means no new detail UI is required, only wiring a URL-derived entry ID into the existing
expansion mechanism. `getEntry(entryId)` in `frontend/src/lib/goldenDatasetApi.ts` already exists
and is already owner-scoped server-side (`get_golden_dataset_entry_owned_by`, 404 otherwise, per
`backend/app/golden_dataset/service.py`), so the "not found / no access" path (FR-009) requires no
new backend logic — only a frontend error state for that existing 404.

**Alternatives considered**:
- *New dedicated full-page entry detail screen* — rejected: duplicates the inline
  expand/collapse UI 030 already shipped, and would be a larger, unrequested UX change (FR-011
  forbids changing existing screen behavior beyond navigation/URL mechanics).

## 5. Deep link while signed out → sign-in → continue to target

**Decision**: No capture/replay mechanism is needed. `AuthGate` never navigates — it only swaps
which component renders (`LoginScreen`/`SignupScreen` vs. `AuthenticatedApp`) based on
`useAuth()`'s `currentUser`, and neither `LoginScreen` nor `SignupScreen` touches
`window.location` or the router in any way (confirmed: no `location`/`navigate`/`history`
references in either component). The browser's address bar therefore never changes during the
whole sign-in flow — it's still showing whatever path the user originally opened. Once
`currentUser` becomes non-null and `AuthenticatedApp` mounts, `useAppRoute()` simply reads
`window.location.pathname` as it already exists, which *is* the originally requested destination.
The only requirement is that `BrowserRouter` wraps the whole app (including `AuthGate`), not just
`AuthenticatedApp`, so router context is available uniformly regardless of auth state.

**Rationale**: This was originally scoped as an explicit "capture the path, replay it after
login" mechanism, but that's solving a problem that doesn't exist here: URL state and React
component state are independent, and nothing in the sign-in flow ever mutates the URL. Adding a
capture/replay layer would be complexity with no behavior it changes — FR-008 falls out of the
router's normal mount-time behavior for free, with zero new code in `AuthContext`, `LoginScreen`,
or `SignupScreen`.

**Alternatives considered**:
- *Explicit capture-path-in-a-ref, replay-on-mount* (the original plan) — rejected on
  implementation: verified unnecessary once it was confirmed neither auth screen ever navigates;
  keeping it would be unjustified complexity for behavior the router already provides.
- *Backend-issued post-login redirect param* — rejected: the backend has no concept of frontend
  routes today and doesn't need one; this is a purely client-side concern, and turns out to need
  no client-side code either.

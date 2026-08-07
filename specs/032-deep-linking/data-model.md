# Phase 1 Data Model: Deep Linking & Shareable URLs

This feature adds no new persisted (database) entities — `corpora` and `golden_dataset_entries`
already exist and are unchanged (see research.md §4). The only "data model" introduced is the
client-side **Route** shape that the router parses from, and serializes to, the URL, and the
**Shareable Link** that's simply that same URL surfaced for copying.

## Route

The addressable combination of screen, and where applicable, active corpus and a specific entity,
that a URL represents (spec Key Entities: "Route / Location").

| Field | Type | Required | Notes |
|---|---|---|---|
| `screen` | `ScreenId` (existing union type in `frontend/src/components/layout/SidebarNav.tsx`) | Yes | One of `corpora`, `sources`, `fixed-size-chunking`, `embeddings`, `vector-view`, `golden-dataset`, `playground`, `metrics`, `profile`. Unknown/unmatched path → treated as FR-009 "not found." |
| `corpusId` | `string \| null` | Optional, even for corpus-scoped screens | `null` is valid and distinct from "not found": it means no corpus is active yet (e.g. a brand-new account with zero corpora), and the screen renders its own existing empty state. Only a corpusId that is *present but unresolvable* against the signed-in user's corpora (deleted, not owned, malformed) triggers the FR-009 not-found state. |
| `entryId` | `string \| null` | Only for `golden-dataset` screen | Optional even when `screen === 'golden-dataset'` — absent means "show the list," present means "list, with this entry expanded" (research.md §4). When present but unresolvable (deleted, not owned), triggers FR-009. |

**Validation rules**:
- `entryId` MUST NOT be present unless `screen === 'golden-dataset'` and `corpusId` is present
  (an entry always belongs to a corpus).
- A `corpusId` or `entryId` segment that is syntactically present but does not resolve to a real,
  accessible record is *not* a distinct error state from "doesn't exist" — both collapse to the
  same FR-009 not-found UI (edge case: "malformed or does not exist... treated the same as 'not
  found'").

**Lifecycle**: A Route has no persistence of its own — it is derived fresh from the current URL on
every load/navigation, and the URL is derived fresh from app state (active screen, `CorpusContext`'s
`activeCorpusId`, and — while viewing Golden Dataset — the currently expanded entry, if any) on
every navigation. There is no "stale Route" to reconcile; the URL and in-memory state are kept in
sync bidirectionally per research.md §3.

## Shareable Link

A URL, in the Route shape above, that a user can copy and send to another user (spec Key
Entities: "Shareable Link").

| Field | Type | Notes |
|---|---|---|
| `url` | `string` | The full app URL for a Route — `origin + path`, e.g. `https://app.example.com/golden-dataset/<corpusId>/<entryId>`. No token/session data (FR-010). |

**Validation rules**: Identical to Route — a Shareable Link is just a Route's URL form. No
separate expiry, ownership, or access-list concept is introduced (per spec Assumptions: access is
governed entirely by whatever the target resource's existing visibility rules are at the time the
link is opened, not by anything recorded when the link was created).

**Relationships**: Shareable Link *is-a* serialized Route; it does not reference any new database
row. Screen-level shareable links exist implicitly for every screen (FR-001) by construction — the
URL currently in the address bar always *is* a valid Shareable Link — while the entry-level
Shareable Link (FR-006) requires an explicit "copy link" affordance in `GoldenEntryList` because
that URL, unlike the address bar's, isn't already visible/copyable without an extra step.

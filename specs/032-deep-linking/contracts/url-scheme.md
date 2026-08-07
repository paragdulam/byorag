# Contract: App URL Scheme

This feature's public interface is not a network API — no backend endpoints are added or changed
(research.md). The interface it exposes is the **set of URLs the app recognizes**, since those
URLs are what get bookmarked, pasted, and shared between users. This document is the contract for
that URL scheme: every route it defines MUST resolve to the described screen/state, and every
in-app navigation to that screen/state MUST produce the described URL.

All paths are relative to the app's origin. `:corpusId` and `:entryId` are opaque resource
identifiers (existing UUIDs from `corpora.id` / `golden_dataset_entries.id`) — never
user-supplied slugs.

## Screen-only routes (no corpus context)

| Path | Screen | Notes |
|---|---|---|
| `/corpora` | Corpora | Corpus picker/management — the one screen where no corpus is "active" by definition. |
| `/profile` | Profile | Account/Anthropic-key settings — not corpus-scoped. |

## Corpus-scoped screens

| Path | Screen |
|---|---|
| `/sources/:corpusId` | Sources |
| `/fixed-size-chunking/:corpusId` | Fixed Size Chunking |
| `/embeddings/:corpusId` | Embeddings |
| `/vector-view/:corpusId` | Vector View |
| `/golden-dataset/:corpusId` | Golden Dataset (list view, no entry expanded) |
| `/playground/:corpusId` | Playground |
| `/metrics/:corpusId` | Metrics |

`:corpusId` is optional on every path above. `/playground` (no corpus segment) is also a valid
route — it renders the Playground screen with no corpus resolved yet, which is the screen's own
existing "select or create a corpus first" empty state (e.g. a brand-new account with zero
corpora). This is deliberately **not** the FR-009 not-found state: not-found is reserved for a
`:corpusId` segment that's *present* but doesn't resolve (see below).

**Resolution rules**:
- If `:corpusId` is present but does not resolve to a corpus owned by the signed-in user (deleted,
  malformed, or belongs to a different account), the app renders the FR-009 not-found state
  instead of the screen, with a way back to `/corpora`.
- If `:corpusId` is absent, the screen renders with no corpus active (its own existing empty
  state) — not a not-found state.
- Navigating to a corpus-scoped screen via in-app navigation (sidebar, etc.) with no corpus
  currently active falls back to the last-used corpus (existing `localStorage` behavior,
  research.md §3) and the URL is written with that corpus's ID once resolved.

## Entity-scoped route

| Path | Screen | Notes |
|---|---|---|
| `/golden-dataset/:corpusId/:entryId` | Golden Dataset, with `:entryId` expanded | Scrolls the entry into view and expands its detail (reuses 030's expand/collapse UI, research.md §4). |

**Resolution rules**:
- If `:entryId` does not resolve via `GET /api/golden-dataset/entries/{id}` (404 — deleted, or not
  owned by the signed-in user), the app renders the FR-009 not-found state instead of the Golden
  Dataset screen, with a way back to `/golden-dataset/:corpusId`.
- Collapsing the entry's detail view in-app (closing it) navigates back to
  `/golden-dataset/:corpusId` (no `:entryId` segment).

## Root / fallback

| Path | Behavior |
|---|---|
| `/` | Redirects to the default screen (`/sources`, resolving corpus the same way as any other corpus-scoped screen with no corpus in the URL). Matches today's default landing behavior. |
| Any unrecognized path | FR-009 not-found state, with a way back to a valid screen. |

## Cross-cutting rules (apply to every route above)

- **Unauthenticated access** (FR-008): any path above, opened while signed out, is held; the user
  completes the existing sign-in/sign-up flow, then is taken to that exact path.
- **No sensitive data in the URL** (FR-010): no session token, password, or API key ever appears
  in a path or query segment.
- **No behavior change beyond navigation** (FR-011): none of these routes change what a screen
  renders once loaded — only how it's reached and how the address bar reflects it.

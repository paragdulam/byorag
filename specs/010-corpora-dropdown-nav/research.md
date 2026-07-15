# Phase 0 Research: Corpora Dropdown in the Left Navigation

Resolved by inspecting the existing `SidebarNav.tsx` (`CorporaSection`), `CorpusContext.tsx`, and
the full existing e2e/unit test suite touching the sidebar's corpora list. No external unknowns
remained after that review.

## 1. Dropdown implementation approach

**Decision**: A plain React component: a toggle `<button>` (visible text = active corpus's name, or
"No corpus selected") with `aria-expanded`, and a conditionally-rendered panel below it containing
the corpora list + create control. Open/closed state is local `useState`. Closing on outside click
is implemented with a `document.addEventListener('mousedown', ...)` effect that only attaches while
open, plus closing on `Escape` and on the toggle button's own click.

**Rationale**: Matches `009-corpora-screen` research.md §5's precedent of no new UI library for this
project (Constitution IV, fixed stack). A native `<select>` cannot host per-row "Make Active" /
"Delete" buttons or the inline create form, so a custom disclosure panel is the minimum viable
approach — not a `<select>`, not a third-party menu component.

**Alternatives considered**: A `<select>` element — rejected, cannot contain interactive
sub-elements (buttons) per row, and browsers render `<option>` content as plain text only. A
third-party headless-menu library — rejected as an unnecessary new dependency for a single
disclosure panel (YAGNI, Constitution IV).

## 2. Avoiding test collisions with the Corpora screen's own corpus list

**Decision**: The dropdown's per-row elements use a distinct `data-testid` prefix,
`dropdown-corpus-row-{id}`, separate from `009-corpora-screen`'s `CorporaScreen` rows
(`corpus-row-{id}`). The toggle button gets `data-testid="active-corpus-dropdown-toggle"` and the
open panel gets `data-testid="active-corpus-dropdown-panel"`.

**Rationale**: When a user is on the dedicated Corpora screen, both the sidebar's dropdown (if
opened) and the screen's own corpora list can be visible at once, both listing the same corpus
names. `009-corpora-screen` already hit this exact ambiguity class (sidebar quick-switcher vs.
screen content) and resolved it with scoped queries (`within(main)` / Playwright `main.locator(...)`)
plus distinct test ids; this feature follows the same pattern rather than reinventing it, and picks
a `data-testid` that can never collide with the screen's `corpus-row-{id}`.

## 3. Reconciling existing tests that assume an always-expanded list

**Decision**: Every existing test that interacts with the sidebar's corpora list directly (not via
the Corpora screen) must open the dropdown first. Inventory of what breaks and how each is fixed:

| File | Current pattern | Fix |
|---|---|---|
| `frontend/tests/unit/SidebarNav.test.tsx` ("Corpora section" describe block) | Queries corpus links/create form directly, always present | Rewrite: open the dropdown (click the toggle) before every list/create/select assertion; add new tests for delete + confirmation |
| `frontend/tests/e2e/corpora-management.spec.ts` | `page.getByRole('button', { name: /new corpus/i })` / `page.getByRole('link', { name: corpusName })` unscoped, assuming always-visible | Add a click on the dropdown toggle before each such interaction |
| `frontend/tests/e2e/data-sources-screen.spec.ts` | Same pattern, one corpus created via the sidebar at test start | Same fix |
| `frontend/tests/e2e/fixed-size-chunking.spec.ts` | Same pattern | Same fix |

**Not affected** (verified by inspection): `frontend/tests/e2e/corpora-screen.spec.ts` and
`frontend/tests/e2e/sidebar-chevron.spec.ts` already scope all sidebar-list-equivalent interactions
to the dedicated Corpora screen's own `<main>`-scoped controls, or don't touch corpora at all.
`frontend/tests/unit/CorporaScreen.test.tsx`, `frontend/tests/unit/CorpusContext.test.tsx`,
`frontend/tests/integration/CorporaScreen.test.tsx`, `frontend/tests/integration/DataSourcesScreen.test.tsx`,
`frontend/tests/unit/FixedSizeChunkingScreen.test.tsx`, and `frontend/tests/unit/EmbeddingsScreen.test.tsx`
never query the sidebar's corpora list at all (they scope to `<main>` or don't assert on corpus
names), so they are unaffected by the collapse into a dropdown.

**Rationale**: This is a genuine breaking UI change (an always-visible list becoming click-to-reveal),
so every test asserting on the old always-visible shape is, by definition, asserting on now-incorrect
behavior. Fixing them is not optional polish — per Constitution Principle II, a suite with tests
asserting stale behavior is not "passing" in any meaningful sense, even if some of them might
accidentally still pass. Reconciliation is scoped into User Story 1 (Foundational-adjacent) rather
than deferred, matching how `008-corpora-management` and `009-corpora-screen` both treated
breaking-change test reconciliation as part of the story that caused the break, not a separate
polish-only task.

## 4. Delete confirmation mechanism

**Decision**: `window.confirm(...)`, matching the existing pattern already used for document
deletion (`DocumentList.tsx`'s row delete action, `004-delete-source-documents`).

**Rationale**: Consistency with an established, already-tested pattern in this codebase; no new
confirmation-dialog component needed (YAGNI).

## 5. Reusing existing `CorpusContext` behavior for delete and fallback

**Decision**: The dropdown's "Delete" action calls the existing `useCorpus().deleteCorpus(id)`
directly — no new context method. Its existing behavior (block while non-empty via the `409` from
`DELETE /api/corpora/{id}`, and its existing in-context fallback-to-`next[0]`-or-`null` logic when
the deleted corpus was active) already satisfies FR-008/FR-009 exactly as specified.

**Rationale**: Identical rules already exist and are tested (`009-corpora-screen`'s `CorporaScreen`
delete action uses the same context method); re-deriving them for a second call site would be
duplication, not a new decision.

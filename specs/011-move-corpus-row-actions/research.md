# Phase 0 Research: Move Corpus Row Actions to the Corpora Screen

Resolved by inspecting the current `SidebarNav.tsx` (`CorporaSection`, as shipped by
`010-corpora-dropdown-nav`), `CorporaScreen.tsx` (as shipped by `009-corpora-screen`), and the full
test suite touching either. No external unknowns remained after that review.

## 1. Does the sidebar dropdown keep click-to-select once its buttons are removed?

**Decision**: Yes. Each row in the open dropdown remains a single clickable element (a `<button>`
spanning the row) that calls `selectCorpus(id)` directly — no separate "Make Active" label, no
"Delete" action at all.

**Rationale**: The user's correction was specifically about the two *labeled buttons*' location
("Thats where I need the Make Active and Delete button [on the Corpora screen]. Remove the buttons
from dropdown list") — not a request to make the dropdown read-only. Keeping click-to-select
preserves the dropdown's original `010` purpose (switch corpus from anywhere without navigating
away) while satisfying the literal ask (no buttons). This also reverts the row to something very
close to `009-corpora-screen`'s original sidebar quick-switcher pattern, before `010` added
explicit buttons.

**Alternatives considered**: Read-only dropdown (display the active corpus and list, no
interaction at all) — rejected because it would remove corpus-switching from the sidebar entirely,
which is a bigger regression than what the user asked to correct, and nothing in their message
suggests they want that.

## 2. Does the Corpora screen's row keep whole-row click-to-select once explicit buttons are added?

**Decision**: Yes. The row stays clickable as a whole (clicking anywhere on it — not just the new
buttons — still calls `selectCorpus(id)`), and the new "Make Active"/"Delete" buttons are added
*inside* it with `event.stopPropagation()` so clicking them doesn't also trigger the row's own
click-to-select handler.

**Rationale**: `009-corpora-screen`'s row-click-to-select is exercised as setup/assertion in
roughly ten existing tests across `tests/unit/CorporaScreen.test.tsx`,
`tests/integration/CorporaScreen.test.tsx`, and `tests/e2e/corpora-screen.spec.ts` (see §4).
Nothing in the user's request asks for that behavior to be removed — only that "Make Active" and
"Delete" become explicit, labeled actions. Preserving it avoids ~10 unrelated test rewrites and
matches "don't refactor beyond what the task requires."

**Alternatives considered**: Row is no longer clickable as a whole; only the new "Make Active"
button selects it — rejected as unnecessary scope (would force rewriting the ~10 tests in §4 for
no requirement-driven reason) and a bigger behavioral change than requested.

## 3. How to add per-row buttons to the Corpora screen without invalid nested-button markup

**Decision**: Change the row from a single `<button>` (current implementation) to an `<li
role="button" tabIndex={0} onClick={...} onKeyDown={...}>` — a keyboard- and click-accessible
custom widget — containing a name `<span>`, an "ACTIVE" indicator or "Make Active" `<button>`, and
a "Delete" `<button>`. `data-testid="corpus-row-{id}"` and `aria-current` move to this `<li>`,
preserving exact compatibility with every existing test that does
`getByTestId('corpus-row-{id}')` + `.toHaveAttribute('aria-current', ...)` / `.click()`.

**Rationale**: A `<button>` cannot validly contain other `<button>` elements (nested interactive
controls) — browsers hoist/break nested buttons. Moving the row-level click handling to a
non-`<button>` element with `role="button"` is the standard pattern for a clickable container that
also hosts its own interactive children, and keeps the existing `data-testid`/`aria-current`
contract exactly where today's tests expect it.

**Alternatives considered**: Two-column layout with the button only wrapping the name text (name
click = select, buttons beside it) — rejected because it would move `data-testid`/`aria-current`
off the row-level element, breaking every existing test's assumption that the same element carries
both the identity (`data-testid`) and the state (`aria-current`).

## 4. Reconciling existing tests broken by this change

**Decision**: Every test that clicks the Corpora screen's single "Delete this corpus" control, or
the sidebar dropdown's "Make Active"/"Delete" buttons, must be rewritten. Inventory:

| File | Current pattern | Fix |
|---|---|---|
| `frontend/tests/unit/CorporaScreen.test.tsx` ("US4" describe block, 2 tests) | Clicks `getByRole('button', { name: /delete this corpus/i })` after selecting a row | Click the row's own "Delete" action (`aria-label="Delete {name}"`) instead; no need to select the row first since delete is now per-row |
| `frontend/tests/integration/CorporaScreen.test.tsx` (1 test, "falls back to the remaining corpus...") | Same "delete this corpus" button pattern | Same fix |
| `frontend/tests/e2e/corpora-screen.spec.ts` ("deleting a corpus is blocked..." test, 2 clicks) | `main.getByRole('button', { name: /delete this corpus/i })` | Same fix, scoped to the specific row via `main.getByTestId(/corpus-row-/).filter({ hasText: corpusName })` |
| `frontend/tests/unit/SidebarNav.test.tsx` ("Make Active"/"Delete" describe blocks, 5 tests) | Assert/click dropdown "MAKE ACTIVE"/"DELETE" buttons | Remove these describe blocks; add a test asserting the dropdown has zero such buttons, and that clicking a row's name switches the active corpus |
| `frontend/tests/e2e/corpora-dropdown.spec.ts` (Make Active spec + full Delete spec) | Clicks `panel.getByRole('button', { name: /make X active/i })`; a full blocked-then-succeeds delete flow | Rewrite the switch spec to click the row directly; remove the delete spec entirely (that flow now belongs in `corpora-screen.spec.ts`, already covered there) |
| `frontend/tests/e2e/corpora-management.spec.ts` (2 tests using the dropdown to switch) | `panel.getByRole('button', { name: /make X active/i })` | Click the dropdown row directly instead |

**Not affected** (verified by inspection): `frontend/tests/unit/CorpusContext.test.tsx` (tests the
context directly, no component markup), `frontend/tests/e2e/data-sources-screen.spec.ts` and
`frontend/tests/e2e/fixed-size-chunking.spec.ts` (create their corpus via the dedicated Corpora
screen per `010`'s reconciliation and never use the dropdown's or screen's per-row action buttons),
`frontend/tests/e2e/sidebar-chevron.spec.ts` (chunking chevron only, no corpora interaction), and
every "lists/selects a corpus by clicking its row" assertion in `CorporaScreen.test.tsx` /
`integration/CorporaScreen.test.tsx` that does not touch deletion (unaffected by §2's decision to
keep row click-to-select).

**Rationale**: Per Constitution Principle II and the precedent set by `008`/`009`/`010`, fixing
tests broken by an intentional structural change is part of the story that causes the break, not
deferred polish.

## 5. Reusing existing `CorpusContext` behavior

**Decision**: Both the relocated Corpora-screen actions and the simplified dropdown continue to
call `useCorpus().selectCorpus(id)` / `useCorpus().deleteCorpus(id)` directly — no new context
method, no change to `CorpusContext`'s public interface.

**Rationale**: Identical rules (block-while-non-empty via the existing `409` response,
fallback-to-`next[0]`-or-`null` on deleting the active corpus) already exist and are tested at the
context level (`CorpusContext.test.tsx`) and were already reused as-is by `010`'s dropdown
(`010` research.md §5). This feature only moves *where* those same calls are triggered from.

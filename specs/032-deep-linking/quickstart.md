# Quickstart: Validating Deep Linking & Shareable URLs

Prerequisites: app running locally per the repo's standard dev setup (`docker compose up` or
equivalent, per `README.md`), a signed-in test account, at least one corpus with at least one
Golden Dataset entry (see `specs/027-golden-dataset`/`specs/030-golden-dataset-entry-detail`
quickstarts if you need to create one from scratch).

## Scenario 1 — URL reflects navigation (US1, FR-001–FR-004, SC-001)

1. Sign in, land on the default screen.
2. Note the URL matches `contracts/url-scheme.md`'s entry for the current screen and active
   corpus.
3. Switch to at least two other screens (e.g. Golden Dataset, then Metrics) via the sidebar.
   **Expected**: the URL changes after each navigation, matching the new screen (and same active
   corpus) per the contract, without a full page reload.
4. Copy the URL while on Metrics for the active corpus. Open it in a new browser tab (same signed-in
   session). **Expected**: the new tab opens directly on Metrics with the same corpus active — no
   manual navigation needed.
5. Reload the page. **Expected**: still on the same screen/corpus, not reset to the default screen.
6. Use the browser Back button several times, then Forward. **Expected**: each step returns to the
   exact previously visited screen/corpus, in order (FR-005, SC-005).

## Scenario 2 — Shareable Golden Dataset entry link (US2, FR-006–FR-009, SC-002, SC-004)

1. On the Golden Dataset screen for a corpus with at least one entry, use the entry's "copy link"
   action. **Expected**: a URL matching `/golden-dataset/:corpusId/:entryId` is copied, in 2 or
   fewer actions from the Golden Dataset screen (SC-004).
2. Open that URL directly (same signed-in session, fresh tab). **Expected**: Golden Dataset opens
   with the correct corpus active and that entry already expanded/scrolled into view — no manual
   search through the list (SC-002).
3. Sign out. Open the same entry URL. **Expected**: routed through the existing sign-in flow;
   after signing back in, automatically lands on that same entry (FR-008) rather than the default
   screen.
4. Delete that entry (as the owning user), then open the same URL again. **Expected**: a clear
   "this entry no longer exists" message with a way back to the Golden Dataset list, within ~2
   seconds, instead of a blank/broken screen (FR-009, SC-003).

## Scenario 3 — Invalid / inaccessible links (Edge Cases, FR-009, SC-003)

1. Manually edit the URL's `:corpusId` segment to a random, non-existent value and open it.
   **Expected**: not-found state, not a crash or blank page.
2. Manually edit a valid entry URL's `:entryId` segment to a random value and open it.
   **Expected**: same not-found state.
3. (If a second test account is available) Sign in as a different user and open a URL for a corpus
   owned by the first user. **Expected**: same not-found state — no data leaks across accounts.

## Automated coverage (see tasks.md for the concrete task breakdown)

- Unit: router URL⇄Route parsing/serialization (all paths in `contracts/url-scheme.md`).
- Integration: sidebar navigation updates the URL; opening a Golden Dataset entry URL renders that
  entry expanded; not-found state renders for invalid `:corpusId`/`:entryId`.
- E2E: full Scenario 1 and Scenario 2 flows above, including the sign-out/sign-in redirect case.

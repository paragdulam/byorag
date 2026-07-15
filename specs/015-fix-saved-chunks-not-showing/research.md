# Research: Fix Saved Chunks Not Showing on Auto-Selected Document

No `NEEDS CLARIFICATION` markers exist in the spec — root cause and scope were both confirmed
through direct investigation (code, live database, live API) before the spec was written, and
scope (Embeddings + Vector View) was explicitly confirmed with the user. This document records
the fix-approach decision only.

## Decision: Sync raw selection state via `useEffect`, not by feeding hooks the derived value

**Problem restated**: Each screen computes a derived, always-valid display value
(`activeDocumentId = selectedDocumentId || documents[0]?.id || ''`) but calls its data-loading
hook with the raw `selectedDocumentId` state instead, e.g.:

```tsx
// EmbeddingsScreen.tsx (current, buggy)
const { documents, savedChunks, ... } = useChunkEmbeddings(activeCorpusId, selectedDocumentId || null)
const activeDocumentId = selectedDocumentId || documents[0]?.id || ''
```

`selectedDocumentId` only becomes non-empty via the `<select>`'s `onChange`. With a single
document, the user never needs to touch the dropdown, so it stays `''` forever, `null` is passed
into the hook, and the hook's fetch effect never runs.

**Why the obvious fix ("just pass `activeDocumentId` into the hook instead") doesn't work**:
`activeDocumentId` is computed from `documents`, and `documents` is only known *after* calling
the hook. React hooks can't be called a second time in the same render with a value the hook
itself will produce — there's no synchronous way to compute `activeDocumentId` before the hook
call on the very first render.

**Decision**: Add a `useEffect` that keeps the raw selection state itself always valid once its
source list is available, using a functional state update so the effect only needs to depend on
the list:

```tsx
useEffect(() => {
  setSelectedDocumentId((prev) => (documents.some((d) => d.id === prev) ? prev : documents[0]?.id ?? ''))
}, [documents])
```

This:
- Auto-selects the first item when nothing is selected yet (`prev === ''`) — fixes the reported
  bug (FR-001–FR-004).
- Re-selects correctly when the previously-selected id no longer belongs to the current list
  (e.g. after switching the active corpus, `documents` changes to the new corpus's list) — this
  satisfies FR-006 without a separate reset effect.
- Leaves `prev` untouched when it's still valid — preserving in-progress manual selections, so
  existing manual-selection behavior (FR-005) is unaffected.
- Requires no changes to `useChunkEmbeddings`/`useVectorView`'s signatures or their own tests,
  because the hooks' existing "fetch when `documentId` changes" contract was already correct —
  the screens were simply never feeding it the right value once a real value existed.

`VectorViewScreen.tsx` needs two independent copies of this effect: one keyed on `documents` for
`selectedDocumentId`, one keyed on `savedChunks` for `selectedChunkId` (chunk auto-selection
naturally re-runs whenever the document — and therefore its chunk list — changes, since
`savedChunks` itself changes).

**Alternatives considered**:

1. **Move "current selection" ownership into the hooks** (hook exposes `selectedDocumentId` +
   `selectDocument()` itself, owns the default). Rejected: larger diff, changes the hooks'
   public contract and would ripple into `useChunkEmbeddings.test.ts`/`useVectorView.test.ts`
   mock shapes for a bug that doesn't require touching the hooks at all — violates the
   Constitution's YAGNI/minimal-blast-radius principle (Principle III) for what is a
   presentation-layer defect.
2. **Reorder code so `activeDocumentId` is computed before the hook call, using a ref to smuggle
   the previous render's `documents`.** Rejected: adds a ref + manual synchronization purely to
   avoid one extra `useEffect`; more code, more subtlety, no behavioral benefit over the
   functional-update effect approach.
3. **Pass `activeDocumentId` directly into the hook, accepting a one-render lag on first
   mount.** Rejected: this is only a partial fix — a stale/mismatched value would still flow
   into the hook on the render immediately after `documents` first populates (the exact
   "compute derived value the same render you'd need it as a hook argument" problem described
   above), reintroducing a race that is hard to reason about and easy to regress. The
   `useEffect` approach makes the raw state the single source of truth for both display and the
   hook's argument, eliminating the two-value split that caused the bug.

## Existing precedent in this codebase

`VectorViewScreen.tsx` already uses an equivalent "fall back to first/newest item when the
current selection isn't valid for the current list" pattern for `activeEmbedding`:

```tsx
const activeEmbedding = savedEmbeddings.find((e) => e.id === selectedEmbeddingId) ?? savedEmbeddings[0]
```

That works as a plain derived value (no effect needed) because `selectedEmbeddingId` is never
fed into a further reactive hook call — it's purely a display/lookup value, so there's no
chicken-and-egg problem there. The document/chunk case differs only in that the selection *is*
fed into a hook argument that drives further data fetching, which is why an effect (not a plain
derived `const`) is required to break the circularity.

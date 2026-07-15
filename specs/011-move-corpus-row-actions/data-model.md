# Phase 1 Data Model: Move Corpus Row Actions to the Corpora Screen

No new or changed entities, tables, or wire shapes. The `Corpus` entity and the
`GET/POST/PATCH/DELETE /api/corpora` contract are exactly as established in
`008-corpora-management` and unchanged by `009-corpora-screen` or `010-corpora-dropdown-nav`. This
feature is a presentation-only change to *where* the existing "make active" and "delete" actions
are triggered from (`CorporaScreen.tsx` instead of `SidebarNav.tsx`'s dropdown) — it introduces no
new frontend types, reusing `frontend/src/types/corpus.ts`'s `Corpus` interface and
`CorpusContext`'s existing `selectCorpus`/`deleteCorpus` methods as-is.

## Local UI state (not persisted, not a data model change)

`CorporaScreen.tsx` gains one piece of purely local component state, moved up from
`SidebarNav.tsx`'s dropdown (`010`) and `CorpusDocumentsPanel`'s old delete-error handling (`009`):

| State | Type | Scope |
|---|---|---|
| `deleteError` | `string \| null` | Local to `CorporaScreen`; holds the message from a blocked (409) or failed corpus deletion, displayed near the corpus list. Not persisted, not shared via context. |

`SidebarNav.tsx`'s dropdown loses its `deleteError` state entirely (deletion no longer happens
there). Its existing `isOpen` state (`010-corpora-dropdown-nav` data-model.md) is unchanged.

The active corpus itself (`activeCorpusId`) remains exactly as defined in `CorpusContext`
(`008-corpora-management`) — this feature does not add, remove, or rename any context field.

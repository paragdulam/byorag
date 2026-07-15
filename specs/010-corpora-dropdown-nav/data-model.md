# Phase 1 Data Model: Corpora Dropdown in the Left Navigation

No new or changed entities, tables, or wire shapes. The `Corpus` entity and the
`GET/POST/PATCH/DELETE /api/corpora` contract are exactly as established in
`008-corpora-management` (`specs/008-corpora-management/data-model.md`,
`specs/008-corpora-management/contracts/corpora-api.md`) and unchanged by
`009-corpora-screen`. This feature is a presentation-only change to how the existing `Corpus` list
is displayed and acted upon in `SidebarNav.tsx` — it introduces no new frontend types either,
reusing `frontend/src/types/corpus.ts`'s `Corpus` interface as-is.

## Local UI state (not persisted, not a data model change)

`SidebarNav.tsx`'s dropdown adds one piece of purely local component state:

| State | Type | Scope |
|---|---|---|
| `isOpen` | `boolean` | Local to the dropdown component; not persisted, not shared via context |

The active corpus itself (`activeCorpusId`) remains exactly as defined in `CorpusContext`
(`008-corpora-management`) — this feature does not add, remove, or rename any context field.

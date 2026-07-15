# Data Model: Fix Saved Chunks Not Showing on Auto-Selected Document

No changes. This feature is a frontend display/data-loading-timing fix only.

No entities, fields, relationships, validation rules, or state transitions are added, removed,
or modified. The existing `Chunk` and `Embedding` persistence (introduced in prior features
012–014) is confirmed correct and untouched — the bug was purely in when the frontend asked for
already-correct data, not in what data exists or how it's stored.

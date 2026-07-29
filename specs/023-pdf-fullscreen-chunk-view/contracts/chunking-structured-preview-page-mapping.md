# Contract Addendum: `GET /api/chunking/structured-preview` — page mapping

Extends the contract established in `specs/022-chunk-preview-ui-fixes/contracts/chunking-structured-preview-api.md`.
Same endpoint, same request shape, same existing 404 cases (unknown document, zero saved chunks,
missing file) — this addendum only documents the two new response fields.

## Request

Unchanged: `GET /api/chunking/structured-preview?documentId=<uuid>`

## Response (200) — additions

```jsonc
{
  "fullText": "…",           // unchanged
  "segments": [ /* … */ ],   // unchanged
  "pages": [
    { "pageNumber": 1, "start": 0, "end": 812 },
    { "pageNumber": 2, "start": 812, "end": 1590 }
    // one entry per PDF page with non-empty content after fullText's strip; 1-indexed;
    // ordered by pageNumber; start/end are character offsets into fullText
  ],
  "chunkRanges": [
    { "chunkIndex": 0, "start": 0, "end": 640 },
    { "chunkIndex": 1, "start": 590, "end": 1230 }
    // one entry per saved chunk; ordered by chunkIndex; start/end are character offsets into
    // fullText — independent of segments' overlap-collapsing, so a chunk's true extent is always
    // present here even where it overlaps a neighbor (research.md §4)
  ]
}
```

## Invariants

- `pages` fully and exactly partitions `fullText`'s covered range: `pages[0].start == 0`,
  `pages[i].end == pages[i+1].start`, `pages[last].end == len(fullText)` — no gaps, no overlaps.
- `chunkRanges` has exactly one entry per saved chunk that has any content within `fullText`
  (i.e., `end > start`); a chunk whose computed word range is entirely out of bounds is omitted.
- Every `chunkRanges[i].start`/`end` falls within `[0, len(fullText)]`.

## Error cases

Unchanged from the base contract — 404 for unknown `documentId`, zero saved chunks, or a missing
underlying file. The new fields are never present on an error response.

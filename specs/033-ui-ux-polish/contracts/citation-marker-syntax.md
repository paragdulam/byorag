# Contract: Answer citation marker syntax (US6)

This is the contract between answer generation (backend) and answer rendering (frontend) — the
only "interface" this piece of the feature has, since no new API field or persisted schema is
introduced (see data-model.md's Answer Citation).

## Syntax

A citation marker is a bracketed positive integer with no surrounding whitespace inside the
brackets: `[N]`, where `N` is the 1-based position of a chunk in the turn's retrieved-chunks list
(`turn.chunks[N - 1]`), placed immediately after the sentence/claim it supports.

```
The notice period is thirty days [1], delivered in writing to the registered address [2].
```

## Producer contract (backend, `app/playground/service.py`'s shared prompt template)

- The prompt MUST instruct the model to place a `[N]` marker after any claim that draws on a
  specific retrieved chunk, using the chunk's position in the same retrieved-chunks ordering
  already sent to the model as context.
- The prompt MUST NOT instruct the model to cite chunks that don't exist for that turn (no
  fabricated `N` beyond the retrieved-chunks count) — this is a prompting instruction, not a
  guarantee; the consumer contract below handles a model that cites out-of-range anyway.
- This applies identically regardless of which `GenerationProvider` is configured (Constitution
  Principle I) — the instruction lives in the shared prompt, not in any provider-specific code.

## Consumer contract (frontend, `AnswerCitations.tsx`)

- Parse `answer` by splitting on `/\[(\d+)\]/g`.
- For each matched `N`, resolve `turn.chunks[N - 1]`.
  - If it resolves: render an info-icon button immediately after that text segment,
    `aria-label` referencing the chunk, opening the chunk-citation modal for that chunk on click.
  - If it doesn't resolve (out of range, e.g. a mis-cite): render the segment's text with the
    literal `[N]` characters removed and **no** info icon — never show a broken/dead icon.
- Every other part of `answer` (outside recognized markers) renders through the existing
  `ReactMarkdown` exactly as it does today.

## Chunk-citation modal contract

Opened by an info icon, shows:
- The cited chunk's content.
- The cited chunk's cosine similarity score (`turn.chunks[N-1].score`).
- A "Go To Chunk" link → `buildChunkingChunkLink(corpusId, chunk.documentId, chunk.index)`
  (existing builder, `frontend/src/router/urlScheme.ts`).
- A close control that dismisses the modal without navigating.

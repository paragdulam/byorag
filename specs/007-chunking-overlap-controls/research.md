# Phase 0 Research: Functional Chunk Overlap Controls

## 1. Overlap splitting algorithm

**Decision**: Overlap is expressed in the same whitespace-word unit already used for `chunkSize`
(`FixedSizeStrategy.chunk`, `backend/app/chunking/strategies/fixed_size.py`). The non-overlapping
`range(0, len(words), chunk_size)` stride becomes `range(0, len(words), chunk_size - overlap)`.
Each window is still `words[i : i + chunk_size]`, so every chunk after the first repeats the
trailing `overlap` words of the chunk before it.

```python
stride = chunk_size - overlap  # always >= 1, enforced by validation (§2)
pieces = [" ".join(words[i : i + chunk_size]) for i in range(0, len(words), stride)]
```

**Rationale**: `overlap = 0` collapses `stride` back to `chunk_size`, reproducing today's exact
non-overlapping behavior byte-for-byte — no behavior change for existing callers/tests when
overlap is unset. Reusing the word-count unit (rather than a percentage or character count) keeps
"overlap must be smaller than chunk size" (spec FR-008) a direct integer comparison, with no unit
conversion, and matches the spec's Assumption that both values share the same approximate-token
unit.

**Alternatives considered**:
- *Overlap as a percentage of chunk size*: rejected — the UI slider and spec both treat Overlap as
  a raw count (0–200, same scale as Chunk Size), and a percentage would need conversion at the
  validation boundary for no added clarity.
- *Character-based overlap independent of the word-based chunk unit*: rejected — would require
  chunk size and overlap to be compared in different units, undermining the "overlap < chunk size"
  validation rule and diverging from the existing `005-fixed-size-chunking` approximate-token
  Assumption.

## 2. Overlap/chunk-size validation

**Decision**: Validate `0 <= overlap < chunk_size` in two places, mirroring how `chunkSize <= 0` is
already validated today:
- **Frontend** (`FixedSizeChunkingScreen.tsx`): block the "Re-Calculate Chunks" action client-side
  and show the same inline `validationError` UI already used for invalid chunk size, without a
  round trip to the backend — matches spec FR-008/US3-AS4 and keeps parity with the existing chunk
  size UX.
- **Backend** (`service.resolve_run`): add the same check alongside the existing `chunk_size <= 0`
  check, raising `ValueError` so the router's existing `except ValueError` branch continues to
  return `400 Bad Request` with no new error-handling path.

**Rationale**: Defense in depth at low cost — the frontend check gives instant feedback consistent
with existing chunk-size validation, while the backend check protects the `range(...)` stride from
ever receiving a `<= 0` step (which Python's `range()` rejects outright), since a stride of `0` or
negative would come from `overlap >= chunk_size`.

**Alternatives considered**: Backend-only validation (rejected — inconsistent with the existing
client-side-first UX for chunk size, and would require a round trip just to reject on every
keystroke/drag). Clamping overlap instead of rejecting it (rejected — spec Clarifications
explicitly call for blocking with a message, matching the existing invalid-chunk-size behavior).

## 3. Threading `overlap` through the existing layers

**Decision**: Add `overlap` as a new, optional-with-default-`0` parameter at every layer already
identified for `chunkSize`, so nothing becomes a breaking change for a hypothetical second
strategy or an existing caller that omits it:

| Layer | Change |
|---|---|
| `ChunkingStrategy` protocol (`strategies/base.py`) | `chunk(self, text: str, chunk_size: int, overlap: int = 0) -> list[str]` |
| `FixedSizeStrategy.chunk` (`strategies/fixed_size.py`) | Implements the stride change from §1 |
| `service.resolve_run` | New `overlap: int = 0` parameter; new validation (§2) |
| `service.stream_chunking` | Passes `overlap` through to `strategy_impl.chunk(...)` |
| `ChunkingResult` schema (`schemas.py`) | New `overlap: int` field, echoed back like `chunkSize` today, for traceability (constitution Principle V) |
| `GET /api/chunking/run/stream` (`router.py`) | New `overlap: int = 0` query parameter |
| `chunkingApi.ts` / `runChunkingStream` | New `overlap` argument, appended to the `EventSource` query string |
| `useFixedSizeChunking.run` | New `overlap` parameter, forwarded to `runChunkingStream` |
| `FixedSizeChunkingScreen` | Passes live `overlapValue` state into `run(...)`; renders the numeric readout (US1) and the below-slider chunk count (US2) from `result.totalChunks` |
| `types/chunking.ts` | `ChunkingResult.overlap: number` added to mirror the backend schema |

**Rationale**: This is the minimal change that makes Overlap load-bearing without altering any
existing non-overlap call path — a default of `0` is behavior-identical to today. It also keeps
the `ChunkingStrategy` interface pluggable (constitution Principle I): any future strategy can
ignore `overlap` (default `0`) without breaking the protocol.

**Alternatives considered**: Introducing a separate `overlap`-specific endpoint or strategy — 
rejected as unnecessary complexity; `overlap` is a parameter of the existing fixed-size algorithm,
not a new pipeline stage.

## 4. Surfacing the chunk count below the Overlap slider

**Decision**: Reuse the existing `result.totalChunks` value already returned by
`useFixedSizeChunking` (no new state, no new backend field). Render it in a new UI element
positioned below the Overlap slider and right-aligned with the Separators control, only when
`status === 'success' && result` (spec FR-003/FR-004).

**Rationale**: `totalChunks` already reflects exactly the number the spec asks to surface (it's the
same figure driving the existing "more chunks exist" note near the chunk list) — introducing a
second count would risk the two figures drifting out of sync. Matches constitution Principle III
(YAGNI): no new data plumbing needed.

**Alternatives considered**: Computing a separate live "would-produce N chunks" preview before
running chunking — rejected as out of scope; spec Clarifications explicitly resolve that the
display only updates after an explicit re-run, matching existing Chunk Size behavior.

## 5. Testing approach

**Decision**: Extend the existing test suites rather than introduce new frameworks (constitution
Principle II, NON-NEGOTIABLE):
- `backend/tests/unit/test_fixed_size_strategy.py` — new cases for `overlap > 0` (verifying shared
  trailing/leading words between consecutive pieces) and `overlap == 0` (byte-identical to current
  behavior).
- `backend/tests/unit/test_chunking_service.py` — new case(s) for the `overlap >= chunk_size`
  `ValueError`, and a passing case where `overlap` changes `totalChunks` for a fixed document/size.
- `backend/tests/contract/test_chunking_stream.py` — new `400` case for `overlap >= chunkSize` via
  the query string, and assert the terminal `result` event's payload includes `overlap`.
- `frontend/tests/unit/useFixedSizeChunking.test.ts` — assert `run(documentId, chunkSize, overlap)`
  forwards `overlap` into the `EventSource` URL.
- `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx` — assert the live numeric readout next to
  the slider, the below-slider chunk count (present/right-aligned after success, absent before any
  run), and the client-side validation block/message when overlap >= chunk size.
- `frontend/tests/e2e/fixed-size-chunking.spec.ts` — extend the existing end-to-end flow to change
  Overlap and confirm the chunk count updates after re-running.

**Rationale**: Every layer touched already has an established test file and convention (pytest for
backend, Vitest/RTL + Playwright for frontend) — extending them keeps the change reviewable and
consistent with how `005`/`006` were tested.

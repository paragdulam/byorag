# Feature Specification: Functional Chunk Overlap Controls

**Feature Branch**: `007-chunking-overlap-controls`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "Fixed size chunking looks good. I need some changes in the screen. Overlap slider looks like it doesnt work. Also overlap should denote some numbers on it to show how much overlap is used. Second thing is, show the count below overlap slider right aligned to separators. Also make the chunks obey to overlap. it seems its not working"

## Clarifications

### Session 2026-07-13

- Q: When the user drags the Overlap slider without pressing "Re-Calculate Chunks" afterward, should the already-displayed chunk list and chunk count update live, or only after the user explicitly re-runs chunking? → A: Only after an explicit re-run — this matches the existing Chunk Size input, which also requires "Re-Calculate Chunks" to take effect (per `005-fixed-size-chunking`), so behavior stays consistent across both controls.
- Q: What should happen if the user sets Overlap to a value equal to or greater than the current Chunk Size (a combination where chunks can no longer make forward progress)? → A: Block it like an invalid Chunk Size today — show a clear validation message and prevent chunking from running until the user lowers Overlap below Chunk Size.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how much overlap is set at a glance (Priority: P1)

As the user configuring Fixed Size Chunking, I want the Overlap control to clearly show me the
current overlap amount as a number, so that I can tell what value is set instead of only seeing an
unlabeled slider handle.

**Why this priority**: Without a visible number, the user cannot tell whether moving the slider
did anything at all — this is the root of the "the slider looks like it doesn't work" complaint.
It's the smallest, most immediate fix and a prerequisite for trusting the rest of the control.

**Independent Test**: Can be fully tested by opening the Fixed Size Chunking screen, observing the
overlap amount displayed next to or on the slider, dragging the slider to a new position, and
confirming the displayed number updates immediately to match the new slider position.

**Acceptance Scenarios**:

1. **Given** the Fixed Size Chunking screen is open, **When** the user looks at the Overlap
   control, **Then** the current overlap value is shown as a visible number alongside the slider.
2. **Given** the Overlap control is visible, **When** the user drags the slider to a different
   position, **Then** the displayed number updates immediately to reflect the new value, even
   before chunking is re-run.

---

### User Story 2 - See the resulting chunk count near the controls (Priority: P2)

As the user, I want the total number of chunks produced by the most recent chunking run displayed
below the Overlap slider, right-aligned toward the Separators control, so that I have an
at-a-glance count of the result without scrolling through the chunk list.

**Why this priority**: This gives immediate, glanceable feedback that changing Overlap (and
re-running chunking) actually changed the outcome — reinforcing that the control is "working" —
but it's secondary to simply seeing the overlap value itself (User Story 1).

**Independent Test**: Can be fully tested by running chunking on a document, confirming a chunk
count appears below the Overlap slider and is right-aligned with the Separators control above it,
then re-running chunking with different settings and confirming the count updates to match the new
result.

**Acceptance Scenarios**:

1. **Given** a chunking run has completed successfully, **When** the user looks below the Overlap
   slider, **Then** the total number of chunks produced by that run is displayed there, right-aligned
   so its right edge lines up with the Separators control.
2. **Given** no chunking run has completed yet in the current screen visit, **When** the user looks
   below the Overlap slider, **Then** no chunk count is shown (there is nothing to report yet).
3. **Given** a chunking run has completed, **When** the user changes settings and successfully
   re-runs chunking, **Then** the displayed count updates to the new run's total chunk count.

---

### User Story 3 - Chunks actually overlap by the configured amount (Priority: P1)

As the user, I want the Overlap value to genuinely control how much adjacent chunks share text, so
that adjusting Overlap and re-running chunking visibly changes the chunk boundaries and count, not
just the slider's cosmetic position.

**Why this priority**: This is the functional core of the request — the prior behavior treated
Overlap as purely decorative (per `005-fixed-size-chunking`'s Assumptions), which is precisely what
the user is reporting as broken. Without this, Overlap remains fake regardless of how clearly its
value is displayed.

**Independent Test**: Can be fully tested by chunking a document at a fixed Chunk Size with Overlap
set to 0, noting the chunk boundaries and count, then re-running chunking on the same document and
Chunk Size with a higher Overlap value, and confirming adjacent chunks now share trailing/leading
text proportional to the new Overlap value and the chunk count increases accordingly.

**Acceptance Scenarios**:

1. **Given** a document and a chosen Chunk Size, **When** the user sets Overlap to 0 and runs
   chunking, **Then** consecutive chunks share no text, matching prior fixed-size behavior.
2. **Given** the same document and Chunk Size, **When** the user sets Overlap to a positive value
   less than the Chunk Size and re-runs chunking, **Then** each chunk after the first begins by
   repeating approximately that amount of trailing content from the chunk before it.
3. **Given** the same document and Chunk Size, **When** the user increases Overlap further (while
   staying below Chunk Size) and re-runs chunking, **Then** the total chunk count visibly increases
   compared to a lower-overlap run, since more of each chunk is repeated content.
4. **Given** the user sets Overlap to a value equal to or greater than the current Chunk Size,
   **When** the user attempts to run chunking, **Then** a clear validation message explains that
   Overlap must be smaller than Chunk Size, and chunking does not run.

---

### Edge Cases

- What happens when Overlap is left at 0 (no overlap requested)? Chunking behaves exactly as it did
  before this feature — adjacent chunks share no text.
- What happens when the user changes Overlap but never presses "Re-Calculate Chunks"? Nothing about
  the displayed chunk list or chunk count changes — only the live numeric readout next to the
  slider updates (see Clarifications).
- What happens when Overlap is raised to just below the current Chunk Size (maximum allowed)? Each
  chunk after the first repeats nearly all of the previous chunk's content, producing many more,
  heavily-overlapping chunks; this is allowed since it still makes forward progress.
- What happens when Overlap equals or exceeds Chunk Size? Blocked with a clear validation message,
  the same way an invalid Chunk Size is blocked today (see Clarifications).
- What happens when the user changes the selected document or Chunk Size after an Overlap-driven
  run — does the old chunk count linger? The chunk count shown reflects only the most recently
  completed run; it is cleared or replaced the next time chunking completes (success or otherwise),
  consistent with how the chunk list itself behaves.
- What happens on a chunking run that fails (extraction failure or error)? No chunk count is shown
  for that attempt, since no chunks were produced.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Overlap control MUST display the currently selected overlap amount as a visible
  number.
- **FR-002**: The displayed overlap number MUST update immediately as the user drags the slider,
  independent of whether chunking has been re-run.
- **FR-003**: Below the Overlap slider, the screen MUST display the total chunk count produced by
  the most recently completed chunking run, right-aligned so it lines up with the Separators
  control.
- **FR-004**: The chunk count described in FR-003 MUST NOT be shown before any chunking run has
  completed in the current screen visit.
- **FR-005**: The chunk count described in FR-003 MUST update to reflect a new run's total whenever
  chunking is re-run and completes successfully, and MUST NOT be shown for a run that fails.
- **FR-006**: Triggering chunking MUST use the current Overlap value so that, when Overlap is
  greater than 0, each chunk after the first repeats approximately that amount of trailing content
  from the chunk immediately before it.
- **FR-007**: Setting Overlap to 0 MUST produce chunks with no shared content between adjacent
  chunks, matching the chunking behavior prior to this feature.
- **FR-008**: The screen MUST show a clear validation message and MUST NOT run chunking when the
  current Overlap value is equal to or greater than the current Chunk Size.
- **FR-009**: Changing the Overlap slider MUST NOT change the displayed chunk list or chunk count
  until the user explicitly triggers chunking again (consistent with the existing Chunk Size
  control's behavior).
- **FR-010**: The Separators control's existing appearance and (non-functional) behavior MUST
  remain unchanged by this feature.

### Key Entities

- **Chunking Result** *(extends the entity defined in `005-fixed-size-chunking`)*: now also
  reflects the Overlap value used to produce it. Its total chunk count is the value surfaced by
  FR-003 below the Overlap slider, in addition to any note already shown near the chunk list itself
  when the display cap is reached.
- **Overlap**: a user-configured amount, expressed in the same unit as Chunk Size (an approximate
  token count), specifying how much trailing content from one chunk is repeated at the start of the
  next chunk during a chunking run. Must be strictly less than the current Chunk Size for a run to
  be allowed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the time a user moves the Overlap slider, a matching numeric value is visibly
  updated with no perceptible delay.
- **SC-002**: For the same document and Chunk Size, users can observe the chunk count visibly
  increase when they raise Overlap and re-run chunking, and return to the original count when
  Overlap is set back to 0 and re-run, confirming Overlap genuinely drives the result.
- **SC-003**: 100% of the time a user sets Overlap to a value equal to or greater than Chunk Size
  and attempts to run chunking, they see a specific, explanatory message and no chunking occurs.
- **SC-004**: Users can determine the total chunk count of their most recent run without scrolling
  to or through the chunk list, by reading the count below the Overlap slider.

## Assumptions

- Overlap is expressed in the same approximate-token unit as Chunk Size (per
  `005-fixed-size-chunking`'s Assumptions), not raw character count — consistent units make the
  "Overlap must be less than Chunk Size" rule (FR-008) meaningful.
- "Right-aligned to Separators" means the chunk count's right edge lines up with the Separators
  control positioned to its right in the existing horizontal control bar, not that the count is
  physically inside the Separators control.
- The chunk count shown below the Overlap slider (FR-003) reports the same `totalChunks` figure
  already computed for the "more chunks exist beyond..." note near the chunk list (per
  `005-fixed-size-chunking` FR-007a); this feature surfaces that existing figure in a second,
  more prominent location rather than introducing a new count.
- The Separators control remains inert — this feature only makes Overlap functional; separator-based
  splitting is unchanged and out of scope, matching `005-fixed-size-chunking` and
  `006-chunking-embeddings-redesign`.
- No new document- or run-level data needs to persist beyond the current screen visit — this
  feature extends the existing ephemeral Chunking Result (per `005-fixed-size-chunking`'s
  Assumptions) rather than introducing storage.

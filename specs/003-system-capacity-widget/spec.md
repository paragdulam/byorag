# Feature Specification: System Capacity Widget

**Feature Branch**: `003-system-capacity-widget`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "remove the vector storage on top Right. Its a block that shows Vector storage. I want it removed, I also want to show the processor and computer information where the user plans to do RAG. It should show processor information, GPU information etc. It should give an estimate how many and how big of a PDF it can process for RAG. Mind you, It will do chunking and Vector semantic search later on. Keep info intact within that space. It should be an estimated value, we want to intimate the user in advance what he is getting into"

## Clarifications

### Session 2026-07-13

- Q: Should the capacity estimate be a static snapshot of total capacity, or a live figure that decreases as the user uploads documents? → A: Static snapshot — a fixed "this machine can handle roughly X PDFs" figure based on hardware alone, independent of what's currently uploaded; it does not track or subtract uploaded volume.
- Q: What should primarily drive the size of the capacity estimate? → A: A weighted combination of RAM, CPU, and GPU — all three detected signals feed into a single composite estimate rather than one factor dominating.
- Q: How should the estimate be presented — one combined figure, or two independent limits? → A: Two independent limits — a max PDF count and a max total size shown as separate figures (whichever is reached first is the practical ceiling), not a single blended number.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remove the Vector Storage indicator (Priority: P1)

As the user of the RAG experimentation tool, I no longer want to see a "Vector Storage" indicator on the Data Sources screen, because it currently shows made-up numbers that don't reflect anything real and don't help me plan my work.

**Why this priority**: The current widget is actively misleading (static placeholder numbers presented as real usage), so removing it is a prerequisite and can ship as a standalone improvement even before its replacement is ready.

**Independent Test**: Can be fully tested by opening the Data Sources screen and confirming no "Vector Storage" block, label, or percentage-of-capacity indicator appears anywhere on the page.

**Acceptance Scenarios**:

1. **Given** the Data Sources screen is open, **When** the page finishes loading, **Then** no "Vector Storage" block, GB figure, or "% of capacity" text is present anywhere on the screen.

---

### User Story 2 - See this machine's hardware at a glance (Priority: P1)

As the user, I want to see my computer's processor and GPU information in the same top-right spot where Vector Storage used to be, so that I immediately know what hardware I'm working with before I start uploading documents.

**Why this priority**: This is the direct replacement for the removed widget and delivers value on its own (hardware visibility) even before the capacity estimate is layered on top.

**Independent Test**: Can be fully tested by opening the Data Sources screen and confirming the top-right area shows the processor (name and/or core count) and GPU status (detected GPU name, or a clear "no dedicated GPU" indication) for the machine currently running the app.

**Acceptance Scenarios**:

1. **Given** the Data Sources screen is open on a machine with a detectable processor, **When** the page loads, **Then** the top-right area shows processor information (e.g., name and/or core count) for that machine.
2. **Given** the machine has a dedicated GPU, **When** the page loads, **Then** the widget shows the GPU is present (e.g., its name), distinguishing it from a machine with no dedicated GPU.
3. **Given** the machine has no dedicated GPU, **When** the page loads, **Then** the widget clearly states no dedicated GPU was detected rather than showing a blank or misleading value.
4. **Given** the widget is still gathering hardware information, **When** the user first opens the screen, **Then** a loading state is shown in place of the final values (no flash of empty or zeroed-out numbers).

---

### User Story 3 - Understand what this machine can realistically handle (Priority: P2)

As the user, I want an estimate of how many PDFs — and how large — my machine can reasonably process for RAG (chunking, embedding, and vector semantic search), so that I know what I'm getting into before I upload a large batch of documents.

**Why this priority**: This is the forward-looking, decision-support part of the feature. It depends on the hardware info from User Story 2 being available, and is more valuable once that foundation exists, but the feature still has value without it (raw hardware visibility alone helps).

**Independent Test**: Can be fully tested by opening the Data Sources screen and confirming the widget shows two separate estimate figures — a max PDF count (e.g., "~200 PDFs") and a max total size (e.g., "~2 GB total") — each clearly labeled as an estimate rather than a guarantee.

**Acceptance Scenarios**:

1. **Given** the Data Sources screen has loaded hardware information, **When** the user views the widget, **Then** it shows two distinct estimate figures — a maximum PDF count and a maximum total data size the machine can reasonably process for RAG — each derived from the detected hardware.
2. **Given** the estimate is shown, **When** the user reads it, **Then** both figures are visibly labeled as approximations (e.g., "estimated", "~", or similar language), not presented as precise or guaranteed limits.
3. **Given** a machine with limited resources (e.g., low memory or CPU core count), **When** the estimate is calculated, **Then** both the shown PDF count limit and size limit are noticeably lower than the estimate for a higher-spec machine, so the user can tell the estimate is actually responsive to their hardware.

---

### Edge Cases

- What happens when the app cannot determine hardware details at all (e.g., detection fails or is unsupported in the current environment)? The widget shows a clear fallback message (e.g., "hardware information unavailable") instead of blank fields, an error screen, or blocking the rest of the Data Sources screen.
- What happens when no dedicated GPU is present? The widget states this explicitly and the capacity estimate reflects CPU-only processing rather than silently omitting GPU-dependent capacity.
- What happens on a very low-resource machine (minimal CPU/RAM)? The estimate still renders, showing a correspondingly small PDF count/size rather than failing or showing a negative/zero value without explanation.
- What happens if hardware detection is slow? The screen shows a loading state for the widget without delaying or blocking the rest of the Data Sources screen (upload area, document list) from being usable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Data Sources screen MUST NOT display the "Vector Storage" block (label, used-GB figure, or percent-of-capacity indicator) anywhere on the screen.
- **FR-002**: The Data Sources screen MUST display, in the same top-right position previously occupied by the Vector Storage block, a widget showing the current machine's processor information (at minimum: processor name and/or core count).
- **FR-003**: The widget MUST show GPU status for the current machine: if a dedicated GPU is detected, its name/identifying information; if none is detected, an explicit "no dedicated GPU" indication.
- **FR-004**: The widget MUST show total system memory (RAM) for the current machine, since it directly affects how much can be processed for RAG.
- **FR-005**: The widget MUST show an estimated PDF processing capacity for RAG as two independent figures — a maximum PDF count and a maximum total data size — each derived from the detected processor, GPU, and memory information, rather than a single blended figure.
- **FR-005a**: The capacity estimate MUST be a static snapshot based on hardware alone; it MUST NOT track cumulative uploaded volume or decrease as the user uploads documents (no "remaining capacity" behavior).
- **FR-006**: The estimate MUST account for the full local RAG workflow the user will run against these documents (chunking, embedding/vectorization, and vector semantic search), not just raw file storage.
- **FR-006a**: The estimate MUST be derived from a weighted combination of detected RAM, CPU, and GPU signals rather than any single factor dominating the calculation.
- **FR-007**: The widget MUST visibly label the capacity figure as an estimate/approximation (e.g., using "~", "estimated", or equivalent language), so the user understands it is advisory, not a guarantee.
- **FR-008**: When hardware information cannot be determined, the widget MUST show a clear fallback message in place of the missing values rather than leaving blank fields or breaking page load.
- **FR-009**: The widget MUST show a loading state while hardware information and the capacity estimate are being gathered, without blocking or delaying the rest of the Data Sources screen (upload area, document list).
- **FR-010**: The capacity estimate MUST scale with the detected hardware, so that a lower-resource machine is shown a visibly lower estimate than a higher-resource machine.
- **FR-011**: Removing the Vector Storage block and adding this widget MUST NOT change or break any other Data Sources screen functionality (uploading, document list, CSV export).

### Key Entities

- **System Hardware Profile**: Represents the current machine's relevant hardware for RAG capacity planning — processor (name, core count), GPU (present/absent, name if present), and total memory (RAM).
- **PDF Processing Capacity Estimate**: A pair of derived, approximate limits — a maximum PDF count and a maximum total PDF data size — describing what the machine can reasonably handle for the full RAG workflow (chunking, embedding, vector semantic search), calculated as a static, weighted combination of the System Hardware Profile's RAM, CPU, and GPU signals.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Vector Storage indicator no longer appears anywhere on the Data Sources screen, verified by visual inspection of the top-right area.
- **SC-002**: Users can identify their machine's processor, GPU status, and both estimated PDF processing limits (count and size) within 5 seconds of the Data Sources screen finishing load, without navigating away from the screen.
- **SC-003**: Users on a lower-resource machine and a higher-resource machine see visibly different capacity estimates for both the PDF count and size limits, confirming the figures reflect real hardware differences rather than a fixed placeholder.
- **SC-004**: 100% of the time hardware detection fails or is unavailable, the user sees an explanatory message instead of a blank, broken, or error-crashed widget.

## Assumptions

- The capacity estimate's two figures (max PDF count, max total size) are rough, order-of-magnitude numbers meant to set expectations before a large upload, not precise or contractually guaranteed limits, since the actual chunking/embedding cost of a PDF varies by content density and the embedding model chosen later.
- "The computer where the user plans to do RAG" refers to the machine currently running the application (the local host), not a remote or hypothetical target machine.
- Hardware information (real processor/GPU/memory details) is sourced from the host machine the application is running on, using whatever level of system access the application already has, rather than being self-reported or manually entered by the user.
- The estimate reflects the machine's capacity for the combined pipeline (chunking + embedding + storing + searching vectors) mentioned by the user, evaluated holistically, since no specific embedding model or chunk size has been chosen yet at this stage of the product.
- If GPU information cannot be reliably determined, the estimate falls back to a CPU-only calculation rather than blocking display of the widget.
- This widget replaces the Vector Storage block only; it does not introduce an actual vector database integration (still out of scope, consistent with the existing Data Sources screen).

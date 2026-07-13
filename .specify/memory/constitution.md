<!--
Sync Impact Report
==================
Version change: [TEMPLATE] → 1.0.0 (initial concrete ratification)

Modified principles: N/A (template placeholders filled for the first time)

Added sections:
- I. Pluggable RAG Architecture (Experimentation-First)
- II. Test-First, Test at Every Level (NON-NEGOTIABLE)
- III. Single-User Simplicity (YAGNI)
- IV. Fixed Technology Stack
- V. Experiment Observability & Reproducibility
- Technology Stack & Environment (Section 2)
- Development Workflow (Section 3)
- Governance

Removed sections: None (all placeholders replaced)

Templates requiring updates:
- ✅ .specify/templates/plan-template.md — Constitution Check gate is generic/derived from this file, no edit needed
- ✅ .specify/templates/spec-template.md — no constitution-specific references to update
- ✅ .specify/templates/tasks-template.md — updated "Tests are OPTIONAL" note to reflect NON-NEGOTIABLE test principle
- ✅ .specify/templates/checklist-template.md — reviewed, generic, no changes needed

Follow-up TODOs: None
-->

# byorag Constitution

## Core Principles

### I. Pluggable RAG Architecture (Experimentation-First)

RAG is subjective and continuously evolving; no single chunking, embedding,
retrieval, or generation strategy is canonical or "correct" for all use cases.
Every stage of the RAG pipeline (ingestion, chunking, embedding, retrieval,
reranking, generation) MUST be implemented behind a swappable
interface/strategy so alternative approaches can be added and compared
without rewriting the surrounding pipeline. New strategies MUST be
addable via configuration or a registered strategy implementation, not
via hardcoded branching logic scattered through the codebase.

**Rationale**: This tool exists specifically because there is no
one-size-fits-all RAG approach. If the architecture is not pluggable, the
tool cannot fulfill its core purpose of letting a user experiment with and
compare different RAG strategies.

### II. Test-First, Test at Every Level (NON-NEGOTIABLE)

Every feature or component — ingestion, chunking, embedding, retrieval API,
and frontend component — MUST have automated tests before it is considered
done. This includes unit tests for isolated logic, integration tests for
pipeline stages (e.g., PDF ingest → chunk → embed → store in Qdrant), and
end-to-end tests for user-facing flows. Tests MUST be written before or
alongside implementation and MUST fail prior to the implementation existing.
A pull request or task that introduces new behavior without corresponding
tests at the appropriate level(s) is incomplete.

**Rationale**: An experimentation tool is only trustworthy if its results
are trustworthy. Without test coverage at every level, regressions in
chunking, embedding, or retrieval logic can silently invalidate experiment
comparisons.

### III. Single-User Simplicity (YAGNI)

The current scope is a single local user managing sources on the local
filesystem. The system MUST NOT introduce multi-tenant support,
authentication/authorization, or role-based access complexity until an
actual, concrete requirement demands it. Build the smallest thing that
solves the current experimentation need; defer scaling, multi-user, and
production-hardening concerns until they are real, tracked requirements.

**Rationale**: Premature generalization for hypothetical future users
slows down the core goal of enabling fast RAG experimentation for the one
user this tool currently serves.

### IV. Fixed Technology Stack

The application uses a fixed, agreed technology stack:
- Frontend: React
- Backend: Python
- Vector store: Qdrant
- Source storage: local filesystem (PDFs)
- Deployment: Docker (the application and its dependencies, including
  Qdrant, MUST run via Docker/docker-compose)

Changing any of these core stack choices (framework, language, vector
database, or containerization approach) is a MAJOR governance decision and
requires an explicit constitution amendment, not an ad-hoc implementation
choice.

**Rationale**: A fixed stack keeps the experimentation surface focused on
RAG strategies themselves rather than on infrastructure churn, and ensures
the app is reproducibly deployable via Docker.

### V. Experiment Observability & Reproducibility

Because RAG quality is subjective and comparative, every experiment run
(chunking strategy, embedding model, retrieval parameters, etc.) MUST
record its configuration and results so runs are comparable and
reproducible. Sources (PDFs) and their derived artifacts (chunks,
embeddings, retrieval results) MUST be traceable back to the experiment
configuration that produced them.

**Rationale**: Without recorded configuration and traceability, the user
cannot meaningfully compare "which RAG approach worked better," which
defeats the purpose of an experimentation tool.

## Technology Stack & Environment

- **Frontend**: React (a standard React build tooling setup, e.g. Vite).
- **Backend**: Python (any Python web framework is acceptable as long as it
  supports the pluggable-strategy and testing requirements above).
- **Vector Database**: Qdrant, run as a containerized service.
- **Source Storage**: PDFs are added by the user and stored on the local
  filesystem; no cloud object storage is required at this stage.
- **Containerization**: The full application (frontend, backend, and
  Qdrant) MUST be runnable via Docker/docker-compose for a consistent,
  reproducible local environment.
- **Users**: Single local user. No multi-user auth system is in scope.

## Development Workflow

- Features proceed through the spec → plan → tasks → implement workflow;
  every plan MUST include a Constitution Check confirming alignment with
  the principles above before implementation begins.
- Tests (unit, integration, end-to-end as applicable) MUST be part of the
  task breakdown for every feature — per Principle II, they are not
  optional for this project even where generic templates mark them
  optional.
- Any deviation from the Fixed Technology Stack (Principle IV) or from the
  pluggable-architecture requirement (Principle I) MUST be recorded and
  justified in the plan's Complexity Tracking section, and requires a
  constitution amendment if adopted permanently.

## Governance

This constitution supersedes all other informal practices for this
project. Amendments are made by editing this file directly, MUST state the
rationale for the change, and MUST update the version number according to
semantic versioning:
- **MAJOR**: Backward-incompatible governance/principle removals or
  redefinitions (e.g., changing the fixed technology stack).
- **MINOR**: New principle or section added, or existing guidance
  materially expanded.
- **PATCH**: Clarifications, wording fixes, or non-semantic refinements.

All plans and specs MUST verify compliance with this constitution via the
Constitution Check gate. Any complexity that violates a principle (e.g.,
introducing multi-user auth, or a hardcoded non-pluggable pipeline stage)
MUST be explicitly justified in the plan's Complexity Tracking section;
unjustified violations MUST be simplified before implementation proceeds.

**Version**: 1.0.0 | **Ratified**: 2026-07-04 | **Last Amended**: 2026-07-04

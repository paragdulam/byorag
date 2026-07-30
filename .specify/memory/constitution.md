<!--
Sync Impact Report
==================
Version change: 2.0.0 → 3.0.0

Modified principles:
- IV. Fixed Technology Stack — Source Storage REPLACED, not expanded: PDF content moves
  from the local filesystem to PostgreSQL (associated with its owning document/corpus),
  per 024-user-authentication User Story 3. This is a redefinition/removal of an existing
  fixed-stack choice (local filesystem storage for PDFs no longer applies), not an
  additive change, hence MAJOR per this constitution's own Governance rules — the same
  category as the 2.0.0 Principle III change earlier today.

  (Carried over from the 1.1.0 → 2.0.0 amendment done earlier in this session: III. Single-
  User Simplicity (YAGNI) → III. Multi-User Simplicity (Right-Sized Complexity) — the
  prior prohibition on multi-tenant support/authentication was replaced with a requirement
  to support it, per 024-user-authentication.)

Added sections: None

Removed sections: None

Templates/docs requiring updates:
- ✅ .specify/memory/constitution.md — Principle IV's Source Storage bullet and rationale
  updated; Technology Stack & Environment's Relational Database and Source Storage bullets
  rewritten to reflect PDF bytes now living in PostgreSQL
- ✅ README.md — Tech stack table's "Data" row and the "Source Storage" env-var/behavior
  description updated to reflect database-backed PDF storage
- ✅ .specify/templates/plan-template.md — reviewed; Constitution Check section has no
  hardcoded principle names, no edit needed
- ✅ .specify/templates/spec-template.md — reviewed; no constitution-specific references
- ✅ .specify/templates/tasks-template.md — reviewed; only references Principle II by name,
  unaffected by this change
- ✅ .specify/templates/checklist-template.md — reviewed, generic, no changes needed

Follow-up TODOs: None — both constitution conflicts flagged by 024-user-authentication
(Principle III and the Source Storage rule) are now resolved.
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

### III. Multi-User Simplicity (Right-Sized Complexity)

BYORAG supports multiple independent user accounts, each authenticating with
their own credentials. Every corpus — and everything nested under it
(documents, chunks, embeddings, chat history) — MUST belong to exactly one
user account, and no user may see or act on another's data. Basic
account-based authentication and per-user data ownership are a real,
concrete requirement, not a hypothetical one, and MUST be supported. What
remains out of scope until an actual, concrete requirement demands it:
shared or collaborative corpora across accounts, role-based permissions or
admin oversight of other users' data, third-party OAuth/SSO providers,
login rate-limiting/lockout, and per-account storage quotas. Build the
smallest multi-user model that gives each user their own private, isolated
experimentation space; defer collaboration, enterprise-grade auth
hardening, and abuse-prevention infrastructure until they are real, tracked
requirements.

**Rationale**: A single local user was the right starting scope while
BYORAG served one person experimenting locally, but real multi-user usage
makes basic account-based ownership a genuine requirement rather than a
hypothetical one. The same YAGNI discipline that justified single-user
simplicity now applies one level up: support real per-user isolation, but
keep resisting speculative complexity (sharing, roles, SSO, quotas) until
an actual need for it arrives.

### IV. Fixed Technology Stack

The application uses a fixed, agreed technology stack:
- Frontend: React
- Backend: Python
- Vector store: Qdrant
- Relational database: PostgreSQL (local), for structured metadata — corpora,
  documents, document-corpus associations, and chunks
- Source storage: PostgreSQL — PDF content is stored in the database,
  associated with its owning document/corpus, not on the local filesystem
- Deployment: Docker (the application and its dependencies, including
  Qdrant and PostgreSQL, MUST run via Docker/docker-compose)

Changing any of these core stack choices (framework, language, vector
database, relational database, or containerization approach) is a MAJOR
governance decision and requires an explicit constitution amendment, not an
ad-hoc implementation choice.

**Rationale**: A fixed stack keeps the experimentation surface focused on
RAG strategies themselves rather than on infrastructure churn, and ensures
the app is reproducibly deployable via Docker. PostgreSQL was added
alongside the vector store to give relational entities (corpora, documents,
and their many-to-many/one-to-many relationships) real referential
integrity — something the vector store and flat-file storage are not
designed to provide. PDF content itself later moved into PostgreSQL too
(alongside its metadata) once multi-user support (Principle III) made a
per-server local directory the wrong storage model: a user's documents
must survive and remain reachable regardless of which backend instance
handles their request, which only a shared, durable data store — not a
local filesystem — can guarantee.

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
- **Relational Database**: PostgreSQL, run as a containerized service, storing
  both structured metadata (corpora, documents, document-corpus associations,
  chunks) and — per Source Storage below — the PDF content itself.
- **Source Storage**: PDFs are added by the user and stored as content in
  PostgreSQL, associated with their owning document/corpus; no local
  filesystem directory and no cloud object storage are required.
- **Containerization**: The full application (frontend, backend, Qdrant, and
  PostgreSQL) MUST be runnable via Docker/docker-compose for a consistent,
  reproducible local environment.
- **Users**: Multiple independent user accounts, each authenticating with their
  own email/password credentials; every corpus and its nested data (documents,
  chunks, embeddings, chat history) belongs to exactly one account. No
  shared/collaborative corpora, roles, admin oversight, or third-party
  OAuth/SSO are in scope yet (Principle III).

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
introducing shared/collaborative corpora across accounts, or a hardcoded
non-pluggable pipeline stage) MUST be explicitly justified in the plan's
Complexity Tracking section; unjustified violations MUST be simplified
before implementation proceeds.

**Version**: 3.0.0 | **Ratified**: 2026-07-04 | **Last Amended**: 2026-07-29

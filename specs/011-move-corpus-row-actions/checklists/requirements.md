# Specification Quality Checklist: Move Corpus Row Actions to the Corpora Screen

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-14
**Feature**: [spec.md](../spec.md)

## Content Quality

- [X] No implementation details (languages, frameworks, APIs)
- [X] Focused on user value and business needs
- [X] Written for non-technical stakeholders
- [X] All mandatory sections completed

## Requirement Completeness

- [X] No [NEEDS CLARIFICATION] markers remain
- [X] Requirements are testable and unambiguous
- [X] Success criteria are measurable
- [X] Success criteria are technology-agnostic (no implementation details)
- [X] All acceptance scenarios are defined
- [X] Edge cases are identified
- [X] Scope is clearly bounded
- [X] Dependencies and assumptions identified

## Feature Readiness

- [X] All functional requirements have clear acceptance criteria
- [X] User scenarios cover primary flows
- [X] Feature meets measurable outcomes defined in Success Criteria
- [X] No implementation details leak into specification

## Notes

- No [NEEDS CLARIFICATION] markers were needed: this feature relocates the "Make Active"/"Delete"
  actions introduced by `010-corpora-dropdown-nav` to the Corpora screen and strips them from the
  sidebar dropdown, per an explicit correction from the user. The one genuine judgment call (does
  the sidebar dropdown keep click-to-select after its buttons are removed, or become read-only?)
  has a reasonable default with low risk either way, so it is recorded in Assumptions rather than
  blocking on a question.
- All checklist items pass on the first draft.

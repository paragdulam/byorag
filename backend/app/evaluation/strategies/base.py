from typing import Protocol

from app.evaluation.schemas import JudgeResult


class EvaluationJudge(Protocol):
    def score(self, question: str, chunks: list[str], answer: str) -> JudgeResult:
        """Scores one answered Playground turn's retrieval-and-generation quality, returning the
        four measures plus the actual model name the provider used (020-metrics-stage-groups).
        Raises on failure (missing config, malformed judge response, upstream API error) —
        callers treat a raised exception as "leave this turn unscored", not as an error to
        surface to the user (019-metrics-dashboard research.md Decision 2)."""
        ...


JUDGES: dict[str, EvaluationJudge] = {}

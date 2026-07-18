from typing import NamedTuple

from pydantic import BaseModel


class QualityScores(BaseModel):
    contextPrecision: float
    contextRecall: float
    responseRelevancy: float
    faithfulness: float


class AggregatedQualityScores(QualityScores):
    sampleSize: int


class JudgeResult(NamedTuple):
    """A judge's scores plus the actual model name its provider returned (mirrors
    `app.generation.providers.base.GenerationResult`'s model/answer split —
    020-metrics-stage-groups research.md §1)."""

    model: str
    scores: QualityScores

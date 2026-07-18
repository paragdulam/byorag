from pydantic import BaseModel

from app.evaluation.schemas import AggregatedQualityScores


class CorpusSummary(BaseModel):
    corpusId: str
    name: str
    chunkingStrategies: list[str]
    hasPipelines: bool


class ListCorporaResponse(BaseModel):
    corpora: list[CorpusSummary]


class ScopeBreakdown(BaseModel):
    corpus: int
    document: int


class PipelineSummary(BaseModel):
    chunkingStrategy: str
    embeddingModel: str
    retrievalStrategy: str
    chunkCount: int
    questionCount: int
    answerCount: int
    scopeBreakdown: ScopeBreakdown
    generationLlm: str | None
    judgeLlm: str | None
    scores: AggregatedQualityScores | None


class ListPipelinesResponse(BaseModel):
    corpusId: str
    pipelines: list[PipelineSummary]

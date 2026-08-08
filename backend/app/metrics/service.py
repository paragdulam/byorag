from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.lookups import get_corpus_owned_by
from app.db.models import Chunk as ChunkRow
from app.db.models import ConversationTurn, Corpus, Document
from app.db.models import Embedding as EmbeddingRow
from app.evaluation.service import (
    aggregate_pipeline_scores,
    latest_generation_model,
    latest_judge_model,
    turn_ids_for_pipeline,
)
from app.metrics.schemas import (
    CorpusSummary,
    ListCorporaResponse,
    ListPipelinesResponse,
    PipelineSummary,
    ScopeBreakdown,
)
from app.retrieval.strategies.base import DEFAULT_RETRIEVAL_STRATEGY


class CorpusNotFoundError(ValueError):
    def __init__(self, corpus_id: str) -> None:
        self.corpus_id = corpus_id
        super().__init__(f"No corpus found with id '{corpus_id}'")


class NotEnoughPipelinesError(ValueError):
    def __init__(self, corpus_id: str) -> None:
        self.corpus_id = corpus_id
        super().__init__(f"Corpus '{corpus_id}' has fewer than 2 pipelines to compare")


def list_corpora_summary(db: Session, user_id: str) -> ListCorporaResponse:
    """One entry per corpus owned by `user_id`, with the chunking techniques that have saved
    chunks — the Metrics screen's corpus list (spec FR-001/FR-002, scoped per user by
    024-user-authentication)."""
    corpora = db.execute(
        select(Corpus).where(Corpus.user_id == user_id).order_by(Corpus.name)
    ).scalars().all()

    summaries = []
    for corpus in corpora:
        strategies = list(
            db.execute(
                select(ChunkRow.strategy)
                .join(Document, Document.id == ChunkRow.document_id)
                .where(Document.corpus_id == corpus.id)
                .distinct()
            ).scalars()
        )
        summaries.append(
            CorpusSummary(
                corpusId=corpus.id,
                name=corpus.name,
                chunkingStrategies=strategies,
                hasPipelines=len(strategies) > 0,
            )
        )

    return ListCorporaResponse(corpora=summaries)


def list_pipelines(db: Session, user_id: str, corpus_id: str) -> ListPipelinesResponse:
    """Every `(chunking_strategy, embedding_model)` pipeline for one corpus, each with its own
    chunk count, question/answer counts, scope breakdown, and aggregated quality scores (spec
    FR-002–FR-009; data-model.md "Derived Concept: RAG Pipeline"). A pipeline only appears once
    it has at least one saved embedding — chunking alone (no embeddings yet) isn't a complete
    pipeline, matching `PipelineSummary.embeddingModel` being required, not optional."""
    corpus = get_corpus_owned_by(db, corpus_id, user_id)
    if corpus is None:
        raise CorpusNotFoundError(corpus_id)

    pairs = db.execute(
        select(ChunkRow.strategy, EmbeddingRow.model)
        .join(EmbeddingRow, EmbeddingRow.chunk_id == ChunkRow.id)
        .join(Document, Document.id == ChunkRow.document_id)
        .where(Document.corpus_id == corpus_id)
        .distinct()
    ).all()

    pipelines = [
        _build_pipeline_summary(db, corpus_id, strategy, model) for strategy, model in pairs
    ]
    return ListPipelinesResponse(corpusId=corpus_id, pipelines=pipelines)


def _build_pipeline_summary(
    db: Session, corpus_id: str, chunking_strategy: str, embedding_model: str
) -> PipelineSummary:
    chunk_count = db.execute(
        select(func.count(ChunkRow.id))
        .join(Document, Document.id == ChunkRow.document_id)
        .where(Document.corpus_id == corpus_id, ChunkRow.strategy == chunking_strategy)
    ).scalar_one()

    turn_ids = turn_ids_for_pipeline(db, corpus_id, chunking_strategy, embedding_model)

    answer_count = 0
    scope_counts = {"corpus": 0, "document": 0}
    if turn_ids:
        rows = db.execute(
            select(ConversationTurn.scope, ConversationTurn.answer.is_not(None))
            .where(ConversationTurn.id.in_(turn_ids))
        ).all()
        for scope, answered in rows:
            scope_counts[scope] += 1
            if answered:
                answer_count += 1

    return PipelineSummary(
        chunkingStrategy=chunking_strategy,
        embeddingModel=embedding_model,
        retrievalStrategy=DEFAULT_RETRIEVAL_STRATEGY,
        chunkCount=chunk_count,
        questionCount=len(turn_ids),
        answerCount=answer_count,
        scopeBreakdown=ScopeBreakdown(corpus=scope_counts["corpus"], document=scope_counts["document"]),
        generationLlm=latest_generation_model(db, turn_ids),
        judgeLlm=latest_judge_model(db, turn_ids),
        scores=aggregate_pipeline_scores(db, turn_ids),
    )

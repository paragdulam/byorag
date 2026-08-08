from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.lookups import get_conversation_turn_or_none
from app.db.models import ConversationTurn
from app.db.models import TurnQualityScore as TurnQualityScoreRow
from app.evaluation.schemas import AggregatedQualityScores
from app.evaluation.strategies.base import JUDGES
from app.profile import service as profile_service

# The only registered JUDGES key today, mirroring how `app/playground/service.py` hardcodes
# "cosine-similarity" as the only registered retrieval strategy rather than exposing it as a
# per-request/config choice (019-metrics-dashboard research.md Decision 1).
DEFAULT_JUDGE = "anthropic"


def score_turn(db: Session, turn_id: str) -> None:
    """Scores an answered `ConversationTurn` via the configured `EvaluationJudge` and persists a
    `TurnQualityScore`. Reuses the caller's `db` session rather than opening a new one — safe
    here because this only ever runs as a FastAPI `BackgroundTask`, which Starlette guarantees
    starts only *after* the request's own response (and its `Depends(get_db)` teardown) has
    already completed, so there is no concurrent use of the session (research.md §2). Any
    failure (turn not found/not answered, judge error) is swallowed: a turn simply stays
    unscored and is excluded from pipeline aggregates, since this runs after the answer has
    already been returned to the user."""
    turn = get_conversation_turn_or_none(db, turn_id)
    if turn is None or turn.answer is None:
        return

    judge = JUDGES.get(DEFAULT_JUDGE)
    if judge is None:
        return

    # Same owner-resolution as db/lookups.py::get_conversation_turn_owned_by. No key on
    # file for the owning user means this turn is skipped (stays unscored) — a missing key
    # is treated exactly like any other judge failure below, never a shared/other key
    # (025-user-profile-anthropic-key FR-016, FR-017).
    owner_id = turn.document.user_id if turn.document is not None else turn.corpus.user_id
    api_key = profile_service.resolve_decrypted_key(db, owner_id) if owner_id is not None else None
    if api_key is None:
        return

    try:
        result = judge.score(
            turn.question, [chunk.content for chunk in turn.chunks], turn.answer, api_key
        )
    except Exception:
        return

    db.add(
        TurnQualityScoreRow(
            turn_id=turn.id,
            context_precision=result.scores.contextPrecision,
            context_recall=result.scores.contextRecall,
            response_relevancy=result.scores.responseRelevancy,
            faithfulness=result.scores.faithfulness,
            judge=DEFAULT_JUDGE,
            judge_model=result.model,
            scored_at=datetime.now(timezone.utc),
        )
    )
    db.commit()


def aggregate_pipeline_scores(
    db: Session, turn_ids: list[str]
) -> AggregatedQualityScores | None:
    """Means the four quality measures across every scored turn in `turn_ids`. Returns `None`
    (not zeros) when none of those turns has a score yet (spec FR-013) — callers use the
    presence/absence of a result, plus `sampleSize` once present, to distinguish "no data yet"
    from a genuinely low score."""
    if not turn_ids:
        return None

    row = db.execute(
        select(
            func.avg(TurnQualityScoreRow.context_precision),
            func.avg(TurnQualityScoreRow.context_recall),
            func.avg(TurnQualityScoreRow.response_relevancy),
            func.avg(TurnQualityScoreRow.faithfulness),
            func.count(TurnQualityScoreRow.id),
        ).where(TurnQualityScoreRow.turn_id.in_(turn_ids))
    ).one()

    precision, recall, relevancy, faithfulness, sample_size = row
    if sample_size == 0:
        return None

    return AggregatedQualityScores(
        contextPrecision=float(precision),
        contextRecall=float(recall),
        responseRelevancy=float(relevancy),
        faithfulness=float(faithfulness),
        sampleSize=sample_size,
    )


def latest_generation_model(db: Session, turn_ids: list[str]) -> str | None:
    """The `llm_model` of the most recently *answered* turn in `turn_ids` — `None` when none of
    them has been successfully answered yet (spec FR-006). Matches the "most recently used"
    convention `playground.service.get_context` already applies to `embeddingModel`
    (020-metrics-stage-groups research.md §3)."""
    if not turn_ids:
        return None

    return db.execute(
        select(ConversationTurn.llm_model)
        .where(ConversationTurn.id.in_(turn_ids), ConversationTurn.answer.is_not(None))
        .order_by(ConversationTurn.answered_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def latest_judge_model(db: Session, turn_ids: list[str]) -> str | None:
    """The `judge_model` of the most recently *scored* turn in `turn_ids` — `None` when none of
    them has been scored yet (spec FR-006)."""
    if not turn_ids:
        return None

    return db.execute(
        select(TurnQualityScoreRow.judge_model)
        .where(TurnQualityScoreRow.turn_id.in_(turn_ids))
        .order_by(TurnQualityScoreRow.scored_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def turn_ids_for_pipeline(
    db: Session, corpus_id: str, chunking_strategy: str, embedding_model: str
) -> list[str]:
    """Every turn (document- or corpus-scoped) belonging to one `(corpus_id, chunking_strategy,
    embedding_model)` pipeline — the shared filter behind question/answer counts, the scope
    breakdown, and quality-score aggregation (data-model.md "Derived Concept: RAG Pipeline")."""
    from app.db.models import Document  # local import avoids a cycle at module load

    document_scoped = select(ConversationTurn.id).join(
        Document, Document.id == ConversationTurn.document_id
    ).where(
        Document.corpus_id == corpus_id,
        ConversationTurn.chunking_strategy == chunking_strategy,
        ConversationTurn.embedding_model == embedding_model,
    )
    corpus_scoped = select(ConversationTurn.id).where(
        ConversationTurn.corpus_id == corpus_id,
        ConversationTurn.chunking_strategy == chunking_strategy,
        ConversationTurn.embedding_model == embedding_model,
    )
    return list(db.execute(document_scoped.union(corpus_scoped)).scalars())

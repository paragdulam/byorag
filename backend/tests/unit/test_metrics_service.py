import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.orm import Session

from app.auth import service as auth_service
from app.db.models import EMBEDDING_DIMENSIONS
from app.db.models import Chunk as ChunkRow
from app.db.models import ConversationTurn, Corpus, Document, DocumentCorpus
from app.db.models import Embedding as EmbeddingRow
from app.db.models import TurnQualityScore
from app.metrics import service


@pytest.fixture
def user_id(db_session: Session) -> str:
    return auth_service.create_user(db_session, "metrics-owner@example.com", "hunter22").id


def _make_corpus_with_chunked_document(
    db_session: Session,
    user_id: str,
    strategy: str = "fixed-size",
    model: str = "bert",
    chunk_count: int = 3,
) -> tuple[Corpus, Document]:
    corpus = Corpus(user_id=user_id, name=f"corpus-{uuid.uuid4()}")
    document = Document(
        user_id=user_id,
        name="doc.pdf",
        content_hash=f"hash-{uuid.uuid4()}",
        content=b"x",
        size_bytes=10,
        status="processed",
    )
    db_session.add_all([corpus, document])
    db_session.flush()
    db_session.add(DocumentCorpus(document_id=document.id, corpus_id=corpus.id))

    for i in range(chunk_count):
        chunk = ChunkRow(
            document_id=document.id, index=i, content=f"chunk {i}", strategy=strategy,
            chunk_size=10, overlap=0,
        )
        db_session.add(chunk)
        db_session.flush()
        db_session.add(EmbeddingRow(chunk_id=chunk.id, model=model, vector=[0.0] * EMBEDDING_DIMENSIONS))

    db_session.flush()
    return corpus, document


def _make_turn(
    db_session: Session, document: Document, *, strategy: str, model: str,
    scope: str = "document", corpus_id: str | None = None, answered: bool = False,
    llm_model: str | None = None, answered_at: datetime | None = None,
) -> ConversationTurn:
    turn = ConversationTurn(
        document_id=document.id if scope == "document" else None,
        corpus_id=corpus_id if scope == "corpus" else None,
        scope=scope,
        chunking_strategy=strategy,
        question="a question",
        embedding_model=model,
        query_embedding=[0.0] * EMBEDDING_DIMENSIONS,
        answer="an answer" if answered else None,
        llm_model=llm_model if answered else None,
        answered_at=answered_at if answered else None,
    )
    db_session.add(turn)
    db_session.flush()
    return turn


def _add_score(
    db_session: Session, turn: ConversationTurn, *,
    judge_model: str = "claude-sonnet-5", scored_at: datetime | None = None,
    **overrides: float,
) -> None:
    defaults = dict(
        context_precision=0.8, context_recall=0.6, response_relevancy=0.9, faithfulness=0.7
    )
    defaults.update(overrides)
    db_session.add(
        TurnQualityScore(
            turn_id=turn.id, judge="anthropic", judge_model=judge_model,
            scored_at=scored_at or datetime.now(timezone.utc), **defaults
        )
    )
    db_session.flush()


def test_list_pipelines_reports_chunk_count_for_a_corpus_with_no_questions(
    db_session: Session, user_id: str
) -> None:
    corpus, _ = _make_corpus_with_chunked_document(db_session, user_id, chunk_count=4)
    db_session.commit()

    result = service.list_pipelines(db_session, user_id, corpus.id)

    assert len(result.pipelines) == 1
    pipeline = result.pipelines[0]
    assert pipeline.chunkCount == 4
    assert pipeline.questionCount == 0
    assert pipeline.answerCount == 0
    assert pipeline.scores is None


def test_list_pipelines_averages_scores_and_reports_sample_size(
    db_session: Session, user_id: str
) -> None:
    corpus, document = _make_corpus_with_chunked_document(db_session, user_id)
    turn1 = _make_turn(db_session, document, strategy="fixed-size", model="bert", answered=True)
    turn2 = _make_turn(db_session, document, strategy="fixed-size", model="bert", answered=True)
    _add_score(db_session, turn1, context_precision=1.0, context_recall=0.5, response_relevancy=0.8, faithfulness=0.6)
    _add_score(db_session, turn2, context_precision=0.6, context_recall=0.9, response_relevancy=0.4, faithfulness=1.0)
    db_session.commit()

    result = service.list_pipelines(db_session, user_id, corpus.id)

    pipeline = result.pipelines[0]
    assert pipeline.questionCount == 2
    assert pipeline.answerCount == 2
    assert pipeline.scores is not None
    assert pipeline.scores.sampleSize == 2
    assert pipeline.scores.contextPrecision == pytest.approx(0.8)
    assert pipeline.scores.contextRecall == pytest.approx(0.7)
    assert pipeline.scores.responseRelevancy == pytest.approx(0.6)
    assert pipeline.scores.faithfulness == pytest.approx(0.8)


def test_list_pipelines_excludes_unscored_turns_from_the_sample(
    db_session: Session, user_id: str
) -> None:
    corpus, document = _make_corpus_with_chunked_document(db_session, user_id)
    scored = _make_turn(db_session, document, strategy="fixed-size", model="bert", answered=True)
    _make_turn(db_session, document, strategy="fixed-size", model="bert", answered=True)  # unscored
    _add_score(db_session, scored)
    db_session.commit()

    result = service.list_pipelines(db_session, user_id, corpus.id)

    pipeline = result.pipelines[0]
    assert pipeline.questionCount == 2
    assert pipeline.answerCount == 2
    assert pipeline.scores.sampleSize == 1


def test_list_pipelines_reports_scope_breakdown(db_session: Session, user_id: str) -> None:
    corpus, document = _make_corpus_with_chunked_document(db_session, user_id)
    _make_turn(db_session, document, strategy="fixed-size", model="bert", scope="document")
    _make_turn(db_session, document, strategy="fixed-size", model="bert", scope="document")
    _make_turn(
        db_session, document, strategy="fixed-size", model="bert", scope="corpus",
        corpus_id=corpus.id,
    )
    db_session.commit()

    result = service.list_pipelines(db_session, user_id, corpus.id)

    pipeline = result.pipelines[0]
    assert pipeline.scopeBreakdown.document == 2
    assert pipeline.scopeBreakdown.corpus == 1
    assert pipeline.questionCount == 3


def test_list_pipelines_separates_multiple_techniques_on_the_same_corpus(
    db_session: Session, user_id: str
) -> None:
    corpus, document = _make_corpus_with_chunked_document(db_session, user_id, strategy="fixed-size", chunk_count=2)
    for i in range(3):
        chunk = ChunkRow(
            document_id=document.id, index=100 + i, content=f"other {i}", strategy="semantic",
            chunk_size=10, overlap=0,
        )
        db_session.add(chunk)
        db_session.flush()
        db_session.add(EmbeddingRow(chunk_id=chunk.id, model="bert", vector=[0.0] * EMBEDDING_DIMENSIONS))
    db_session.commit()

    result = service.list_pipelines(db_session, user_id, corpus.id)

    strategies = {p.chunkingStrategy: p.chunkCount for p in result.pipelines}
    assert strategies == {"fixed-size": 2, "semantic": 3}


def test_list_corpora_summary_flags_a_corpus_with_no_saved_chunks(
    db_session: Session, user_id: str
) -> None:
    corpus = Corpus(user_id=user_id, name="empty corpus")
    db_session.add(corpus)
    db_session.commit()

    result = service.list_corpora_summary(db_session, user_id)

    entry = next(c for c in result.corpora if c.corpusId == corpus.id)
    assert entry.chunkingStrategies == []
    assert entry.hasPipelines is False


def test_list_pipelines_reports_retrieval_strategy_even_with_no_questions(
    db_session: Session, user_id: str
) -> None:
    corpus, _ = _make_corpus_with_chunked_document(db_session, user_id)
    db_session.commit()

    result = service.list_pipelines(db_session, user_id, corpus.id)

    assert result.pipelines[0].retrievalStrategy == "cosine-similarity"


def test_list_pipelines_generation_and_judge_llm_are_none_with_no_qualifying_turns(
    db_session: Session, user_id: str,
) -> None:
    corpus, document = _make_corpus_with_chunked_document(db_session, user_id)
    _make_turn(db_session, document, strategy="fixed-size", model="bert", answered=False)
    db_session.commit()

    pipeline = service.list_pipelines(db_session, user_id, corpus.id).pipelines[0]

    assert pipeline.generationLlm is None
    assert pipeline.judgeLlm is None


def test_list_pipelines_shows_the_most_recently_answered_and_scored_models(
    db_session: Session, user_id: str,
) -> None:
    corpus, document = _make_corpus_with_chunked_document(db_session, user_id)
    earlier = _make_turn(
        db_session, document, strategy="fixed-size", model="bert", answered=True,
        llm_model="claude-sonnet-5", answered_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    later = _make_turn(
        db_session, document, strategy="fixed-size", model="bert", answered=True,
        llm_model="claude-opus-4-8", answered_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
    )
    _add_score(
        db_session, earlier, judge_model="claude-sonnet-5",
        scored_at=datetime(2026, 1, 1, 0, 5, tzinfo=timezone.utc),
    )
    _add_score(
        db_session, later, judge_model="claude-opus-4-8",
        scored_at=datetime(2026, 1, 2, 0, 5, tzinfo=timezone.utc),
    )
    db_session.commit()

    pipeline = service.list_pipelines(db_session, user_id, corpus.id).pipelines[0]

    assert pipeline.generationLlm == "claude-opus-4-8"
    assert pipeline.judgeLlm == "claude-opus-4-8"

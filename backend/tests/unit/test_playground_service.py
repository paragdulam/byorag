import pytest
from sqlalchemy.orm import Session

from app.auth import service as auth_service
from app.db.models import EMBEDDING_DIMENSIONS
from app.db.models import Chunk as ChunkRow
from app.db.models import ConversationTurn
from app.db.models import Document
from app.db.models import Embedding as EmbeddingRow
from app.generation.providers.base import GENERATION_PROVIDERS, GenerationError, GenerationResult
from app.playground import service


@pytest.fixture
def user_id(db_session: Session) -> str:
    return auth_service.create_user(db_session, "playground-owner@example.com", "hunter22").id


def _make_document(db_session: Session, user_id: str, name: str = "doc.pdf") -> Document:
    document = Document(
        user_id=user_id,
        name=name,
        content_hash=f"hash-{name}-{id(name)}",
        content=b"x",
        size_bytes=10,
        status="processed",
    )
    db_session.add(document)
    db_session.flush()
    return document


def _make_document_with_saved_embedding(
    db_session: Session, user_id: str, name: str = "doc.pdf"
) -> Document:
    document = _make_document(db_session, user_id, name)
    chunk = ChunkRow(
        document_id=document.id,
        index=0,
        content="some text",
        strategy="fixed-size",
        chunk_size=10,
        overlap=0,
    )
    db_session.add(chunk)
    db_session.flush()
    db_session.add(EmbeddingRow(chunk_id=chunk.id, model="bert", vector=[0.0] * EMBEDDING_DIMENSIONS))
    db_session.flush()
    return document


def test_create_turn_unknown_document_raises_not_found(db_session: Session, user_id: str) -> None:
    with pytest.raises(FileNotFoundError):
        service.create_turn(
            db_session, user_id, "00000000-0000-0000-0000-000000000000", "bert", "a query"
        )


def test_create_turn_another_users_document_raises_not_found(
    db_session: Session, user_id: str
) -> None:
    other_user_id = auth_service.create_user(db_session, "playground-other@example.com", "hunter22").id
    document = _make_document_with_saved_embedding(db_session, other_user_id)
    db_session.commit()

    with pytest.raises(FileNotFoundError):
        service.create_turn(db_session, user_id, document.id, "bert", "a query")


def test_create_turn_unregistered_model_raises_unsupported_model(
    db_session: Session, user_id: str
) -> None:
    document = _make_document(db_session, user_id)
    db_session.commit()

    with pytest.raises(service.UnsupportedModelError):
        service.create_turn(db_session, user_id, document.id, "not-a-model", "a query")


def test_create_turn_document_with_no_saved_embeddings_raises(
    db_session: Session, user_id: str
) -> None:
    document = _make_document(db_session, user_id)
    db_session.commit()

    with pytest.raises(service.NoSavedEmbeddingsError):
        service.create_turn(db_session, user_id, document.id, "bert", "a query")


def test_create_turn_empty_query_raises(db_session: Session, user_id: str) -> None:
    document = _make_document_with_saved_embedding(db_session, user_id)
    db_session.commit()

    with pytest.raises(service.EmptyQueryError):
        service.create_turn(db_session, user_id, document.id, "bert", "   ")


def test_create_turn_query_too_long_raises(db_session: Session, user_id: str) -> None:
    document = _make_document_with_saved_embedding(db_session, user_id)
    db_session.commit()
    long_query = " ".join(f"word{i}" for i in range(1000))

    with pytest.raises(service.QueryTooLongError):
        service.create_turn(db_session, user_id, document.id, "bert", long_query)


def test_create_turn_persists_the_turn_and_its_chunk_snapshots(
    db_session: Session, user_id: str
) -> None:
    document = _make_document_with_saved_embedding(db_session, user_id)
    db_session.commit()

    turn_out = service.create_turn(db_session, user_id, document.id, "bert", "a query")

    assert turn_out.question == "a query"
    assert len(turn_out.queryEmbedding) == EMBEDDING_DIMENSIONS
    assert len(turn_out.chunks) == 1
    assert turn_out.chunks[0].content == "some text"
    assert turn_out.answer is None
    assert turn_out.error is None

    stored = db_session.get(ConversationTurn, turn_out.id)
    assert stored is not None
    assert stored.document_id == document.id
    assert len(stored.chunks) == 1
    assert stored.chunks[0].chunk_id is not None
    assert stored.chunks[0].embedding_id is not None
    assert stored.chunks[0].rank == 1


@pytest.fixture
def answered_turn(db_session: Session, user_id: str) -> ConversationTurn:
    document = _make_document_with_saved_embedding(db_session, user_id)
    db_session.commit()
    turn_out = service.create_turn(db_session, user_id, document.id, "bert", "a query")
    return db_session.get(ConversationTurn, turn_out.id)


def test_generate_answer_persists_prompt_and_answer_on_success(
    db_session: Session, user_id: str, answered_turn: ConversationTurn, monkeypatch: pytest.MonkeyPatch
) -> None:
    stub = _StubProvider(result=GenerationResult(model="claude-sonnet-5", answer="The answer."))
    monkeypatch.setitem(GENERATION_PROVIDERS, "anthropic", stub)

    turn_out = service.generate_answer(db_session, user_id, answered_turn.id)

    assert turn_out.answer == "The answer."
    assert turn_out.llmProvider == "anthropic"
    assert turn_out.llmModel == "claude-sonnet-5"
    assert turn_out.error is None
    assert turn_out.answeredAt is not None
    assert "a query" in (turn_out.prompt or "")


def test_generate_answer_persists_error_and_prompt_on_failure(
    db_session: Session, user_id: str, answered_turn: ConversationTurn, monkeypatch: pytest.MonkeyPatch
) -> None:
    stub = _StubProvider(error=GenerationError("boom"))
    monkeypatch.setitem(GENERATION_PROVIDERS, "anthropic", stub)

    with pytest.raises(service.GenerationFailedError):
        service.generate_answer(db_session, user_id, answered_turn.id)

    db_session.refresh(answered_turn)
    assert answered_turn.answer is None
    assert answered_turn.error == "boom"
    assert answered_turn.prompt is not None


def test_generate_answer_unknown_turn_raises_not_found(db_session: Session, user_id: str) -> None:
    with pytest.raises(service.TurnNotFoundError):
        service.generate_answer(db_session, user_id, "00000000-0000-0000-0000-000000000000")


def test_generate_answer_another_users_turn_raises_not_found(
    db_session: Session, user_id: str, answered_turn: ConversationTurn
) -> None:
    other_user_id = auth_service.create_user(db_session, "playground-other2@example.com", "hunter22").id

    with pytest.raises(service.TurnNotFoundError):
        service.generate_answer(db_session, other_user_id, answered_turn.id)


def test_generate_answer_rejects_a_turn_with_no_chunks(db_session: Session, user_id: str) -> None:
    document = _make_document(db_session, user_id)
    db_session.commit()
    turn = ConversationTurn(
        document_id=document.id,
        question="orphan question",
        embedding_model="bert",
        query_embedding=[0.0] * EMBEDDING_DIMENSIONS,
    )
    db_session.add(turn)
    db_session.commit()

    with pytest.raises(service.NoRetrievedChunksError):
        service.generate_answer(db_session, user_id, turn.id)


def test_list_turns_unknown_document_raises_not_found(db_session: Session, user_id: str) -> None:
    with pytest.raises(FileNotFoundError):
        service.list_turns(db_session, user_id, "00000000-0000-0000-0000-000000000000")


def test_list_turns_returns_turns_oldest_first_with_chunks_ordered_by_rank(
    db_session: Session, user_id: str
) -> None:
    document = _make_document_with_saved_embedding(db_session, user_id)
    db_session.commit()

    first = service.create_turn(db_session, user_id, document.id, "bert", "first question")
    second = service.create_turn(db_session, user_id, document.id, "bert", "second question")

    result = service.list_turns(db_session, user_id, document.id)

    assert result.documentId == document.id
    assert [turn.id for turn in result.turns] == [first.id, second.id]
    assert [turn.question for turn in result.turns] == ["first question", "second question"]
    for turn in result.turns:
        assert len(turn.chunks) == 1


def test_list_turns_empty_conversation_returns_empty_list(db_session: Session, user_id: str) -> None:
    document = _make_document(db_session, user_id)
    db_session.commit()

    result = service.list_turns(db_session, user_id, document.id)

    assert result.turns == []


class _StubProvider:
    def __init__(self, result: GenerationResult | None = None, error: Exception | None = None) -> None:
        self._result = result
        self._error = error

    def generate(self, prompt: str) -> GenerationResult:
        if self._error is not None:
            raise self._error
        assert self._result is not None
        return self._result

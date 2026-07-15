from app.db.models import EMBEDDING_DIMENSIONS
from app.embeddings.models.bert import BertEmbeddingStrategy


def test_embed_yields_one_pair_per_input_text_with_correct_dims() -> None:
    strategy = BertEmbeddingStrategy()

    results = list(strategy.embed(["short text", "another one"]))

    assert [index for index, _ in results] == [0, 1]
    for _, vector in results:
        assert len(vector) == EMBEDDING_DIMENSIONS
        assert all(isinstance(value, float) for value in vector)


def test_embed_is_deterministic_for_the_same_text() -> None:
    strategy = BertEmbeddingStrategy()

    [(_, first)] = list(strategy.embed(["repeatable text"]))
    [(_, second)] = list(strategy.embed(["repeatable text"]))

    assert first == second

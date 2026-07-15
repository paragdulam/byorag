from app.embeddings.models.bert import BertEmbeddingStrategy


def test_fits_accepts_a_short_query() -> None:
    strategy = BertEmbeddingStrategy()

    assert strategy.fits("What is the refund policy?") is True


def test_fits_rejects_a_query_exceeding_the_max_token_length() -> None:
    strategy = BertEmbeddingStrategy()
    # bert-base-uncased's model_max_length is 512 tokens; 1000 distinct words comfortably
    # exceeds that even accounting for subword tokenization producing fewer tokens than
    # words in some cases.
    long_query = " ".join(f"word{i}" for i in range(1000))

    assert strategy.fits(long_query) is False

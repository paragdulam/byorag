from app.chunking.strategies.fixed_size import FixedSizeStrategy


def test_splits_into_expected_number_of_chunks() -> None:
    text = " ".join(f"word{i}" for i in range(20))

    chunks = FixedSizeStrategy().chunk(text, chunk_size=5)

    assert len(chunks) == 4
    assert chunks[0] == "word0 word1 word2 word3 word4"
    assert chunks[-1] == "word15 word16 word17 word18 word19"


def test_handles_a_remainder_as_a_final_shorter_chunk() -> None:
    text = " ".join(f"word{i}" for i in range(22))

    chunks = FixedSizeStrategy().chunk(text, chunk_size=5)

    assert len(chunks) == 5
    assert chunks[-1] == "word20 word21"


def test_larger_chunk_size_yields_fewer_larger_chunks_for_the_same_text() -> None:
    text = " ".join(f"word{i}" for i in range(100))

    small = FixedSizeStrategy().chunk(text, chunk_size=10)
    large = FixedSizeStrategy().chunk(text, chunk_size=50)

    assert len(large) < len(small)
    assert len(large) == 2
    assert len(small) == 10


def test_empty_text_produces_no_chunks() -> None:
    chunks = FixedSizeStrategy().chunk("", chunk_size=10)

    assert chunks == []


def test_chunk_size_larger_than_text_produces_a_single_chunk() -> None:
    text = "one two three"

    chunks = FixedSizeStrategy().chunk(text, chunk_size=1000)

    assert chunks == ["one two three"]

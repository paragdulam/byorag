from app.golden_dataset.service import merge_candidates


class _FakeChunk:
    def __init__(self, id: str, document_id: str = "doc-1", index: int = 0, content: str = "text") -> None:
        self.id = id
        self.document_id = document_id
        self.index = index
        self.content = content


def _results(*chunk_ids: str) -> list[tuple[_FakeChunk, str, float]]:
    # (chunk, embedding_id, score) — score descending order is what callers already hand in,
    # matching RETRIEVAL_STRATEGIES's own best-match-first contract.
    return [(_FakeChunk(cid), f"emb-{cid}", 1.0 - i * 0.01) for i, cid in enumerate(chunk_ids)]


def test_chunk_in_both_lists_outranks_a_chunk_in_only_one_list_at_the_same_rank() -> None:
    question_results = _results("a", "b")
    answer_results = _results("a", "c")

    merged = merge_candidates(question_results, answer_results)

    ids = [c.chunkId for c in merged]
    assert ids[0] == "a"  # in both lists at rank 1 — highest combined RRF score
    assert set(ids) == {"a", "b", "c"}


def test_matched_flags_reflect_which_list_a_chunk_came_from() -> None:
    question_results = _results("a", "b")
    answer_results = _results("a", "c")

    merged = merge_candidates(question_results, answer_results)
    by_id = {c.chunkId: c for c in merged}

    assert by_id["a"].matchedQuestion is True
    assert by_id["a"].matchedAnswer is True
    assert by_id["b"].matchedQuestion is True
    assert by_id["b"].matchedAnswer is False
    assert by_id["c"].matchedQuestion is False
    assert by_id["c"].matchedAnswer is True


def test_dedup_by_chunk_id_never_returns_the_same_chunk_twice() -> None:
    question_results = _results("a", "b", "c")
    answer_results = _results("a", "b", "c")

    merged = merge_candidates(question_results, answer_results)

    ids = [c.chunkId for c in merged]
    assert len(ids) == len(set(ids)) == 3


def test_empty_answer_side_still_returns_question_side_results_with_matched_answer_false() -> None:
    question_results = _results("a", "b")

    merged = merge_candidates(question_results, [])

    assert len(merged) == 2
    assert all(c.matchedAnswer is False for c in merged)
    assert all(c.matchedQuestion is True for c in merged)


def test_result_fields_carry_chunk_content_and_position() -> None:
    question_results = _results("a")
    question_results[0][0].document_id = "doc-42"
    question_results[0][0].index = 7
    question_results[0][0].content = "Either party may terminate with 30 days notice."

    merged = merge_candidates(question_results, [])

    assert merged[0].chunkId == "a"
    assert merged[0].documentId == "doc-42"
    assert merged[0].chunkIndex == 7
    assert merged[0].content == "Either party may terminate with 30 days notice."


def test_score_is_the_raw_cosine_similarity_from_whichever_search_matched() -> None:
    """033-ui-ux-polish: the RRF score itself is a fused rank score, not a cosine similarity —
    `score` on the returned candidate is the underlying search's own raw similarity value."""
    question_results = _results("a", "b")  # a=1.00, b=0.99
    answer_results = _results("a", "c")  # a=1.00, c=0.99

    merged = merge_candidates(question_results, answer_results)
    by_id = {c.chunkId: c for c in merged}

    assert by_id["b"].score == 0.99  # question-only match — question's own raw score
    assert by_id["c"].score == 0.99  # answer-only match — answer's own raw score


def test_score_prefers_the_question_search_raw_score_when_a_chunk_matches_both() -> None:
    question_results = [(_FakeChunk("a"), "emb-a", 0.9)]
    answer_results = [(_FakeChunk("a"), "emb-a", 0.7)]

    merged = merge_candidates(question_results, answer_results)

    assert merged[0].score == 0.9

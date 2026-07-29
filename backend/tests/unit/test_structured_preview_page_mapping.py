from pathlib import Path

from sqlalchemy.orm import Session

from app.chunking import service
from app.db.hashing import compute_content_hash
from app.db.models import Chunk as ChunkRow
from app.db.models import Document
from tests.pdf_helpers import make_multi_page_words_pdf, make_words_pdf


def _make_document(db_session: Session, tmp_path: Path, filename: str, content: bytes) -> Document:
    path = tmp_path / filename
    path.write_bytes(content)
    document = Document(
        name=filename,
        content_hash=compute_content_hash(content),
        storage_path=str(path),
        size_bytes=len(content),
        status="processed",
    )
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)
    return document


def _save_chunks(
    db_session: Session, document: Document, chunk_size: int, overlap: int = 0
) -> None:
    for kind, payload in service.save_chunks_stream(
        db_session, document, chunk_size, "fixed-size", overlap=overlap
    ):
        pass  # noqa: SIM110 - drain the generator; the terminal "result" event is unused here


class TestPageBoundaries:
    def test_single_page_document_produces_one_page_spanning_full_text(
        self, db_session: Session, tmp_path: Path
    ) -> None:
        document = _make_document(db_session, tmp_path, "one-page.pdf", make_words_pdf(20))
        _save_chunks(db_session, document, chunk_size=5)

        full_text, _segments, pages, _chunk_ranges = service.compute_structured_preview(
            db_session, document
        )

        assert len(pages) == 1
        assert pages[0].pageNumber == 1
        assert pages[0].start == 0
        assert pages[0].end == len(full_text)

    def test_multi_page_document_pages_are_contiguous_with_no_gaps(
        self, db_session: Session, tmp_path: Path
    ) -> None:
        document = _make_document(
            db_session, tmp_path, "multi-page.pdf", make_multi_page_words_pdf([10, 15, 8])
        )
        _save_chunks(db_session, document, chunk_size=6)

        full_text, _segments, pages, _chunk_ranges = service.compute_structured_preview(
            db_session, document
        )

        assert [p.pageNumber for p in pages] == [1, 2, 3]
        assert pages[0].start == 0
        for prev, curr in zip(pages, pages[1:]):
            assert prev.end == curr.start
        assert pages[-1].end == len(full_text)

    def test_blank_leading_page_is_shifted_off_and_omitted_with_no_gap(
        self, db_session: Session, tmp_path: Path
    ) -> None:
        # A blank first page ("") contributes nothing; its leading newline joiner gets consumed
        # entirely by fullText's own .strip() (research.md §3) — the surviving page must still
        # start at 0 and there must be no gap where the blank page used to be.
        document = _make_document(
            db_session, tmp_path, "blank-leading.pdf", make_multi_page_words_pdf([0, 10, 10])
        )
        _save_chunks(db_session, document, chunk_size=6)

        full_text, _segments, pages, _chunk_ranges = service.compute_structured_preview(
            db_session, document
        )

        # The blank page 1 is omitted entirely — only pages 2 and 3 survive.
        assert [p.pageNumber for p in pages] == [2, 3]
        assert pages[0].start == 0
        assert pages[0].end == pages[1].start  # no gap at the former blank-page joiner
        assert pages[-1].end == len(full_text)

    def test_blank_middle_page_is_omitted_and_its_gap_absorbed_by_the_preceding_page(
        self, db_session: Session, tmp_path: Path
    ) -> None:
        document = _make_document(
            db_session, tmp_path, "blank-middle.pdf", make_multi_page_words_pdf([10, 0, 10])
        )
        _save_chunks(db_session, document, chunk_size=6)

        full_text, _segments, pages, _chunk_ranges = service.compute_structured_preview(
            db_session, document
        )

        # The blank page 2 is omitted — pages 1 and 3 survive, with page 1 extended to page 3's
        # start so the two now-adjacent newline joiners are still covered by *some* page.
        assert [p.pageNumber for p in pages] == [1, 3]
        assert pages[0].start == 0
        assert pages[0].end == pages[1].start
        assert pages[-1].end == len(full_text)


class TestChunkRanges:
    def test_chunk_range_matches_the_word_window_formula(
        self, db_session: Session, tmp_path: Path
    ) -> None:
        document = _make_document(db_session, tmp_path, "chunks.pdf", make_words_pdf(20))
        _save_chunks(db_session, document, chunk_size=5, overlap=0)

        full_text, _segments, _pages, chunk_ranges = service.compute_structured_preview(
            db_session, document
        )

        assert [c.chunkIndex for c in chunk_ranges] == [0, 1, 2, 3]
        for chunk_range in chunk_ranges:
            assert 0 <= chunk_range.start < chunk_range.end <= len(full_text)

    def test_chunk_range_recoverable_independent_of_overlap_collapsing(
        self, db_session: Session, tmp_path: Path
    ) -> None:
        document = _make_document(db_session, tmp_path, "overlap.pdf", make_words_pdf(20))
        _save_chunks(db_session, document, chunk_size=6, overlap=3)

        _full_text, segments, _pages, chunk_ranges = service.compute_structured_preview(
            db_session, document
        )

        # segments collapses overlapping words to kind="overlap"/chunkIndex=None — but each
        # chunk's own true range is still fully recoverable from chunkRanges regardless.
        assert any(s.kind == "overlap" for s in segments)
        by_index = {c.chunkIndex: c for c in chunk_ranges}
        assert 0 in by_index and 1 in by_index
        assert by_index[1].start < by_index[0].end  # genuine character-range overlap

    def test_out_of_bounds_chunk_is_omitted_from_chunk_ranges(
        self, db_session: Session, tmp_path: Path
    ) -> None:
        # A chunk row whose index * stride already exceeds the document's word count (e.g. left
        # over from a since-shrunk document) must not produce a nonsensical/empty range.
        document = _make_document(db_session, tmp_path, "short.pdf", make_words_pdf(5))
        db_session.add(
            ChunkRow(
                document_id=document.id,
                index=0,
                content="word word word word word",
                strategy="fixed-size",
                chunk_size=5,
                overlap=0,
            )
        )
        db_session.add(
            ChunkRow(
                document_id=document.id,
                index=1,
                content="",
                strategy="fixed-size",
                chunk_size=5,
                overlap=0,
            )
        )
        db_session.commit()

        _full_text, _segments, _pages, chunk_ranges = service.compute_structured_preview(
            db_session, document
        )

        assert [c.chunkIndex for c in chunk_ranges] == [0]

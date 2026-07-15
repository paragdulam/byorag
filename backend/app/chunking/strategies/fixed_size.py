from app.chunking.strategies.base import STRATEGIES


class FixedSizeStrategy:
    """Splits text into fixed-size pieces, approximating "tokens" as
    whitespace-delimited words (research.md §3). `overlap` (research.md §1,
    007-chunking-overlap-controls) repeats that many trailing words of each
    chunk at the start of the next one by shrinking the window stride from
    `chunk_size` to `chunk_size - overlap`."""

    def chunk(self, text: str, chunk_size: int, overlap: int = 0) -> list[str]:
        words = text.split()
        if not words:
            return []

        stride = chunk_size - overlap
        return [
            " ".join(words[i : i + chunk_size]) for i in range(0, len(words), stride)
        ]


STRATEGIES["fixed-size"] = FixedSizeStrategy()

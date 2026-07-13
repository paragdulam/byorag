from app.chunking.strategies.base import STRATEGIES


class FixedSizeStrategy:
    """Splits text into fixed-size pieces, approximating "tokens" as
    whitespace-delimited words (research.md §3)."""

    def chunk(self, text: str, chunk_size: int) -> list[str]:
        words = text.split()
        if not words:
            return []

        return [
            " ".join(words[i : i + chunk_size]) for i in range(0, len(words), chunk_size)
        ]


STRATEGIES["fixed-size"] = FixedSizeStrategy()

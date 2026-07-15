from collections.abc import Iterator

import torch
from transformers import AutoModel, AutoTokenizer

from app.embeddings.models.base import EMBEDDING_MODEL_LABELS, EMBEDDING_MODELS

MODEL_NAME = "bert-base-uncased"


class BertEmbeddingStrategy:
    """Computes 768-dim chunk embeddings with `bert-base-uncased`, mean-pooled over
    non-padding tokens of the last hidden state (013-bert-pgvector-embeddings
    research.md §1) — run entirely locally on CPU, no external API call. The
    tokenizer/model are lazily loaded once and cached as instance state on first use,
    so repeated calls (e.g. across a stream) don't reload ~440MB of weights each time."""

    def __init__(self) -> None:
        self._tokenizer: AutoTokenizer | None = None
        self._model: AutoModel | None = None

    def _ensure_loaded(self) -> tuple[AutoTokenizer, AutoModel]:
        if self._tokenizer is None or self._model is None:
            self._tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
            self._model = AutoModel.from_pretrained(MODEL_NAME)
            self._model.eval()
        return self._tokenizer, self._model

    def embed(self, texts: list[str]) -> Iterator[tuple[int, list[float]]]:
        tokenizer, model = self._ensure_loaded()

        for index, text in enumerate(texts):
            encoded = tokenizer(
                text, return_tensors="pt", truncation=True, padding=True
            )
            with torch.no_grad():
                output = model(**encoded)

            last_hidden_state = output.last_hidden_state
            attention_mask = encoded["attention_mask"].unsqueeze(-1).float()
            masked_hidden = last_hidden_state * attention_mask
            summed = masked_hidden.sum(dim=1)
            counts = attention_mask.sum(dim=1).clamp(min=1e-9)
            mean_pooled = (summed / counts).squeeze(0)

            yield index, mean_pooled.tolist()

    def fits(self, text: str) -> bool:
        """Whether `text` tokenizes within this model's max input length, checked without
        truncating so the count reflects the real token count (016-playground-similarity-
        search research.md Decision 4) — `embed()` above truncates silently for chunk text,
        but a Playground query is explicitly rejected instead (see Clarifications)."""
        tokenizer, _ = self._ensure_loaded()
        token_count = len(tokenizer(text, truncation=False)["input_ids"])
        return token_count <= tokenizer.model_max_length


EMBEDDING_MODELS["bert"] = BertEmbeddingStrategy()
EMBEDDING_MODEL_LABELS["bert"] = "BERT (bert-base-uncased)"

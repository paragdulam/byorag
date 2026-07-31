import json
import re

from anthropic import Anthropic

from app.config import settings
from app.evaluation.schemas import JudgeResult, QualityScores
from app.evaluation.strategies.base import JUDGES

MAX_TOKENS = 256

_SCORE_FIELDS = ("contextPrecision", "contextRecall", "responseRelevancy", "faithfulness")


class JudgeError(RuntimeError):
    pass


def _build_prompt(question: str, chunks: list[str], answer: str) -> str:
    context = "\n\n".join(f"[CHUNK {i}]\n{chunk}" for i, chunk in enumerate(chunks, start=1))
    return (
        "You are evaluating one turn of a retrieval-augmented generation (RAG) pipeline. Score "
        "each measure from 0.0 (worst) to 1.0 (best) and respond with ONLY a JSON object with "
        "exactly these four keys: contextPrecision, contextRecall, responseRelevancy, "
        "faithfulness. No prose, no markdown formatting, just the JSON object.\n\n"
        "- contextPrecision: how much of the retrieved context is actually relevant to the question.\n"
        "- contextRecall: how completely the retrieved context covers what would be needed to answer the question.\n"
        "- responseRelevancy: how directly the answer addresses the question asked.\n"
        "- faithfulness: how well the answer is grounded in the retrieved context, with no unsupported claims.\n\n"
        f"Question: {question}\n\nRetrieved context:\n{context}\n\nAnswer: {answer}"
    )


def _parse_scores(text: str) -> QualityScores:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match is None:
        raise JudgeError(f"Judge response did not contain a JSON object: {text!r}")

    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise JudgeError(f"Judge response was not valid JSON: {text!r}") from exc

    try:
        values = {field: float(data[field]) for field in _SCORE_FIELDS}
    except (KeyError, TypeError, ValueError) as exc:
        raise JudgeError(f"Judge response missing/invalid score fields: {data!r}") from exc

    for field, value in values.items():
        if not 0.0 <= value <= 1.0:
            raise JudgeError(f"Judge score {field!r} out of range [0.0, 1.0]: {data!r}")

    return QualityScores(**values)


class AnthropicJudge:
    """Scores a Playground turn's retrieval-and-generation quality via a single Anthropic
    Messages API call, asking for four 0.0-1.0 measures as JSON (019-metrics-dashboard
    research.md Decision 1) — reuses the same provider/config already required for answer
    generation rather than introducing a second LLM dependency."""

    def score(self, question: str, chunks: list[str], answer: str, api_key: str) -> JudgeResult:
        client = Anthropic(api_key=api_key)
        try:
            response = client.messages.create(
                model=settings.anthropic_model,
                max_tokens=MAX_TOKENS,
                messages=[{"role": "user", "content": _build_prompt(question, chunks, answer)}],
            )
        except Exception as exc:
            raise JudgeError(f"Anthropic API request failed: {exc}") from exc

        text = "".join(
            block.text for block in response.content if getattr(block, "type", None) == "text"
        )
        if not text:
            raise JudgeError("Anthropic API returned an empty response")

        return JudgeResult(model=response.model, scores=_parse_scores(text))


JUDGES["anthropic"] = AnthropicJudge()

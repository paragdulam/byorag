from anthropic import Anthropic

from app.config import settings
from app.generation.providers.base import GENERATION_PROVIDERS, GenerationError, GenerationResult

MAX_TOKENS = 1024


class AnthropicProvider:
    """Calls the Anthropic Messages API with a prompt already assembled by
    `app.playground.service` (research.md Decision 5 — the prompt template is shared across
    providers, not provider-specific, so results stay comparable across models). `api_key` is
    the *caller's* — resolved per-user by `playground/service.py` — never a shared/server
    default (025-user-profile-anthropic-key research.md §3)."""

    def generate(self, prompt: str, api_key: str) -> GenerationResult:
        client = Anthropic(api_key=api_key)
        try:
            response = client.messages.create(
                model=settings.anthropic_model,
                max_tokens=MAX_TOKENS,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as exc:
            raise GenerationError(f"Anthropic API request failed: {exc}") from exc

        text = "".join(
            block.text for block in response.content if getattr(block, "type", None) == "text"
        )
        if not text:
            raise GenerationError("Anthropic API returned an empty response")

        return GenerationResult(model=response.model, answer=text)


GENERATION_PROVIDERS["anthropic"] = AnthropicProvider()

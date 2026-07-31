from typing import NamedTuple, Protocol


class GenerationResult(NamedTuple):
    model: str
    answer: str


class GenerationProvider(Protocol):
    def generate(self, prompt: str, api_key: str) -> "GenerationResult": ...


class GenerationError(RuntimeError):
    pass


GENERATION_PROVIDERS: dict[str, GenerationProvider] = {}

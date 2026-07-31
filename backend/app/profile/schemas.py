from pydantic import BaseModel


class AnthropicKeyStatus(BaseModel):
    hasKey: bool
    maskedKey: str | None


class SetAnthropicKeyRequest(BaseModel):
    apiKey: str

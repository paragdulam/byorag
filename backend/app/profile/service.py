import base64
import hashlib
from datetime import datetime, timezone

import anthropic
from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import UserAnthropicKey
from app.profile.schemas import AnthropicKeyStatus

MASK_VISIBLE_CHARS = 4


class EmptyKeyError(ValueError):
    pass


class InvalidKeyError(ValueError):
    pass


class KeyValidationUnavailableError(RuntimeError):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _cipher() -> Fernet:
    """Derives a valid 32-byte `Fernet` key from `settings.key_encryption_secret` (any
    string) by hashing it — research.md §1, so operators don't have to hand-generate a
    correctly-shaped Fernet key themselves."""
    digest = hashlib.sha256(settings.key_encryption_secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(plaintext: str) -> str:
    return _cipher().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt(ciphertext: str) -> str:
    return _cipher().decrypt(ciphertext.encode("utf-8")).decode("utf-8")


def _masked(last_four: str) -> str:
    return f"...{last_four}"


def validate_key(api_key: str) -> None:
    """Live-validates `api_key` against Anthropic via the cheapest authenticated call the
    SDK exposes — `models.list`, which spends no generation tokens (research.md §2).
    Raises `InvalidKeyError` when Anthropic rejects the key outright, or
    `KeyValidationUnavailableError` when Anthropic couldn't be reached at all — the two
    get different messages (Edge Cases: a bad key vs. a transient outage)."""
    client = anthropic.Anthropic(api_key=api_key)
    try:
        client.models.list(limit=1)
    except anthropic.AuthenticationError as exc:
        raise InvalidKeyError("Anthropic rejected this API key") from exc
    except anthropic.APIConnectionError as exc:
        raise KeyValidationUnavailableError(
            "Couldn't verify the key with Anthropic right now"
        ) from exc


def _get_key_row(db: Session, user_id: str) -> UserAnthropicKey | None:
    return db.execute(
        select(UserAnthropicKey).where(UserAnthropicKey.user_id == user_id)
    ).scalar_one_or_none()


def get_status(db: Session, user_id: str) -> AnthropicKeyStatus:
    row = _get_key_row(db, user_id)
    if row is None:
        return AnthropicKeyStatus(hasKey=False, maskedKey=None)
    return AnthropicKeyStatus(hasKey=True, maskedKey=_masked(row.last_four))


def upsert_key(db: Session, user_id: str, api_key: str) -> AnthropicKeyStatus:
    """Validates `api_key` live, then adds or replaces (never duplicates — `user_id` is
    unique) the caller's `UserAnthropicKey` row. Raises before touching any row on
    failure, so a prior key (if any) is left exactly as it was (FR-008)."""
    if not api_key.strip():
        raise EmptyKeyError("An API key is required")

    validate_key(api_key)

    row = _get_key_row(db, user_id)
    encrypted = encrypt(api_key)
    last_four = api_key[-MASK_VISIBLE_CHARS:]
    if row is None:
        row = UserAnthropicKey(user_id=user_id, encrypted_key=encrypted, last_four=last_four)
        db.add(row)
    else:
        row.encrypted_key = encrypted
        row.last_four = last_four
        row.updated_at = _utcnow()
    db.commit()

    return AnthropicKeyStatus(hasKey=True, maskedKey=_masked(last_four))


def delete_key(db: Session, user_id: str) -> None:
    row = _get_key_row(db, user_id)
    if row is not None:
        db.delete(row)
        db.commit()


def resolve_decrypted_key(db: Session, user_id: str) -> str | None:
    """The acting user's own Anthropic key, decrypted — for Generation (playground/service.py)
    and quality scoring (evaluation/service.py) to use at call time. `None` means the user
    has no key on file; callers must not fall back to any shared/other key (FR-013, FR-017)."""
    row = _get_key_row(db, user_id)
    if row is None:
        return None
    return decrypt(row.encrypted_key)

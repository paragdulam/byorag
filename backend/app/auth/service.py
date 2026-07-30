import uuid
from datetime import datetime, timezone

import bcrypt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Corpus, Document, User
from app.db.models import Session as SessionRow


class EmailAlreadyRegisteredError(Exception):
    def __init__(self, email: str) -> None:
        self.email = email
        super().__init__(f"An account with email '{email}' already exists")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def _backfill_ownerless_data(db: Session, user_id: str) -> None:
    """Assigns every corpus/document that predates this feature (`user_id IS NULL`) to
    the very first account ever created (024-user-authentication research.md §3,
    FR-013). A no-op for every signup after the first, since nothing is left unowned by
    then."""
    db.execute(Corpus.__table__.update().where(Corpus.user_id.is_(None)).values(user_id=user_id))
    db.execute(
        Document.__table__.update().where(Document.user_id.is_(None)).values(user_id=user_id)
    )


def create_user(db: Session, email: str, password: str) -> User:
    normalized_email = _normalize_email(email)
    existing = db.execute(
        select(User).where(User.email == normalized_email)
    ).scalar_one_or_none()
    if existing is not None:
        raise EmailAlreadyRegisteredError(normalized_email)

    is_first_user_ever = db.execute(select(User.id).limit(1)).first() is None

    user = User(email=normalized_email, password_hash=hash_password(password))
    db.add(user)
    db.flush()

    if is_first_user_ever:
        _backfill_ownerless_data(db, user.id)

    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> User | None:
    normalized_email = _normalize_email(email)
    user = db.execute(
        select(User).where(User.email == normalized_email)
    ).scalar_one_or_none()
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def create_session(db: Session, user_id: str) -> str:
    token = uuid.uuid4().hex
    db.add(SessionRow(token=token, user_id=user_id))
    db.commit()
    return token


def resolve_session(db: Session, token: str) -> User | None:
    session_row = db.get(SessionRow, token)
    if session_row is None or session_row.revoked_at is not None:
        return None
    return db.get(User, session_row.user_id)


def revoke_session(db: Session, token: str) -> None:
    session_row = db.get(SessionRow, token)
    if session_row is None or session_row.revoked_at is not None:
        return  # already gone/revoked — idempotent
    session_row.revoked_at = _utcnow()
    db.commit()


def extract_bearer_token(authorization_header: str | None) -> str | None:
    """Parses an `Authorization: Bearer <token>` header value. Shared by the auth
    router's own /logout and /me (this module) and, later, the cross-cutting
    `require_user` dependency (024-user-authentication research.md §9) — one place for
    the header format so both agree on it."""
    if authorization_header is None:
        return None
    scheme, _, token = authorization_header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token

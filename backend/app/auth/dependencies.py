from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import service
from app.db.base import get_db
from app.db.models import User


def require_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Resolves the current user from a bearer token, carried either as an
    `Authorization: Bearer <token>` header or a `token` query parameter (the latter for the
    two `EventSource`-based streaming endpoints, which cannot send custom headers —
    research.md §5, §9). Raises `401` for a missing, invalid, or revoked token from either
    source."""
    token = service.extract_bearer_token(request.headers.get("authorization"))
    if token is None:
        token = request.query_params.get("token")

    user = service.resolve_session(db, token) if token is not None else None
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

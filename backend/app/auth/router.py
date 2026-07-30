from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.auth import service
from app.auth.schemas import AuthResponse, LoginRequest, SignupRequest, UserResponse
from app.db.base import get_db
from app.db.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _to_auth_response(user: User, token: str) -> AuthResponse:
    return AuthResponse(user=UserResponse(id=user.id, email=user.email), token=token)


@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(request: SignupRequest, db: Session = Depends(get_db)) -> AuthResponse:
    if not request.email.strip() or not request.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    try:
        user = service.create_user(db, request.email, request.password)
    except service.EmailAlreadyRegisteredError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    token = service.create_session(db, user.id)
    return _to_auth_response(user, token)


@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = service.authenticate(db, request.email, request.password)
    if user is None:
        # Deliberately generic — never reveals whether the email or the password was
        # the problem (FR-002).
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = service.create_session(db, user.id)
    return _to_auth_response(user, token)


@router.post("/logout", status_code=204)
def logout(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> None:
    token = service.extract_bearer_token(authorization)
    if token is not None:
        service.revoke_session(db, token)


@router.get("/me", response_model=UserResponse)
def me(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> UserResponse:
    token = service.extract_bearer_token(authorization)
    user = service.resolve_session(db, token) if token is not None else None
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return UserResponse(id=user.id, email=user.email)

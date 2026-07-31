from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import require_user
from app.db.base import get_db
from app.db.models import User
from app.profile import service
from app.profile.schemas import AnthropicKeyStatus, SetAnthropicKeyRequest

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("/anthropic-key", response_model=AnthropicKeyStatus)
def get_anthropic_key(
    db: Session = Depends(get_db), user: User = Depends(require_user)
) -> AnthropicKeyStatus:
    return service.get_status(db, user.id)


@router.put("/anthropic-key", response_model=AnthropicKeyStatus)
def set_anthropic_key(
    request: SetAnthropicKeyRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> AnthropicKeyStatus:
    try:
        return service.upsert_key(db, user.id, request.apiKey)
    except service.EmptyKeyError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except service.InvalidKeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except service.KeyValidationUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.delete("/anthropic-key", status_code=204)
def delete_anthropic_key(
    db: Session = Depends(get_db), user: User = Depends(require_user)
) -> None:
    service.delete_key(db, user.id)

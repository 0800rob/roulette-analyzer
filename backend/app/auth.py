"""Authentication helpers: password hashing, JWT issuing/verification, and
FastAPI dependencies that protect routes.

Notes for production:
  - JWT_SECRET MUST be set via environment variable. The default below is only
    used in dev so the app boots out of the box.
  - Tokens currently last 7 days. The frontend stores them in localStorage and
    sends them as `Authorization: Bearer <token>`.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session as DBSession

from .database import get_db
from .models import User

JWT_SECRET = os.getenv("ROULETTE_JWT_SECRET")
if not JWT_SECRET:
    # Dev-only fallback. In production you MUST set ROULETTE_JWT_SECRET to a
    # long random value (e.g. `openssl rand -hex 32`). If you forget, anyone
    # who knows this string can forge tokens.
    JWT_SECRET = "dev-secret-change-me-before-deploying-CHANGE-ME-IN-PROD"
    import warnings
    warnings.warn(
        "ROULETTE_JWT_SECRET not set — using insecure dev default. "
        "Set this env var to a strong random value before deploying.",
        RuntimeWarning,
    )
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_DAYS = 7

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# ---------------------------------------------------------------------------
# Password helpers (using bcrypt directly — passlib 1.7 is incompatible with
# bcrypt 5.x at the time of writing).
# ---------------------------------------------------------------------------

# bcrypt only handles up to 72 bytes; longer passwords are silently truncated.
# That's standard and matches what every bcrypt library does.
_BCRYPT_MAX_BYTES = 72


def _normalise(plain: str) -> bytes:
    data = plain.encode("utf-8")
    if len(data) > _BCRYPT_MAX_BYTES:
        data = data[:_BCRYPT_MAX_BYTES]
    return data


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_normalise(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_normalise(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRES_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            return None
        return int(sub)
    except (JWTError, ValueError):
        return None


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

class LicenseExpiredError(HTTPException):
    """Specific error code so the frontend can route to the renew page."""

    def __init__(self, expires_at: Optional[datetime]):
        super().__init__(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "license_expired",
                "expires_at": expires_at.isoformat() if expires_at else None,
                "message": "Sua licença expirou.",
            },
        )


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: DBSession = Depends(get_db),
) -> User:
    """Resolve the authenticated user. Raises 401 if missing/invalid."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = decode_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado ou desativado",
        )
    return user


def require_license(user: User = Depends(get_current_user)) -> User:
    """Allows admins regardless of `expires_at`; otherwise checks license."""
    if user.is_admin:
        return user
    if user.expires_at is None or user.expires_at < datetime.utcnow():
        raise LicenseExpiredError(user.expires_at)
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    return user

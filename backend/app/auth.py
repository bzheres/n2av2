from __future__ import annotations

import base64
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import HTTPException, Request, Response

from .config import settings

# -------------------------------------------------------------------
# Password hashing (bcrypt-safe with >72 byte protection)
# -------------------------------------------------------------------

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)

def _prehash_if_needed(password: str) -> str:
    """
    bcrypt hard-limit is 72 bytes.
    If password is longer, pre-hash with SHA-256 first.
    This is a standard, safe approach.
    """
    b = password.encode("utf-8")
    if len(b) <= 72:
        return password

    digest = hashlib.sha256(b).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8")

def hash_password(password: str) -> str:
    return pwd_context.hash(_prehash_if_needed(password))

def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(_prehash_if_needed(password), hashed)

# -------------------------------------------------------------------
# JWT helpers
# -------------------------------------------------------------------

JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 14

def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=JWT_ALGORITHM)

# -------------------------------------------------------------------
# Cookie helpers
# -------------------------------------------------------------------

def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN or None,
        path="/",
        max_age=60 * 60 * 24 * TOKEN_EXPIRE_DAYS,
    )

def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        domain=settings.COOKIE_DOMAIN or None,
        path="/",
    )

# -------------------------------------------------------------------
# Request helpers
# -------------------------------------------------------------------

def get_user_id_from_request(request: Request) -> Optional[int]:
    token = request.cookies.get(settings.COOKIE_NAME)
    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[JWT_ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            return None
        return int(sub)
    except (JWTError, ValueError):
        return None

def require_user_id(request: Request) -> int:
    uid = get_user_id_from_request(request)
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid

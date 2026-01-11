from __future__ import annotations
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import resend
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import User, PasswordReset
from ..auth import hash_password, verify_password, create_access_token, set_auth_cookie, clear_auth_cookie, get_user_id_from_request

router = APIRouter(prefix="/auth", tags=["auth"])

class SignupPayload(BaseModel):
    username: str
    email: EmailStr
    password: str

class LoginPayload(BaseModel):
    email: EmailStr
    password: str

class ResetRequestPayload(BaseModel):
    email: EmailStr

class ResetConfirmPayload(BaseModel):
    token: str
    new_password: str

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

@router.post("/signup")
def signup(payload: SignupPayload, response: Response, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    username = (payload.username or "User").strip() or "User"

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(email=email, username=username, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    return {"ok": True}

@router.post("/login")
def login(payload: LoginPayload, response: Response, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    return {"ok": True}

@router.post("/logout")
def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}

@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)):
    uid = get_user_id_from_request(request)
    if not uid:
        return {"user": None}
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        return {"user": None}
    return {"user": {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "plan": user.plan,
        "usage_month": user.usage_month,
        "usage_count": user.usage_count,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }}

@router.post("/request-password-reset")
def request_password_reset(payload: ResetRequestPayload, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"ok": True}

    token = secrets.token_urlsafe(32)
    token_hash = _hash_token(token)
    expires = datetime.now(timezone.utc) + timedelta(minutes=30)

    rec = PasswordReset(user_id=user.id, token_hash=token_hash, expires_at=expires, used=False)
    db.add(rec)
    db.commit()

    if settings.RESEND_API_KEY:
        resend.api_key = settings.RESEND_API_KEY
        reset_link = f"{settings.APP_BASE_URL}/account/reset?token={token}"
        try:
            resend.Emails.send({
                "from": settings.RESEND_FROM_EMAIL,
                "to": [user.email],
                "subject": "N2A Password Reset",
                "html": f"<p>Reset your password (valid 30 min):</p><p><a href='{reset_link}'>{reset_link}</a></p>",
            })
        except Exception:
            pass

    return {"ok": True}

@router.post("/reset-password")
def reset_password(payload: ResetConfirmPayload, response: Response, db: Session = Depends(get_db)):
    token_hash = _hash_token(payload.token)
    rec = db.query(PasswordReset).filter(PasswordReset.token_hash == token_hash).order_by(PasswordReset.created_at.desc()).first()
    if not rec or rec.used:
        raise HTTPException(status_code=400, detail="Invalid token")
    if rec.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")

    user = db.query(User).filter(User.id == rec.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")

    user.password_hash = hash_password(payload.new_password)
    rec.used = True
    db.add_all([user, rec])
    db.commit()

    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    return {"ok": True}

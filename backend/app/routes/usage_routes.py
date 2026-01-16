from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, Card, Project
from ..auth import require_user_id
from ..services.entitlements import PLAN_LIMITS, ensure_month

router = APIRouter(prefix="/usage", tags=["usage"])


def _month_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


@router.get("/me")
def my_usage(request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Make sure usage_month aligns to current month (and resets count if needed)
    ensure_month(db, user)

    now = datetime.now(timezone.utc)
    month = _month_key(now)
    start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    # Cards: total + this month (by projects owned by user)
    cards_total = (
        db.query(Card)
        .join(Project, Project.id == Card.project_id)
        .filter(Project.owner_id == uid)
        .count()
    )

    cards_this_month = (
        db.query(Card)
        .join(Project, Project.id == Card.project_id)
        .filter(Project.owner_id == uid)
        .filter(Card.created_at >= start)
        .count()
    )

    # AI usage is stored on the user table
    used_ai = int(user.usage_count or 0)
    limit_ai = int(PLAN_LIMITS.get(user.plan or "free", 0))
    remaining_ai = max(limit_ai - used_ai, 0)

    return {
        "ok": True,
        "plan": user.plan,
        "usage": {
            "month": month,
            "cards_created_total": int(cards_total),
            "cards_created_this_month": int(cards_this_month),
            "ai_reviews_used_this_month": used_ai,
            "ai_reviews_limit_this_month": limit_ai,
            "ai_reviews_remaining_this_month": remaining_ai,
        },
    }

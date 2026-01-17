from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, Card, Project
from ..auth import require_user_id
from ..services.entitlements import PLAN_LIMITS

router = APIRouter(prefix="/usage", tags=["usage"])


def _fmt_ddmmyyyy(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%d/%m/%Y")


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _is_paid_plan(plan: Optional[str]) -> bool:
    p = (plan or "").strip().lower()
    return p not in ("", "free", "guest")


def _safe_get_attr(obj, name: str, default=None):
    try:
        return getattr(obj, name, default)
    except Exception:
        return default


def _get_stripe_period_end(sub_id: str) -> Optional[datetime]:
    """
    Returns Stripe subscription current_period_end as datetime(UTC) if possible.
    """
    if not sub_id:
        return None

    sk = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if not sk:
        return None

    stripe.api_key = sk
    sub = stripe.Subscription.retrieve(sub_id)
    cpe = sub.get("current_period_end")
    if not cpe:
        return None
    return datetime.fromtimestamp(int(cpe), tz=timezone.utc)


def ensure_billing_period_usage(db: Session, user: User) -> Optional[datetime]:
    """
    Ensures user's AI usage counter is aligned to current billing period.
    - Paid users: uses Stripe current_period_end
    - Free/guest: no-op (or keep as-is)
    Returns the resolved period_end datetime (or None).
    """
    now = datetime.now(timezone.utc)

    if not _is_paid_plan(user.plan):
        # Free users: leave counter alone; AI limit is usually 0 anyway.
        # You can optionally reset monthly if you ever offer free AI.
        return None

    sub_id = _safe_get_attr(user, "stripe_subscription_id", None)
    if not sub_id:
        # Paid but no subscription id stored -> can't align reliably
        return None

    try:
        stripe_end = _get_stripe_period_end(str(sub_id))
    except Exception:
        stripe_end = None

    if not stripe_end:
        return None

    # You need this column in your User model:
    # user.usage_period_end (DateTime, nullable)
    current_end: Optional[datetime] = _safe_get_attr(user, "usage_period_end", None)

    # If we have no stored end, store it
    if current_end is None:
        user.usage_period_end = stripe_end
        # Start fresh for the period
        user.usage_count = int(user.usage_count or 0)
        db.add(user)
        db.commit()
        return stripe_end

    # If the period has rolled over, reset usage
    if now >= current_end:
        user.usage_count = 0
        user.usage_period_end = stripe_end
        db.add(user)
        db.commit()
        return stripe_end

    # If Stripe's end differs from what we stored (plan change, proration, etc.)
    # update end but DO NOT reset unless we actually crossed the boundary
    if abs((stripe_end - current_end).total_seconds()) > 60:
        user.usage_period_end = stripe_end
        db.add(user)
        db.commit()

    return user.usage_period_end


@router.get("/me")
def my_usage(request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    now = datetime.now(timezone.utc)

    # ✅ NEW: align/reset AI usage to Stripe billing period
    period_end_dt = ensure_billing_period_usage(db, user)

    # Cards: total + this month (still calendar month; unrelated to AI allowance)
    start_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

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
        .filter(Card.created_at >= start_month)
        .count()
    )

    used_ai = int(user.usage_count or 0)
    limit_ai = int(PLAN_LIMITS.get(user.plan or "free", 0))
    remaining_ai = max(limit_ai - used_ai, 0)

    # Display: paid -> stripe period end; free -> today
    display_end = period_end_dt or now

    return {
        "ok": True,
        "plan": user.plan,
        "usage": {
            "period_end": _iso(display_end),
            "period_end_display": _fmt_ddmmyyyy(display_end),

            "cards_created_total": int(cards_total),
            "cards_created_this_month": int(cards_this_month),

            # ✅ Now “this month” really means “this billing period”
            "ai_reviews_used_this_period": used_ai,
            "ai_reviews_limit_this_period": limit_ai,
            "ai_reviews_remaining_this_period": remaining_ai,
        },
    }

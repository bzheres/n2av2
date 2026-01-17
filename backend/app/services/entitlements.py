from __future__ import annotations

from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from ..models import User

PLAN_LIMITS = {"free": 0, "silver": 2000, "gold": 6000, "platinum": 12000}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _is_paid(plan: str | None) -> bool:
    p = (plan or "").strip().lower()
    return p not in ("", "free", "guest")


def ensure_period(db: Session, user: User):
    """
    Ensure usage_count aligns to the user's *subscription billing period*.
    - For paid users: relies on usage_period_end set by Stripe webhook.
    - If the stored period has ended, reset usage_count and roll to next known period.
    """
    now = _utcnow()

    # If user isn't paid, we don't need a strict period; keep fields tidy for UI if desired.
    if not _is_paid(user.plan):
        # Optional: keep a rolling display window
        if user.usage_period_end is None:
            user.usage_period_start = now
            user.usage_period_end = now + timedelta(days=30)
            db.add(user)
            db.commit()
        return

    # Paid user must have webhook-fed period_end
    if user.usage_period_end is None:
        # We cannot infer without webhook data; don't reset counters.
        return

    # If we're past the end, reset for the new period.
    # Webhook should update usage_period_end when Stripe rolls over;
    # if webhook hasn't hit yet, we'll reset when we detect rollover and wait for webhook to set new end.
    if now >= user.usage_period_end:
        user.usage_count = 0
        # Start a new window from now until webhook updates (safe fallback)
        user.usage_period_start = now
        user.usage_period_end = now + timedelta(days=30)
        db.add(user)
        db.commit()


def can_use_ai(db: Session, user: User):
    ensure_period(db, user)
    limit = int(PLAN_LIMITS.get((user.plan or "free").lower(), 0))
    used = int(user.usage_count or 0)
    return (used < limit, used, limit)


def consume_ai(db: Session, user: User, amount: int = 1):
    ensure_period(db, user)
    user.usage_count = int(user.usage_count or 0) + int(amount)
    db.add(user)
    db.commit()

from __future__ import annotations
from datetime import datetime
from sqlalchemy.orm import Session
from ..models import User

PLAN_LIMITS = {"free": 0, "silver": 2000, "gold": 6000, "platinum": 12000}

def current_month_key() -> str:
    now = datetime.utcnow()
    return f"{now.year:04d}-{now.month:02d}"

def ensure_month(db: Session, user: User):
    mk = current_month_key()
    if user.usage_month != mk:
        user.usage_month = mk
        user.usage_count = 0
        db.add(user)
        db.commit()

def can_use_ai(db: Session, user: User):
    ensure_month(db, user)
    limit = PLAN_LIMITS.get(user.plan, 0)
    used = user.usage_count
    return (used < limit, used, limit)

def consume_ai(db: Session, user: User, amount: int = 1):
    ensure_month(db, user)
    user.usage_count += amount
    db.add(user)
    db.commit()

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import User
from ..auth import require_user_id
from ..services.stripe_service import create_checkout_session, create_customer_portal

router = APIRouter(prefix="/billing", tags=["billing"])


class CheckoutPayload(BaseModel):
    # New (preferred): send "silver" | "gold" | "platinum"
    plan: str | None = None
    # Backwards compatible: allow sending price_id (old frontend)
    price_id: str | None = None


def _plan_to_price_id(plan: str) -> str:
    p = plan.lower().strip()
    if p == "silver":
        return settings.STRIPE_PRICE_SILVER
    if p == "gold":
        return settings.STRIPE_PRICE_GOLD
    if p == "platinum":
        return settings.STRIPE_PRICE_PLATINUM
    raise HTTPException(status_code=400, detail="Invalid plan")


@router.post("/checkout")
def checkout(payload: CheckoutPayload, request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Decide which price_id to use
    if payload.plan:
        price_id = _plan_to_price_id(payload.plan)
        if not price_id:
            raise HTTPException(status_code=500, detail=f"Missing Stripe price id for plan '{payload.plan}'")
    elif payload.price_id:
        # Legacy path: still allow price_id if it matches configured prices
        valid = {settings.STRIPE_PRICE_SILVER, settings.STRIPE_PRICE_GOLD, settings.STRIPE_PRICE_PLATINUM}
        if payload.price_id not in valid:
            raise HTTPException(status_code=400, detail="Invalid price")
        price_id = payload.price_id
    else:
        raise HTTPException(status_code=400, detail="Missing 'plan' or 'price_id'")

    success = f"{settings.APP_BASE_URL}/account?billing=success"
    cancel = f"{settings.APP_BASE_URL}/account?billing=cancel"

    sess = create_checkout_session(user.email, price_id, success, cancel)
    return {"url": sess.url}


@router.post("/portal")
def portal(request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)
    user = db.query(User).filter(User.id == uid).first()
    if not user or not user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer")
    sess = create_customer_portal(user.stripe_customer_id, f"{settings.APP_BASE_URL}/account")
    return {"url": sess.url}

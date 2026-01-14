from __future__ import annotations

from typing import Literal

import stripe
from stripe.error import StripeError

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import User
from ..auth import require_user_id
from ..services.stripe_service import create_checkout_session, create_customer_portal

router = APIRouter(prefix="/billing", tags=["billing"])

PlanKey = Literal["silver", "gold", "platinum"]

PLAN_TO_PRICE: dict[str, str | None] = {
    "silver": settings.STRIPE_PRICE_SILVER,
    "gold": settings.STRIPE_PRICE_GOLD,
    "platinum": settings.STRIPE_PRICE_PLATINUM,
}

class CheckoutPayload(BaseModel):
    plan: PlanKey

@router.post("/checkout")
def checkout(payload: CheckoutPayload, request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    price_id = PLAN_TO_PRICE.get(payload.plan)
    if not price_id:
        raise HTTPException(status_code=500, detail=f"Stripe price id not configured for {payload.plan}")

    success = f"{settings.APP_BASE_URL}/account?billing=success"
    cancel = f"{settings.APP_BASE_URL}/account?billing=cancel"

    try:
        sess = create_checkout_session(user.email, price_id, success, cancel)
        if not getattr(sess, "url", None):
            raise HTTPException(status_code=500, detail="Stripe session created without a redirect URL")
        return {"url": sess.url}
    except StripeError as e:
        # Shows a useful message in frontend instead of a 500
        msg = getattr(e, "user_message", None) or str(e)
        raise HTTPException(status_code=400, detail=f"Stripe error: {msg}")
    except Exception:
        # fallback (keeps server from leaking stack traces)
        raise HTTPException(status_code=500, detail="Billing checkout failed")

@router.post("/portal")
def portal(request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)
    user = db.query(User).filter(User.id == uid).first()
    if not user or not user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer")

    try:
        sess = create_customer_portal(user.stripe_customer_id, f"{settings.APP_BASE_URL}/account")
        if not getattr(sess, "url", None):
            raise HTTPException(status_code=500, detail="Stripe portal session created without a redirect URL")
        return {"url": sess.url}
    except StripeError as e:
        msg = getattr(e, "user_message", None) or str(e)
        raise HTTPException(status_code=400, detail=f"Stripe error: {msg}")
    except Exception:
        raise HTTPException(status_code=500, detail="Billing portal failed")

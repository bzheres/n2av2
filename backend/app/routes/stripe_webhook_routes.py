from __future__ import annotations

from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import User
from ..services.stripe_service import plan_from_subscription, PRICE_TO_PLAN

router = APIRouter(prefix="/stripe", tags=["stripe"])
stripe.api_key = settings.STRIPE_SECRET_KEY


def _dt_from_ts(ts: int | None):
    if not ts:
        return None
    return datetime.fromtimestamp(int(ts), tz=timezone.utc)


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    sig = request.headers.get("stripe-signature")
    if not sig:
        raise HTTPException(status_code=400, detail="Missing stripe-signature")
    payload = await request.body()

    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=400, detail="Webhook not configured")

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")

    etype = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}

    # --- 1) Checkout completed: link stripe_customer_id + set plan (best-effort) ---
    if etype == "checkout.session.completed":
        customer_id = obj.get("customer")
        email = (obj.get("customer_details") or {}).get("email") or obj.get("customer_email")

        user = None
        if email:
            user = db.query(User).filter(User.email == email.lower()).first()

        if user and customer_id:
            user.stripe_customer_id = customer_id

            # Optional: set plan immediately by inspecting the checkout session line item price
            try:
                sess = stripe.checkout.Session.retrieve(obj.get("id"), expand=["line_items.data.price"])
                items = (sess.get("line_items") or {}).get("data") or []
                price_id = None
                if items:
                    price_id = ((items[0].get("price") or {}).get("id"))
                plan = PRICE_TO_PLAN.get(price_id, "free")
                user.plan = plan
            except Exception:
                pass

            db.add(user)
            db.commit()

    # --- 2) Subscription lifecycle: authoritative for billing period + entitlements ---
    if etype in (
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        customer_id = obj.get("customer")
        sub_id = obj.get("id")
        status = (obj.get("status") or "").lower()

        user = db.query(User).filter(User.stripe_customer_id == customer_id).first() if customer_id else None
        if user:
            if etype == "customer.subscription.deleted" or status not in ("active", "trialing"):
                # Revert
                user.plan = "free"
                user.stripe_subscription_id = None
                user.stripe_current_period_start = None
                user.stripe_current_period_end = None
                user.usage_period_start = None
                user.usage_period_end = None
                user.usage_count = 0
                db.add(user)
                db.commit()
                return {"ok": True}

            # Active/trialing subscription: set plan + save billing period
            plan = plan_from_subscription(obj)
            cps = _dt_from_ts(obj.get("current_period_start"))
            cpe = _dt_from_ts(obj.get("current_period_end"))

            # Detect cycle change: if period_end changed meaningfully, reset usage_count
            prev_end = user.usage_period_end
            cycle_changed = False
            if cpe and prev_end:
                cycle_changed = abs((cpe - prev_end).total_seconds()) > 60
            elif cpe and not prev_end:
                cycle_changed = True

            user.plan = plan
            user.stripe_subscription_id = sub_id
            user.stripe_current_period_start = cps
            user.stripe_current_period_end = cpe

            # Align usage period to Stripe cycle
            user.usage_period_start = cps
            user.usage_period_end = cpe

            if cycle_changed:
                # ✅ Reset for the new billing period
                user.usage_count = 0

            db.add(user)
            db.commit()

    return {"ok": True}

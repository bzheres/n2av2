from __future__ import annotations

import stripe
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import User
from ..services.stripe_service import PRICE_TO_PLAN

router = APIRouter(prefix="/stripe", tags=["stripe"])
stripe.api_key = settings.STRIPE_SECRET_KEY


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    sig = request.headers.get("stripe-signature")
    payload = await request.body()

    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=400, detail="Webhook not configured")

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")

    etype = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}

    # --- 1) Checkout completed: link customer + set plan immediately ---
    if etype == "checkout.session.completed":
        customer_id = obj.get("customer")
        email = (obj.get("customer_details") or {}).get("email") or obj.get("customer_email")

        user = None
        if email:
            user = db.query(User).filter(User.email == email.lower()).first()

        if user and customer_id:
            user.stripe_customer_id = customer_id

            # Retrieve session with line items to detect price_id and plan
            try:
                sess = stripe.checkout.Session.retrieve(
                    obj.get("id"),
                    expand=["line_items.data.price"],
                )
                items = (sess.get("line_items") or {}).get("data") or []
                price_id = None
                if items:
                    price_id = ((items[0].get("price") or {}).get("id"))  # price_xxx
                plan = PRICE_TO_PLAN.get(price_id, "free")
                user.plan = plan
            except Exception:
                # Even if this fails, customer linking still helps subscription events later
                pass

            db.add(user)
            db.commit()

    # --- 2) Subscription lifecycle: keep in sync (authoritative) ---
    if etype in (
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        customer_id = obj.get("customer")
        items = (obj.get("items") or {}).get("data") or []
        price_id = None
        if items:
            price_id = (items[0].get("price") or {}).get("id")

        plan = PRICE_TO_PLAN.get(price_id, "free")
        status = obj.get("status")

        user = db.query(User).filter(User.stripe_customer_id == customer_id).first() if customer_id else None
        if user:
            user.plan = plan if status in ("active", "trialing") else "free"
            db.add(user)
            db.commit()

    return {"ok": True}

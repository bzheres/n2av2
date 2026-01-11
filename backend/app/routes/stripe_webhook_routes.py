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

    etype = event["type"]
    obj = event["data"]["object"]

    if etype == "checkout.session.completed":
        customer_id = obj.get("customer")
        email = (obj.get("customer_details") or {}).get("email") or obj.get("customer_email")
        if email and customer_id:
            user = db.query(User).filter(User.email == email.lower()).first()
            if user:
                user.stripe_customer_id = customer_id
                db.add(user); db.commit()

    if etype in ("customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"):
        customer_id = obj.get("customer")
        items = (obj.get("items") or {}).get("data") or []
        price_id = None
        if items:
            price_id = (items[0].get("price") or {}).get("id")
        plan = PRICE_TO_PLAN.get(price_id, "free")
        status = obj.get("status")

        user = db.query(User).filter(User.stripe_customer_id == customer_id).first() if customer_id else None
        if user:
            user.plan = plan if status in ("active","trialing") else "free"
            db.add(user); db.commit()

    return {"ok": True}

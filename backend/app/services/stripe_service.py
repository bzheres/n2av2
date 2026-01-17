from __future__ import annotations

import stripe
from stripe.error import StripeError
from ..config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

PRICE_TO_PLAN = {
    settings.STRIPE_PRICE_SILVER: "silver",
    settings.STRIPE_PRICE_GOLD: "gold",
    settings.STRIPE_PRICE_PLATINUM: "platinum",
}


def plan_from_subscription(sub: dict) -> str:
    """
    Determine N2A plan from a Stripe Subscription object.
    We look at subscription.items.data[0].price.id and map it.
    """
    items = (sub.get("items") or {}).get("data") or []
    if not items:
        return "free"
    price_id = ((items[0].get("price") or {}).get("id")) or ""
    return PRICE_TO_PLAN.get(price_id, "free")


def create_checkout_session(customer_email: str, price_id: str, success_url: str, cancel_url: str):
    """
    Creates a Stripe Checkout Session for subscriptions.
    Raises StripeError if Stripe rejects the request (invalid key/price/etc.).
    """
    return stripe.checkout.Session.create(
        mode="subscription",
        customer_email=customer_email,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        allow_promotion_codes=True,
    )


def create_customer_portal(customer_id: str, return_url: str):
    return stripe.billing_portal.Session.create(customer=customer_id, return_url=return_url)

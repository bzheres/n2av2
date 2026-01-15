from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Card, Project
from ..auth import require_user_id

router = APIRouter(prefix="/cards", tags=["cards"])


class CardIn(BaseModel):
    card_type: str = "qa"
    front: str = ""
    back: str = ""
    raw: str | None = None


class CreateCardsPayload(BaseModel):
    project_id: int
    cards: list[CardIn]


class UpdateCardPayload(BaseModel):
    front: str
    back: str


@router.get("/{project_id}")
def list_cards(project_id: int, request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)

    proj = db.query(Project).filter(Project.id == project_id, Project.owner_id == uid).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    cards = db.query(Card).filter(Card.project_id == project_id).order_by(Card.id.asc()).all()

    return {
        "cards": [
            {
                "id": c.id,
                "project_id": c.project_id,
                "card_type": c.card_type,
                "front": c.front,
                "back": c.back,
                "raw": c.raw,
                "ai_changed": c.ai_changed,
                "ai_flag": c.ai_flag,
                "ai_feedback": c.ai_feedback,
                "ai_suggest_front": c.ai_suggest_front,
                "ai_suggest_back": c.ai_suggest_back,
            }
            for c in cards
        ]
    }


@router.post("")
def create_cards(payload: CreateCardsPayload, request: Request, db: Session = Depends(get_db)):
    """
    Option A: Replace all cards for this project with the provided list.
    IMPORTANT: Returns created cards with IDs so the frontend can call /ai/review.
    """
    uid = require_user_id(request)

    proj = db.query(Project).filter(Project.id == payload.project_id, Project.owner_id == uid).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    # Replace existing cards
    db.query(Card).filter(Card.project_id == payload.project_id).delete()

    created: list[Card] = []
    for x in payload.cards:
        ct = (x.card_type or "qa").lower().strip()
        if ct not in ("qa", "mcq"):
            ct = "qa"

        c = Card(
            project_id=payload.project_id,
            card_type=ct,
            front=x.front or "",
            back=x.back or "",
            raw=x.raw,
        )
        db.add(c)
        created.append(c)

    db.commit()

    # refresh for IDs
    for c in created:
        db.refresh(c)

    return {
        "cards": [
            {
                "id": c.id,
                "project_id": c.project_id,
                "card_type": c.card_type,
                "front": c.front,
                "back": c.back,
                "raw": c.raw,
            }
            for c in created
        ]
    }


@router.patch("/{card_id}")
def update_card(card_id: int, payload: UpdateCardPayload, request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)

    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Not found")

    proj = db.query(Project).filter(Project.id == card.project_id, Project.owner_id == uid).first()
    if not proj:
        raise HTTPException(status_code=403, detail="Forbidden")

    card.front = payload.front
    card.back = payload.back

    # Clear AI fields on manual edit (prevents stale suggestion badges)
    card.ai_changed = False
    card.ai_flag = None
    card.ai_feedback = None
    card.ai_suggest_front = None
    card.ai_suggest_back = None

    db.add(card)
    db.commit()
    db.refresh(card)

    return {
        "card": {
            "id": card.id,
            "project_id": card.project_id,
            "card_type": card.card_type,
            "front": card.front,
            "back": card.back,
        }
    }


@router.delete("/{card_id}")
def delete_card(card_id: int, request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)

    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        return {"ok": True}

    proj = db.query(Project).filter(Project.id == card.project_id, Project.owner_id == uid).first()
    if not proj:
        raise HTTPException(status_code=403, detail="Forbidden")

    db.delete(card)
    db.commit()
    return {"ok": True}

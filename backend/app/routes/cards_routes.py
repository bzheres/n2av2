from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Card, Project
from ..auth import require_user_id

router = APIRouter(prefix="/cards", tags=["cards"])

class CreateCardsPayload(BaseModel):
    project_id: int
    cards: list[dict]

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
    return {"cards": [{
        "id": c.id, "card_type": c.card_type, "front": c.front, "back": c.back,
        "ai_changed": c.ai_changed, "ai_flag": c.ai_flag, "ai_feedback": c.ai_feedback,
        "ai_suggest_front": c.ai_suggest_front, "ai_suggest_back": c.ai_suggest_back,
    } for c in cards]}

@router.post("")
def create_cards(payload: CreateCardsPayload, request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)
    proj = db.query(Project).filter(Project.id == payload.project_id, Project.owner_id == uid).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    db.query(Card).filter(Card.project_id == payload.project_id).delete()
    for x in payload.cards:
        db.add(Card(project_id=payload.project_id, card_type=x.get("card_type","qa"), front=x.get("front",""), back=x.get("back",""), raw=x.get("raw")))
    db.commit()
    return {"ok": True}

@router.patch("/{card_id}")
def update_card(card_id: int, payload: UpdateCardPayload, request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Not found")
    proj = db.query(Project).filter(Project.id == card.project_id, Project.owner_id == uid).first()
    if not proj:
        raise HTTPException(status_code=403, detail="Forbidden")

    card.front = payload.front; card.back = payload.back
    db.add(card); db.commit()
    return {"ok": True}

@router.delete("/{card_id}")
def delete_card(card_id: int, request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        return {"ok": True}
    proj = db.query(Project).filter(Project.id == card.project_id, Project.owner_id == uid).first()
    if not proj:
        raise HTTPException(status_code=403, detail="Forbidden")
    db.delete(card); db.commit()
    return {"ok": True}

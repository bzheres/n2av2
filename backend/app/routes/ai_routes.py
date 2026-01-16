from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, Card, Project
from ..auth import require_user_id
from ..services.entitlements import can_use_ai, consume_ai
from ..services.ai_review import review_card

router = APIRouter(prefix="/ai", tags=["ai"])

AIMode = Literal["content", "format", "both"]


class ReviewPayload(BaseModel):
  project_id: int
  card_id: int
  variant: str = "en-AU"
  apply: bool = False
  mode: AIMode = "content"


def _is_incorrect_flag(flag: str | None) -> bool:
  f = (flag or "").strip().lower()
  return f == "incorrect" or f == "wrong" or "incorrect" in f


@router.post("/review")
async def review(payload: ReviewPayload, request: Request, db: Session = Depends(get_db)):
  uid = require_user_id(request)
  user = db.query(User).filter(User.id == uid).first()
  if not user:
    raise HTTPException(status_code=401, detail="Not authenticated")

  ok, used, limit = can_use_ai(db, user)
  if not ok:
    raise HTTPException(status_code=402, detail=f"AI limit reached ({used}/{limit})")

  card = db.query(Card).filter(Card.id == payload.card_id).first()
  if not card:
    raise HTTPException(status_code=404, detail="Card not found")

  proj = db.query(Project).filter(Project.id == payload.project_id, Project.owner_id == uid).first()
  if not proj or card.project_id != proj.id:
    raise HTTPException(status_code=403, detail="Forbidden")

  result = await review_card(card.front, card.back, payload.variant, payload.mode)

  flag = result.get("flag")
  incorrect = _is_incorrect_flag(flag)

  # Store AI results so UI can show "reviewed" / warnings
  card.ai_changed = bool(result.get("changed", False))
  card.ai_flag = flag
  card.ai_feedback = result.get("feedback")

  if incorrect:
    # Critical trust rule: do NOT store hallucinated "replacements" when incorrect.
    card.ai_suggest_front = None
    card.ai_suggest_back = None
    # Also never apply.
  else:
    card.ai_suggest_front = result.get("front")
    card.ai_suggest_back = result.get("back")

    if payload.apply and result.get("changed"):
      card.front = result.get("front")
      card.back = result.get("back")

  db.add(card)
  db.commit()

  consume_ai(db, user, 1)

  return {"ok": True, "result": result, "usage": {"used": user.usage_count, "limit": limit}}

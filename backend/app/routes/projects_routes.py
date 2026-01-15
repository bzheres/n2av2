from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Project, Card
from ..auth import require_user_id

router = APIRouter(prefix="/projects", tags=["projects"])


class CreateProject(BaseModel):
    name: str


@router.post("")
def create_project(payload: CreateProject, request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)

    name = (payload.name or "").strip()
    if not name:
        name = "Untitled"

    p = Project(owner_id=uid, name=name)
    db.add(p)
    db.commit()
    db.refresh(p)

    return {
        "project": {
            "id": p.id,
            "name": p.name,
            "created_at": p.created_at.isoformat() if getattr(p, "created_at", None) else None,
        }
    }


@router.get("")
def list_projects(request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)
    q = db.query(Project).filter(Project.owner_id == uid)

    # Prefer created_at if present, else fall back to id
    if hasattr(Project, "created_at"):
        q = q.order_by(Project.created_at.desc())
    else:
        q = q.order_by(Project.id.desc())

    projects = q.all()

    return {
        "projects": [
            {
                "id": p.id,
                "name": p.name,
                "created_at": p.created_at.isoformat() if getattr(p, "created_at", None) else None,
            }
            for p in projects
        ]
    }


@router.get("/latest")
def get_latest_project(request: Request, db: Session = Depends(get_db)):
    """
    Returns the most recent project for the current user.
    Used by frontend to resume after refresh.
    """
    uid = require_user_id(request)

    q = db.query(Project).filter(Project.owner_id == uid)
    if hasattr(Project, "created_at"):
        q = q.order_by(Project.created_at.desc())
    else:
        q = q.order_by(Project.id.desc())

    p = q.first()

    return {
        "project": (
            {
                "id": p.id,
                "name": p.name,
                "created_at": p.created_at.isoformat() if getattr(p, "created_at", None) else None,
            }
            if p
            else None
        )
    }


@router.get("/{project_id}/cards")
def get_project_cards(project_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Returns all cards for a project (must belong to current user).
    Used by frontend to resume cards after refresh.
    """
    uid = require_user_id(request)

    p = db.query(Project).filter(Project.id == project_id, Project.owner_id == uid).first()
    if not p:
        # Keep response shape consistent but indicate not found
        # (frontend will silently ignore if it can't resume)
        return {"cards": []}

    cards = db.query(Card).filter(Card.project_id == project_id).order_by(Card.id.asc()).all()

    def ser(c: Card):
        # Use getattr so this won't crash if AI fields aren't present on your model yet.
        return {
            "id": c.id,
            "project_id": c.project_id,
            "card_type": c.card_type,
            "front": c.front,
            "back": c.back,
            "raw": getattr(c, "raw", None),
            "ai_changed": getattr(c, "ai_changed", None),
            "ai_flag": getattr(c, "ai_flag", None),
            "ai_feedback": getattr(c, "ai_feedback", None),
            "ai_suggest_front": getattr(c, "ai_suggest_front", None),
            "ai_suggest_back": getattr(c, "ai_suggest_back", None),
        }

    return {"cards": [ser(c) for c in cards]}

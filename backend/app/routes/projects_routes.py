from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Project
from ..auth import require_user_id

router = APIRouter(prefix="/projects", tags=["projects"])

class CreateProject(BaseModel):
    name: str

@router.post("")
def create_project(payload: CreateProject, request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)
    p = Project(owner_id=uid, name=payload.name.strip() or "Untitled")
    db.add(p); db.commit(); db.refresh(p)
    return {"project": {"id": p.id, "name": p.name, "created_at": p.created_at.isoformat() if p.created_at else None}}

@router.get("")
def list_projects(request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)
    projects = db.query(Project).filter(Project.owner_id == uid).order_by(Project.created_at.desc()).all()
    return {"projects": [{"id": p.id, "name": p.name, "created_at": p.created_at.isoformat() if p.created_at else None} for p in projects]}

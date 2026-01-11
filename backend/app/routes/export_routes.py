from __future__ import annotations
import csv, io
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Card, Project
from ..auth import require_user_id

router = APIRouter(prefix="/export", tags=["export"])

@router.get("/csv/{project_id}")
def export_csv(project_id: int, request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)
    proj = db.query(Project).filter(Project.id == project_id, Project.owner_id == uid).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    cards = db.query(Card).filter(Card.project_id == project_id).order_by(Card.id.asc()).all()
    buf = io.StringIO()
    w = csv.writer(buf); w.writerow(["Front","Back"])
    for c in cards:
        w.writerow([c.front, c.back])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="n2a_project_{project_id}.csv"'})

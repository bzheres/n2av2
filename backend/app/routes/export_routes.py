from __future__ import annotations

import csv
import io
import html
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.background import BackgroundTasks
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Card, Project, User
from ..auth import require_user_id
from ..services.apkg_export import build_apkg

router = APIRouter(prefix="/export", tags=["export"])


def _field_to_html(field: str) -> str:
    """
    Make content safe for Anki TSV import (HTML allowed):
    - replace tabs so fields don't shift
    - escape HTML
    - convert newlines to <br>
    """
    s = "" if field is None else str(field)
    s = s.replace("\t", "    ")
    s = html.escape(s, quote=True)
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = s.replace("\n", "<br>")
    return s


@router.get("/csv/{project_id}")
def export_csv(project_id: int, request: Request, db: Session = Depends(get_db)):
    uid = require_user_id(request)
    proj = db.query(Project).filter(Project.id == project_id, Project.owner_id == uid).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    cards = db.query(Card).filter(Card.project_id == project_id).order_by(Card.id.asc()).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Front", "Back"])
    for c in cards:
        w.writerow([c.front, c.back])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="n2a_project_{project_id}.csv"'},
    )


@router.get("/tsv/{project_id}")
def export_tsv(project_id: int, request: Request, db: Session = Depends(get_db)):
    """
    TSV intended for Anki import with HTML enabled.
    No header row (prevents importing an extra card).
    """
    uid = require_user_id(request)
    proj = db.query(Project).filter(Project.id == project_id, Project.owner_id == uid).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    cards = db.query(Card).filter(Card.project_id == project_id).order_by(Card.id.asc()).all()

    lines = []
    for c in cards:
        front = _field_to_html(c.front)
        back = _field_to_html(c.back)
        lines.append(f"{front}\t{back}")

    data = "\n".join(lines)
    return StreamingResponse(
        iter([data]),
        media_type="text/tab-separated-values",
        headers={"Content-Disposition": f'attachment; filename="n2a_project_{project_id}.tsv"'},
    )


@router.get("/apkg/{project_id}")
def export_apkg(
    project_id: int,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Paid-only APKG export (Anki deck package).
    """
    uid = require_user_id(request)

    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Paid gate (adjust if you later add a specific 'apkg' entitlement)
    if (user.plan or "free").lower() == "free":
        raise HTTPException(status_code=403, detail="APKG export is available on paid plans.")

    proj = db.query(Project).filter(Project.id == project_id, Project.owner_id == uid).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    cards = db.query(Card).filter(Card.project_id == project_id).order_by(Card.id.asc()).all()
    if not cards:
        raise HTTPException(status_code=400, detail="No cards to export")

    apkg_path, filename = build_apkg(
        deck_name=proj.name or f"N2A Project {project_id}",
        cards=cards,
        identity_key=f"uid:{uid}|pid:{project_id}",
    )

    # delete temp file after response is sent
    background.add_task(lambda p: os.path.exists(p) and os.remove(p), apkg_path)

    def file_iter():
        with open(apkg_path, "rb") as f:
            while True:
                chunk = f.read(1024 * 1024)
                if not chunk:
                    break
                yield chunk

    return StreamingResponse(
        file_iter(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

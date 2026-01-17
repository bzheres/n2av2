from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import engine, Base, ensure_schema

from .routes.auth_routes import router as auth_router
from .routes.projects_routes import router as projects_router
from .routes.cards_routes import router as cards_router
from .routes.export_routes import router as export_router
from .routes.ai_routes import router as ai_router
from .routes.billing_routes import router as billing_router
from .routes.stripe_webhook_routes import router as stripe_router
from .routes.usage_routes import router as usage_router

Base.metadata.create_all(bind=engine)
ensure_schema()  # ✅ add missing columns safely

app = FastAPI(title="N2A API", version="2.0")


def _cors_origins() -> list[str]:
    origins: list[str] = []

    if settings.FRONTEND_URL:
        origins.append(settings.FRONTEND_URL.strip())

    origins += [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ]

    origins += [
        "https://n2a.com.au",
        "https://www.n2a.com.au",
    ]

    extra = (settings.CORS_EXTRA_ORIGINS or "").strip()
    if extra:
        origins.extend([o.strip() for o in extra.split(",") if o.strip()])

    seen = set()
    out: list[str] = []
    for o in origins:
        if o and o not in seen:
            out.append(o)
            seen.add(o)

    return out


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(cards_router)
app.include_router(export_router)
app.include_router(ai_router)
app.include_router(billing_router)
app.include_router(stripe_router)
app.include_router(usage_router)

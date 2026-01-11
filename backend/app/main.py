from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import engine, Base
from .routes.auth_routes import router as auth_router
from .routes.projects_routes import router as projects_router
from .routes.cards_routes import router as cards_router
from .routes.export_routes import router as export_router
from .routes.ai_routes import router as ai_router
from .routes.billing_routes import router as billing_router
from .routes.stripe_webhook_routes import router as stripe_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="N2A API", version="2.0")

extra = [o.strip() for o in (settings.CORS_EXTRA_ORIGINS or "").split(",") if o.strip()]
origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://www.n2a.com.au",
    "https://n2a.com.au",
] + extra

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(origins)),
    allow_origin_regex=r"https://.*\.netlify\.app$",
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

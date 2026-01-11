from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

Base = declarative_base()

def _normalize_db_url(url: str) -> str:
    if not url:
        return "sqlite:///./n2a.db"

    url = url.strip()

    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]

    if url.startswith("postgresql+psycopg://") or url.startswith("sqlite://"):
        return url

    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]

    return url

db_url = _normalize_db_url(settings.DATABASE_URL)

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(db_url, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

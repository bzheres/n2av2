from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

Base = declarative_base()


def _normalize_db_url(url: str) -> str:
    if not url:
        return "sqlite:///./n2a.db"

    url = url.strip()

    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]

    if url.startswith("postgresql+psycopg://") or url.startswith("sqlite://"):
        return url

    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]

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


def ensure_schema():
    """
    Lightweight runtime "migration":
    - Adds new billing-period columns to users if they don't exist.
    Works for sqlite + postgres (best-effort).
    """
    with engine.begin() as conn:
        dialect = conn.dialect.name

        def has_column_users(col: str) -> bool:
            if dialect == "sqlite":
                rows = conn.execute(text("PRAGMA table_info(users)")).fetchall()
                return any(r[1] == col for r in rows)  # (cid, name, type, ...)
            # postgres (and others)
            rows = conn.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'users'
                    """
                )
            ).fetchall()
            return any(r[0] == col for r in rows)

        # name -> SQL type (use generic types; SQLite ignores most typing anyway)
        cols = {
            "stripe_subscription_id": "VARCHAR(255)",
            "stripe_current_period_start": "TIMESTAMP",
            "stripe_current_period_end": "TIMESTAMP",
            "usage_period_start": "TIMESTAMP",
            "usage_period_end": "TIMESTAMP",
        }

        for col, coltype in cols.items():
            if not has_column_users(col):
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {coltype}"))

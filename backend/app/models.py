from __future__ import annotations
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.sql import func
from .db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)

    stripe_customer_id = Column(String(255), nullable=True)
    plan = Column(String(32), nullable=False, default="free")
    usage_month = Column(String(16), nullable=True)
    usage_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PasswordReset(Base):
    __tablename__ = "password_resets"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Card(Base):
    __tablename__ = "cards"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    card_type = Column(String(16), nullable=False)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    raw = Column(Text, nullable=True)

    ai_changed = Column(Boolean, default=False, nullable=False)
    ai_flag = Column(String(32), nullable=True)
    ai_feedback = Column(Text, nullable=True)
    ai_suggest_front = Column(Text, nullable=True)
    ai_suggest_back = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    ENV: str = os.getenv("ENV", "local")

    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173")
    CORS_EXTRA_ORIGINS: str = os.getenv("CORS_EXTRA_ORIGINS", "")

    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./n2a.db")

    JWT_SECRET: str = os.getenv("JWT_SECRET", "change_me_dev")
    COOKIE_NAME: str = os.getenv("COOKIE_NAME", "n2a_session")
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax")
    COOKIE_DOMAIN: str = os.getenv("COOKIE_DOMAIN", "")

    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_PUBLISHABLE_KEY: str = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    STRIPE_PRICE_SILVER: str = os.getenv("STRIPE_PRICE_SILVER", "")
    STRIPE_PRICE_GOLD: str = os.getenv("STRIPE_PRICE_GOLD", "")
    STRIPE_PRICE_PLATINUM: str = os.getenv("STRIPE_PRICE_PLATINUM", "")

    APP_BASE_URL: str = os.getenv("APP_BASE_URL", "http://127.0.0.1:5173")

    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    RESEND_FROM_EMAIL: str = os.getenv("RESEND_FROM_EMAIL", "admin@n2a.com.au")

    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

settings = Settings()

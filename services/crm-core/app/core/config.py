from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "CRM Core"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    API_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/crm_dev"
    DATABASE_ECHO: bool = False
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth (compatible with existing JWT tokens)
    JWT_SECRET: str  # MANDATORY — must be set via env var
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Webhook verification tokens (set per environment)
    # WhatsApp: each tenant stores its own verify token in the DB.
    # Messenger / Instagram use a single shared token configured here.
    MESSENGER_WEBHOOK_VERIFY_TOKEN: str | None = None
    MESSENGER_PAGE_ID: str | None = None          # fallback for single-tenant dev
    INSTAGRAM_WEBHOOK_VERIFY_TOKEN: str | None = None
    INSTAGRAM_ACCOUNT_ID: str | None = None       # fallback for single-tenant dev

    # Token encryption (Fernet) — generate with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    TOKEN_ENCRYPTION_KEY: str | None = None

    # SMTP — email transacional
    # Se SMTP_HOST estiver vazio, o EmailService fica desabilitado (sem erro).
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@botreserva.com.br"
    SMTP_FROM_NAME: str = "Smart Hotéis"

    # URL pública do frontend (usada em links de email e onboarding)
    FRONTEND_URL: str = "https://hoteisreserva.com.br"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "https://hoteisreserva.com.br",
        "https://develop.botreserva.com.br",
        "https://app.botreserva.com.br",
        "https://www.botreserva.com.br",
        "https://botreserva.com.br",
    ]

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    @field_validator("JWT_ALGORITHM")
    @classmethod
    def jwt_algorithm_must_be_safe(cls, v: str) -> str:
        allowed = {"HS256", "HS384", "HS512"}
        if v not in allowed:
            raise ValueError(f"JWT_ALGORITHM must be one of {allowed}")
        return v

    @field_validator("JWT_SECRET")
    @classmethod
    def jwt_secret_must_be_strong(cls, v: str) -> str:
        if v in ("change-me-in-production", "secret", ""):
            raise ValueError("JWT_SECRET must be a strong, unique secret — not a default placeholder")
        if len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters for HS256 security")
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()

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

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth (compatible with existing JWT tokens)
    JWT_SECRET: str  # MANDATORY — must be set via env var
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

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

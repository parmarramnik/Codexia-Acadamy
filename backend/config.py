"""
Application configuration using pydantic-settings.
Loads from .env file with sensible defaults for development.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Codexia"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = "sqlite:///./ai_lms.db"

    # Redis Cache (Fast Caching for High Performance)
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_ENABLED: bool = True
    CACHE_DEFAULT_TTL: int = 300  # 5 minutes

    # JWT
    JWT_SECRET_KEY: str = "change-this-in-production-use-a-strong-random-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 100
    AUTH_RATE_LIMIT_PER_MINUTE: int = 10

    # File Upload
    MAX_UPLOAD_SIZE_MB: int = 500
    UPLOAD_DIR: str = "static"

    # Gemini AI
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Email (Brevo HTTP REST API for Render / SMTP for Local)
    BREVO_API_KEY: Optional[str] = None
    EMAIL_WEBHOOK_URL: Optional[str] = None
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    FROM_EMAIL: str = "noreply@codexia.com"
    ADMIN_EMAIL: str = "admin@codexia.com"
    INSTRUCTOR_EMAIL: str = "instructor@codexia.com"

    # Frontend URL (for email links)
    FRONTEND_URL: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
      env_file = ("../.env", ".env")
      env_file_encoding = "utf-8"
      case_sensitive = True
      extra = "ignore"


settings = Settings()

if not settings.DEBUG and settings.JWT_SECRET_KEY == "change-this-in-production-use-a-strong-random-key":
    import warnings
    warnings.warn(
        "CRITICAL SECURITY WARNING: JWT_SECRET_KEY is using the default development placeholder in production mode! "
        "Set a strong random key in your .env or environment variables immediately.",
        RuntimeWarning,
        stacklevel=2,
    )

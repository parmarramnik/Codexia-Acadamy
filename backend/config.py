"""
Application configuration using pydantic-settings.
Loads from .env file with sensible defaults for development.
"""

import re

from pydantic import field_validator
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
    # Database connection pool PER PROCESS. With N services each opening up to
    # (pool + overflow) connections, keep N * (pool + overflow) below Postgres' max_connections.
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 5

    # Rate-limit counters. "memory://" is per process; use a Redis URL (rediss:// for TLS) when more than
    # one process serves traffic, otherwise limits multiply by the number of processes.
    RATE_LIMIT_STORAGE_URI: str = "memory://"

    # Redis is a response cache only (never the source of truth for payments, enrollments or courses).
    # Optional: without it the API runs with a per-process in-memory cache. Set REDIS_REQUIRED=true on
    # multi-worker deployments so /api/health/ready fails when Redis is down instead of serving a
    # cache that differs between workers. Use rediss:// for TLS (e.g. Upstash, Render Key Value).
    REDIS_REQUIRED: bool = False
    REDIS_SOCKET_TIMEOUT: float = 2.0
    # Connections this process may open to Redis (cache pool). Redis Cloud's free plan allows ~30 in total,
    # so keep processes * (REDIS_MAX_CONNECTIONS + limiter connections) below your plan's limit.
    REDIS_MAX_CONNECTIONS: int = 5
    CACHE_ENABLED: bool = True
    CACHE_DEFAULT_TTL: int = 300  # 5 minutes

    # Elasticsearch (Full-Text, Fuzzy & Contextual Search)
    ELASTICSEARCH_URL: str = "http://localhost:9200"


    # Microservice endpoints (used only by the API gateway)
    AUTH_SERVICE_URL: str = "http://127.0.0.1:8001"
    COURSE_SERVICE_URL: str = "http://127.0.0.1:8002"
    QUIZ_SERVICE_URL: str = "http://127.0.0.1:8003"
    CODING_SERVICE_URL: str = "http://127.0.0.1:8004"
    AI_SERVICE_URL: str = "http://127.0.0.1:8005"
    ANALYTICS_SERVICE_URL: str = "http://127.0.0.1:8006"
    PAYMENT_SERVICE_URL: str = "http://127.0.0.1:8007"

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

    # Code execution. Student code is untrusted and must never run inside this API process:
    #   judge0 -> an isolated Judge0 CE service (self-hosted or hosted); the production setting.
    #   local  -> dev-only subprocess runner; refused unless DEBUG=true.
    #   auto   -> judge0 when JUDGE0_URL is set, otherwise local in DEBUG, otherwise unavailable.
    CODE_EXEC_PROVIDER: str = "auto"
    JUDGE0_URL: Optional[str] = None
    JUDGE0_API_KEY: Optional[str] = None
    JUDGE0_AUTH_HEADER: str = "X-Auth-Token"
    JUDGE0_RAPIDAPI_HOST: Optional[str] = None
    JUDGE0_LANGUAGE_IDS: Optional[str] = None  # JSON override, e.g. {"python": 100}
    CODE_EXEC_MAX_CONCURRENCY: int = 4
    CODE_EXEC_MAX_TIME_SECONDS: float = 10.0
    CODE_EXEC_MAX_MEMORY_MB: int = 512
    CODE_EXEC_MAX_OUTPUT_BYTES: int = 64 * 1024
    CODE_EXEC_MAX_SOURCE_BYTES: int = 64 * 1024
    CODE_EXEC_MAX_STDIN_BYTES: int = 64 * 1024
    CODE_EXEC_HTTP_TIMEOUT_SECONDS: float = 30.0

    # RAG. Chunks + embeddings live in the database (the persistent source of truth); FAISS
    # indexes are derived from them per course and rebuilt on demand, so no persistent disk is needed.
    RAG_ENABLED: bool = True
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_CACHE_DIR: Optional[str] = None  # Hugging Face cache; mount a persistent disk here to avoid re-downloading
    EMBEDDING_BATCH_SIZE: int = 32
    RAG_TOP_K: int = 5
    RAG_MIN_SCORE: float = 0.30  # cosine similarity floor; below this a chunk is not evidence
    RAG_CHUNK_CHARS: int = 1000
    RAG_CHUNK_OVERLAP: int = 150
    RAG_MAX_CONTEXT_CHARS: int = 6000
    RAG_MAX_UPLOAD_MB: int = 10
    RAG_MAX_DOCUMENT_CHARS: int = 2_000_000

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

    # Frontend URL (for email links and certificate verification links / QR codes).
    # In production this MUST be the public frontend origin, e.g. https://your-app.vercel.app
    FRONTEND_URL: str = "http://localhost:3000"

    # Key used to sign issued certificates (tamper detection). Falls back to JWT_SECRET_KEY.
    # Keep it stable: changing it makes previously issued certificates fail the integrity check.
    CERTIFICATE_SIGNING_KEY: Optional[str] = None

    # Razorpay (server-side only). Only RAZORPAY_KEY_ID is ever sent to the browser.
    # Use rzp_test_* keys until the full test checklist passes, then switch to rzp_live_* keys.
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None
    RAZORPAY_API_BASE: str = "https://api.razorpay.com/v1"
    RAZORPAY_TIMEOUT_SECONDS: float = 15.0

    @field_validator("SEED_DEMO_DATA", mode="before")
    @classmethod
    def _empty_means_unset(cls, value):
        # docker compose passes unset optional variables as empty strings
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", mode="before")
    @classmethod
    def _clean_razorpay_value(cls, value):
        # Values pasted into a hosting dashboard often carry stray spaces or quotes, which
        # Razorpay rejects as "Authentication failed".
        if isinstance(value, str):
            value = value.strip().strip("\"'").strip()
            return value or None
        return value

    @property
    def payments_configured(self) -> bool:
        # A malformed key ID would only fail inside Razorpay Checkout; treat it as unconfigured instead.
        return bool(self.RAZORPAY_KEY_SECRET and re.fullmatch(r"rzp_(test|live)_[A-Za-z0-9]{8,}",
                                                               self.RAZORPAY_KEY_ID or ""))

    # Demo accounts (shared well-known passwords) and sample courses. Defaults to ON only when DEBUG=true.
    SEED_DEMO_DATA: Optional[bool] = None

    # Optional first administrator, created once by the bootstrap job (never overwritten if it exists).
    ADMIN_BOOTSTRAP_EMAIL: Optional[str] = None
    ADMIN_BOOTSTRAP_USERNAME: str = "admin"
    ADMIN_BOOTSTRAP_PASSWORD: Optional[str] = None

    @property
    def seed_demo_data(self) -> bool:
        return self.DEBUG if self.SEED_DEMO_DATA is None else bool(self.SEED_DEMO_DATA)

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
      env_file = ("../.env", ".env")
      env_file_encoding = "utf-8"
      case_sensitive = True
      extra = "ignore"


settings = Settings()

DEFAULT_JWT_SECRET = "change-this-in-production-use-a-strong-random-key"


def validate_production_settings() -> None:
    """
    Fail fast on unsafe production configuration (called at startup by every service).
    Does nothing when DEBUG=true.
    """
    if settings.DEBUG:
        return
    problems = []
    if settings.JWT_SECRET_KEY == DEFAULT_JWT_SECRET or len(settings.JWT_SECRET_KEY) < 32:
        problems.append("JWT_SECRET_KEY must be a random string of at least 32 characters")
    if settings.DATABASE_URL.startswith("sqlite"):
        problems.append("DATABASE_URL must point to PostgreSQL, not SQLite")
    if "localhost" in settings.FRONTEND_URL or "127.0.0.1" in settings.FRONTEND_URL:
        problems.append("FRONTEND_URL must be your public frontend URL (it is used in emails and certificate QR codes)")
    if problems:
        raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))

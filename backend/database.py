"""
Database engine, session factory, and declarative base.
Uses SQLite for development, PostgreSQL for production.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings

# Use check_same_thread=False only for SQLite
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    Dependency that yields a database session.
    Ensures the session is closed after each request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all tables in the database."""
    Base.metadata.create_all(bind=engine)

    # Dynamic schema migration for existing databases
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    try:
        if "notes" in inspector.get_table_names():
            columns = [col["name"] for col in inspector.get_columns("notes")]
            with engine.begin() as conn:
                if "current_branch_id" not in columns:
                    conn.execute(text("ALTER TABLE notes ADD COLUMN current_branch_id INTEGER"))
                if "auto_commit_enabled" not in columns:
                    conn.execute(text("ALTER TABLE notes ADD COLUMN auto_commit_enabled BOOLEAN DEFAULT FALSE NOT NULL"))
                if "auto_commit_interval" not in columns:
                    conn.execute(text("ALTER TABLE notes ADD COLUMN auto_commit_interval INTEGER DEFAULT 30 NOT NULL"))
                if "auto_commit_on_major_edit" not in columns:
                    conn.execute(text("ALTER TABLE notes ADD COLUMN auto_commit_on_major_edit BOOLEAN DEFAULT TRUE NOT NULL"))
                if "auto_commit_before_ai" not in columns:
                    conn.execute(text("ALTER TABLE notes ADD COLUMN auto_commit_before_ai BOOLEAN DEFAULT TRUE NOT NULL"))
        if "users" in inspector.get_table_names():
            user_columns = [col["name"] for col in inspector.get_columns("users")]
            with engine.begin() as conn:
                if "last_verification_sent_at" not in user_columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN last_verification_sent_at TIMESTAMP"))
    except Exception as e:
        print(f"[Migration Warning] Failed to dynamically migrate table 'notes': {str(e)}")

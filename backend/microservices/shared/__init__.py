"""
Shared core module for microservices: config, database, models, schemas, auth, and utils.
"""

from config import settings
from database import engine, SessionLocal, Base, get_db, create_tables

__all__ = ["settings", "engine", "SessionLocal", "Base", "get_db", "create_tables"]

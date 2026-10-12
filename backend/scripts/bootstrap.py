"""
One-shot bootstrap run BEFORE the services start (the `migrate` job in docker-compose).

  * creates/updates tables            (idempotent)
  * seeds roles, permissions, problems (idempotent)
  * seeds demo accounts/courses only when SEED_DEMO_DATA=true (default: DEBUG only)
  * creates the first administrator from ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD if that
    account does not exist yet (an existing account is never modified)

Running it from every service at startup caused races (parallel CREATE TYPE / seed inserts), so only
this job does schema work.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402

from config import settings, validate_production_settings  # noqa: E402
from database import SessionLocal, create_tables, engine  # noqa: E402


def wait_for_database(attempts: int = 30) -> None:
    for attempt in range(1, attempts + 1):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return
        except Exception as exc:  # noqa: BLE001
            print(f"Waiting for database ({attempt}/{attempts}): {type(exc).__name__}")
            time.sleep(2)
    raise SystemExit("Database never became reachable")


def ensure_admin() -> None:
    email, password = settings.ADMIN_BOOTSTRAP_EMAIL, settings.ADMIN_BOOTSTRAP_PASSWORD
    if not (email and password):
        return
    from schemas.user import UserCreate
    from services.user_service import create_user, get_user_by_email

    db = SessionLocal()
    try:
        if get_user_by_email(db, email):
            print(f"Admin {email} already exists; left unchanged.")
            return
        user = create_user(db, UserCreate(email=email, username=settings.ADMIN_BOOTSTRAP_USERNAME,
                                          full_name="Administrator", password=password, role="admin"))
        user.is_verified = True
        db.commit()
        print(f"Created administrator {email}.")
    finally:
        db.close()


def main() -> None:
    validate_production_settings()
    wait_for_database()
    create_tables()
    import models  # noqa: F401  (register every table)
    create_tables()
    from seed_db import seed_database
    seed_database()
    ensure_admin()
    print("Bootstrap complete.")


if __name__ == "__main__":
    main()

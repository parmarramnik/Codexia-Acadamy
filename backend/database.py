"""
Database engine, session factory, and declarative base.
Uses SQLite for development, PostgreSQL for production.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings

if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False,
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=180,
        connect_args={"connect_timeout": 5},
        echo=False,
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


_tables_initialized = False

def create_tables():
    """Create all tables in the database safely and dynamically migrate missing columns on startup."""
    global _tables_initialized
    if _tables_initialized:
        return
    _tables_initialized = True

    try:
        import models  # Register all models with Base.metadata
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"[Schema Notice] Base.metadata.create_all notice: {e}")

    # Dynamic schema migration for existing production databases
    from sqlalchemy import inspect, text
    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())

        # 1. coding_problems table migrations
        if "coding_problems" in existing_tables:
            coding_cols = {col["name"] for col in inspector.get_columns("coding_problems")}
            for col_name, col_type in [
                ("course_id", "INTEGER"),
                ("starter_code_python", "TEXT"),
                ("starter_code_cpp", "TEXT"),
                ("starter_code_c", "TEXT"),
                ("starter_code_java", "TEXT"),
                ("starter_code_javascript", "TEXT"),
                ("starter_code_go", "TEXT"),
                ("constraints", "TEXT"),
                ("input_format", "TEXT"),
                ("output_format", "TEXT"),
                ("solution", "TEXT"),
                ("hints", "TEXT"),
                ("tags", "VARCHAR(500)"),
                ("is_published", "BOOLEAN DEFAULT TRUE"),
                ("total_submissions", "INTEGER DEFAULT 0"),
                ("accepted_submissions", "INTEGER DEFAULT 0"),
            ]:
                if col_name not in coding_cols:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE coding_problems ADD COLUMN {col_name} {col_type}"))
                        print(f"[Migration] Added missing column '{col_name}' to 'coding_problems'")
                    except Exception as col_err:
                        print(f"[Migration Warning] Could not add '{col_name}' to 'coding_problems': {col_err}")

        # 2. test_cases table migrations
        if "test_cases" in existing_tables:
            tc_cols = {col["name"] for col in inspector.get_columns("test_cases")}
            for col_name, col_type in [
                ("input_data", "TEXT"),
                ("expected_output", "TEXT"),
                ("is_hidden", "BOOLEAN DEFAULT FALSE"),
                ("order_index", "INTEGER DEFAULT 0"),
                ("time_limit_seconds", "FLOAT DEFAULT 2.0"),
                ("memory_limit_mb", "INTEGER DEFAULT 256"),
            ]:
                if col_name not in tc_cols:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE test_cases ADD COLUMN {col_name} {col_type}"))
                        print(f"[Migration] Added missing column '{col_name}' to 'test_cases'")
                    except Exception as col_err:
                        print(f"[Migration Warning] Could not add '{col_name}' to 'test_cases': {col_err}")

        # 3. submissions table migrations
        if "submissions" in existing_tables:
            sub_cols = {col["name"] for col in inspector.get_columns("submissions")}
            for col_name, col_type in [
                ("test_cases_passed", "INTEGER DEFAULT 0"),
                ("test_cases_total", "INTEGER DEFAULT 0"),
                ("execution_time_ms", "INTEGER"),
                ("memory_used_mb", "FLOAT"),
                ("error_message", "TEXT"),
            ]:
                if col_name not in sub_cols:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE submissions ADD COLUMN {col_name} {col_type}"))
                        print(f"[Migration] Added missing column '{col_name}' to 'submissions'")
                    except Exception as col_err:
                        print(f"[Migration Warning] Could not add '{col_name}' to 'submissions': {col_err}")

        # 4. users table migrations
        if "users" in existing_tables:
            user_columns = {col["name"] for col in inspector.get_columns("users")}
            for col_name, col_type in [
                ("last_verification_sent_at", "TIMESTAMP"),
                ("verification_otp", "VARCHAR(6)"),
                ("verification_otp_expires", "TIMESTAMP WITH TIME ZONE"),
                ("token_version", "INTEGER DEFAULT 1 NOT NULL"),
            ]:
                if col_name not in user_columns:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                        print(f"[Migration] Added missing column '{col_name}' to 'users'")
                    except Exception as col_err:
                        print(f"[Migration Warning] Could not add '{col_name}' to 'users': {col_err}")

        # 5. notes table migrations
        if "notes" in existing_tables:
            note_cols = {col["name"] for col in inspector.get_columns("notes")}
            for col_name, col_type in [
                ("current_branch_id", "INTEGER"),
                ("auto_commit_enabled", "BOOLEAN DEFAULT FALSE NOT NULL"),
                ("auto_commit_interval", "INTEGER DEFAULT 30 NOT NULL"),
                ("auto_commit_on_major_edit", "BOOLEAN DEFAULT TRUE NOT NULL"),
                ("auto_commit_before_ai", "BOOLEAN DEFAULT TRUE NOT NULL"),
            ]:
                if col_name not in note_cols:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE notes ADD COLUMN {col_name} {col_type}"))
                        print(f"[Migration] Added missing column '{col_name}' to 'notes'")
                    except Exception as col_err:
                        print(f"[Migration Warning] Could not add '{col_name}' to 'notes': {col_err}")

        # 6. courses table migrations
        if "courses" in existing_tables:
            course_cols = {col["name"] for col in inspector.get_columns("courses")}
            pricing_added = "pricing_type" not in course_cols
            for col_name, col_type in [
                ("pricing_type", "VARCHAR(10) DEFAULT 'FREE' NOT NULL"),
                ("price_amount", "INTEGER DEFAULT 0 NOT NULL"),
                ("currency", "VARCHAR(3) DEFAULT 'INR' NOT NULL"),
                ("is_purchasable", "BOOLEAN DEFAULT TRUE NOT NULL"),
                ("short_description", "VARCHAR(500)"),
                ("thumbnail_url", "VARCHAR(500)"),
                ("duration_hours", "FLOAT DEFAULT 0.0"),
                ("total_lectures", "INTEGER DEFAULT 0"),
                ("is_published", "BOOLEAN DEFAULT TRUE"),
                ("is_approved", "BOOLEAN DEFAULT TRUE"),
                ("is_featured", "BOOLEAN DEFAULT FALSE"),
                ("price", "FLOAT DEFAULT 0.0"),
                ("tags", "VARCHAR(500)"),
                ("prerequisites", "TEXT"),
                ("learning_objectives", "TEXT"),
            ]:
                if col_name not in course_cols:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE courses ADD COLUMN {col_name} {col_type}"))
                        print(f"[Migration] Added missing column '{col_name}' to 'courses'")
                    except Exception as col_err:
                        print(f"[Migration Warning] Could not add '{col_name}' to 'courses': {col_err}")
            if pricing_added:
                # Existing courses start FREE (the previous business rule). Legacy `price` values are
                # kept untouched; courses that carried one are reported so an admin can set real
                # pricing deliberately instead of the migration silently turning them into paid courses.
                try:
                    with engine.connect() as conn:
                        legacy = conn.execute(text(
                            "SELECT id, title, price FROM courses WHERE price > 0 AND pricing_type = 'FREE'"
                        )).fetchall()
                    for row in legacy:
                        print(f"[Migration Notice] Course #{row[0]} '{row[1]}' has legacy price {row[2]} but is "
                              "FREE; set its pricing in Admin Panel -> Course Pricing if it should be paid")
                except Exception as sync_err:
                    print(f"[Migration Warning] Could not inspect legacy course prices: {sync_err}")

        # 6b. One enrollment per learner per course (protects paid access from duplicates)
        if "enrollments" in existing_tables:
            try:
                with engine.begin() as conn:
                    conn.execute(text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollments_user_course "
                        "ON enrollments (user_id, course_id)"
                    ))
            except Exception as idx_err:
                print(
                    "[Migration Warning] Could not add unique (user_id, course_id) index to 'enrollments' — "
                    f"duplicate enrollment rows probably exist and should be merged manually: {idx_err}"
                )

        # 7. lectures table migrations
        if "lectures" in existing_tables:
            lec_cols = {col["name"] for col in inspector.get_columns("lectures")}
            for col_name, col_type in [
                ("duration_seconds", "INTEGER DEFAULT 0"),
                ("is_preview", "BOOLEAN DEFAULT FALSE"),
            ]:
                if col_name not in lec_cols:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE lectures ADD COLUMN {col_name} {col_type}"))
                        print(f"[Migration] Added missing column '{col_name}' to 'lectures'")
                    except Exception as col_err:
                        print(f"[Migration Warning] Could not add '{col_name}' to 'lectures': {col_err}")

        # 8. certificates table migrations (credential number + integrity signature)
        if "certificates" in existing_tables:
            cert_cols = {col["name"] for col in inspector.get_columns("certificates")}
            for col_name, col_type in [
                ("credential_id", "VARCHAR(32)"),
                ("signature", "VARCHAR(64)"),
            ]:
                if col_name not in cert_cols:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE certificates ADD COLUMN {col_name} {col_type}"))
                        print(f"[Migration] Added missing column '{col_name}' to 'certificates'")
                    except Exception as col_err:
                        print(f"[Migration Warning] Could not add '{col_name}' to 'certificates': {col_err}")
            try:
                with engine.begin() as conn:
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_certificates_credential_id ON certificates (credential_id)"))
            except Exception as idx_err:
                print(f"[Migration Notice] credential_id index: {idx_err}")

        # 9. payments table migrations (key that created each order)
        if "payments" in existing_tables:
            payment_cols = {col["name"] for col in inspector.get_columns("payments")}
            for col_name, col_type in [
                ("razorpay_key_id", "VARCHAR(64)"),
            ]:
                if col_name not in payment_cols:
                    try:
                        with engine.begin() as conn:
                            conn.execute(text(f"ALTER TABLE payments ADD COLUMN {col_name} {col_type}"))
                        print(f"[Migration] Added missing column '{col_name}' to 'payments'")
                    except Exception as col_err:
                        print(f"[Migration Warning] Could not add '{col_name}' to 'payments': {col_err}")

    except Exception as e:
        print(f"[Migration Warning] Dynamic schema migration failed: {str(e)}")

    # Backfill credential numbers, signatures and download URLs for certificates issued before this release
    try:
        from services.certificate_service import backfill_certificates
        db = SessionLocal()
        try:
            updated = backfill_certificates(db)
            if updated:
                print(f"[Migration] Backfilled security data for {updated} certificate(s)")
        finally:
            db.close()
    except Exception as e:
        print(f"[Migration Warning] Certificate backfill failed: {str(e)}")


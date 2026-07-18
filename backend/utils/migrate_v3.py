"""
Database migration & bootstrapping script for Codexia Academy v3.0 features.
"""

import sys
import os
from datetime import datetime, timezone, timedelta

# Add parent path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine, Base, SessionLocal
# Import models to register in metadata
import models.v3_models
from models.v3_models import Contest

def run_migration():
    print("Step 1: Creating database tables for Codexia Academy v3.0...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

    print("Step 2: Seeding default Competitive Programming Contest...")
    db = SessionLocal()
    try:
        existing = db.query(Contest).filter(Contest.title == "Codexia Daily Sprint Challenge").first()
        if not existing:
            new_contest = Contest(
                title="Codexia Daily Sprint Challenge",
                description="Solve 3 algorithmic challenges within 60 minutes! Compete with global developers.",
                start_time=datetime.now(timezone.utc) - timedelta(hours=2),
                end_time=datetime.now(timezone.utc) + timedelta(days=7),
            )
            db.add(new_contest)
            db.commit()
            print("Daily Sprint Challenge seeded successfully!")
        else:
            print("Sprint Challenge already exists.")
    except Exception as e:
        print(f"Error seeding contests: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
    print("Codexia Academy v3.0 Migration Complete!")

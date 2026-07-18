"""
Codexia Academy v4.0 Database Migration & Seeding Bootstrap Utility
"""

from database import engine, Base, get_db
# Import all models to ensure engine registration
from models.user import User, Role, Permission, RolePermission
from models.course import Course, Enrollment, Lecture
from models.quiz import Quiz, QuizAttempt
from models.coding import CodingProblem, Submission
from models.analytics import StudySession
from models.v3_models import Contest, ContestSubmission
from models.v4_models import SystemSetting, LearningPath

def run_migration():
    print("Initializing Codexia Academy v4.0 database migration...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

    # Seeding Roles and Permissions
    db = next(get_db())
    try:
        # Create Permissions
        perm_keys = [
            ("user_suspend", "Ability to suspend student/instructor accounts"),
            ("user_delete", "Ability to permanently remove users"),
            ("course_publish", "Ability to approve and publish new courses"),
            ("analytics_view", "Access to system-wide dashboards"),
            ("system_settings_edit", "Configure global site parameters")
        ]
        
        perms = {}
        for name, desc in perm_keys:
            perm = db.query(Permission).filter(Permission.name == name).first()
            if not perm:
                perm = Permission(name=name, description=desc)
                db.add(perm)
                db.commit()
                db.refresh(perm)
            perms[name] = perm

        # Create Roles
        role_keys = [
            ("student", "Standard user learning path workspace"),
            ("instructor", "Course creator dashboard panel permissions"),
            ("admin", "Executive operations dashboard control access"),
            ("super_admin", "Owner level root credentials")
        ]

        roles = {}
        for name, desc in role_keys:
            role = db.query(Role).filter(Role.name == name).first()
            if not role:
                role = Role(name=name, description=desc)
                db.add(role)
                db.commit()
                db.refresh(role)
            roles[name] = role

        # Map Permissions via RolePermission
        for name, p in perms.items():
            for role_name in ["admin", "super_admin"]:
                role = roles[role_name]
                rp = db.query(RolePermission).filter(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == p.id
                ).first()
                if not rp:
                    rp = RolePermission(role_id=role.id, permission_id=p.id)
                    db.add(rp)
                
        db.commit()
        print("Dynamic Roles & Permissions seeded successfully!")

        # Seed System Settings
        settings_keys = [
            ("site_name", "Codexia Academy v4.0", "Main title banner for headers"),
            ("maintenance_mode", "false", "Offline maintenance toggle flag"),
            ("ai_max_tokens_limit", "1500", "Token limits per session call"),
            ("backup_frequency_hours", "24", "Database background backup intervals")
        ]

        for key, val, desc in settings_keys:
            sett = db.query(SystemSetting).filter(SystemSetting.key == key).first()
            if not sett:
                sett = SystemSetting(key=key, value=val, description=desc)
                db.add(sett)
        db.commit()
        print("System Settings parameters seeded!")

        # Seed default Learning Path
        path = db.query(LearningPath).filter(LearningPath.slug == "full-stack-web-developer").first()
        if not path:
            path = LearningPath(
                title="Full-Stack Web Developer Roadmap",
                description="Comprehensive path covering backend API design, database structures, and React dashboard visual layouts.",
                slug="full-stack-web-developer"
            )
            db.add(path)
            db.commit()
            print("Default Learning Path seeded!")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {str(e)}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()

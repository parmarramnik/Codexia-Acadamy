"""
Codexia Academy v2.0 Database Migration & Bootstrap Script.
Appends new security columns, creates new tables, and seeds RBAC permissions.
"""

import sys
import os
from datetime import datetime, timezone

# Add the parent folder to path so we can import from database and models
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine, Base, SessionLocal
from models.user import User, Role, Permission, RolePermission, UserRole


def migrate_schema():
    """Create all new tables and dynamically alter the users table if columns are missing."""
    print("Step 1: Creating new database tables if not exist...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

    print("Step 2: Checking and altering users table for lockout columns...")
    db = SessionLocal()
    try:
        # Check if failed_login_attempts column exists
        column_added = False
        
        # We can run a PRAGMA table_info on SQLite, or inspect PostgreSQL
        if engine.dialect.name == "sqlite":
            with engine.begin() as conn:
                res = conn.execute(text("PRAGMA table_info(users)"))
                columns = [row[1] for row in res]
                
                if "failed_login_attempts" not in columns:
                    print("Adding failed_login_attempts to users table...")
                    conn.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0 NOT NULL"))
                    column_added = True
                if "lockout_until" not in columns:
                    print("Adding lockout_until to users table...")
                    conn.execute(text("ALTER TABLE users ADD COLUMN lockout_until DATETIME"))
                    column_added = True
        else:
            # PostgreSQL migration fallback
            with engine.begin() as conn:
                # Check column existence using information_schema
                res = conn.execute(
                    text("SELECT column_name FROM information_schema.columns "
                    "WHERE table_name='users' AND column_name='failed_login_attempts'")
                ).fetchone()
                if not res:
                    print("Adding failed_login_attempts to PostgreSQL users table...")
                    conn.execute(text("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0 NOT NULL"))
                    column_added = True
                
                res = conn.execute(
                    text("SELECT column_name FROM information_schema.columns "
                    "WHERE table_name='users' AND column_name='lockout_until'")
                ).fetchone()
                if not res:
                    print("Adding lockout_until to PostgreSQL users table...")
                    conn.execute(text("ALTER TABLE users ADD COLUMN lockout_until TIMESTAMP"))
                    column_added = True
        
        if column_added:
            print("Users table columns updated successfully!")
        else:
            print("Lockout columns already exist in users table.")
            
    except Exception as e:
        print(f"Error during ALTER TABLE: {e}")
        db.rollback()
    finally:
        db.close()


def seed_rbac():
    """Seed roles, permissions, and map default permissions to roles."""
    print("Step 3: Seeding roles and permissions mapping (RBAC)...")
    db = SessionLocal()
    try:
        # Define roles
        role_names = {
            UserRole.STUDENT.value: "Student access controls",
            UserRole.INSTRUCTOR.value: "Instructor course building dashboard access",
            UserRole.ADMIN.value: "Administrative dashboard controls",
            UserRole.SUPER_ADMIN.value: "Super Admin full system controls",
        }

        roles_db = {}
        for r_name, r_desc in role_names.items():
            role = db.query(Role).filter(Role.name == r_name).first()
            if not role:
                role = Role(name=r_name, description=r_desc)
                db.add(role)
                db.flush()
            roles_db[r_name] = role

        # Define permissions
        permissions_def = {
            # Student actions
            "course:enroll": "Allows enrolling in courses",
            "quiz:submit": "Allows submitting quiz attempts",
            "coding:submit": "Allows submitting practice solutions",
            "certificate:claim": "Allows claiming completed certificates",
            # Instructor actions
            "course:create": "Allows creating syllabus tracks",
            "course:edit": "Allows modifying created course components",
            "course:publish": "Allows changing course draft status",
            "lecture:add": "Allows uploading video assets and resources",
            "quiz:create": "Allows adding quizzes to courses",
            # Admin actions
            "user:manage": "Allows updating user active status and roles",
            "security:view_logs": "Allows auditing access and system security logs",
        }

        perms_db = {}
        for p_name, p_desc in permissions_def.items():
            perm = db.query(Permission).filter(Permission.name == p_name).first()
            if not perm:
                perm = Permission(name=p_name, description=p_desc)
                db.add(perm)
                db.flush()
            perms_db[p_name] = perm

        # Commit permissions first
        db.commit()

        # Map permissions to roles
        # Student permissions
        student_perms = ["course:enroll", "quiz:submit", "coding:submit", "certificate:claim"]
        # Instructor permissions
        instructor_perms = student_perms + ["course:create", "course:edit", "course:publish", "lecture:add", "quiz:create"]
        # Admin permissions
        admin_perms = instructor_perms + ["user:manage", "security:view_logs"]
        # Super admin has all permissions
        super_admin_perms = list(permissions_def.keys())

        mappings = {
            UserRole.STUDENT.value: student_perms,
            UserRole.INSTRUCTOR.value: instructor_perms,
            UserRole.ADMIN.value: admin_perms,
            UserRole.SUPER_ADMIN.value: super_admin_perms,
        }

        for r_name, p_list in mappings.items():
            role = roles_db[r_name]
            for p_name in p_list:
                perm = perms_db[p_name]
                # Check mapping existence
                exists = db.query(RolePermission).filter(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == perm.id
                ).first()
                
                if not exists:
                    mapping = RolePermission(role_id=role.id, permission_id=perm.id)
                    db.add(mapping)

        db.commit()
        print("RBAC roles, permissions, and maps seeded successfully!")

    except Exception as e:
        print(f"Error seeding RBAC: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    migrate_schema()
    seed_rbac()
    print("Database upgrade to Codexia Academy v2.0 complete!")

"""
Security compliance end-to-end verification script for Codexia Academy v2.0 features.
"""

import sys
import os
from datetime import datetime, timezone, timedelta

# Add parent path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models.user import User, UserRole, Role, Permission, RolePermission
from services.auth_service import login_user, authenticate_user
from services.session_service import get_active_sessions, record_login_attempt


def test_failed_login_lockout():
    """Verify that 5 failed login attempts trigger account lockout."""
    print("Running Lockout Verification Test...")
    db = SessionLocal()
    try:
        # Create a temp test user
        test_email = "lockout_test@example.com"
        # Cleanup if exists
        db.query(User).filter(User.email == test_email).delete()
        db.commit()

        from schemas.user import UserCreate
        from services.user_service import create_user
        
        user_data = UserCreate(
            email=test_email,
            username="lockout_test",
            full_name="Lockout Test User",
            password="Password123!",
            role="student",
        )
        user = create_user(db, user_data)
        
        print("1. Success check: authenticate with correct password...")
        auth = authenticate_user(db, test_email, "Password123!")
        assert auth is not None, "Authentication failed for correct password"
        
        print("2. Record 4 failed attempts...")
        for i in range(4):
            record_login_attempt(db, test_email, "failed", "127.0.0.1", "TestBot", "Wrong password")
        
        db.refresh(user)
        assert user.failed_login_attempts == 4, f"Failed attempts count incorrect: {user.failed_login_attempts}"
        assert user.lockout_until is None, "Account locked out too early"
        
        print("3. Record 5th failed attempt -> should trigger lockout...")
        record_login_attempt(db, test_email, "failed", "127.0.0.1", "TestBot", "Wrong password")
        
        db.refresh(user)
        assert user.failed_login_attempts == 5, f"Failed attempts count incorrect: {user.failed_login_attempts}"
        assert user.lockout_until is not None, "Lockout was not set"
        assert user.lockout_until.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc), "Lockout time is in the past"
        
        print("4. Attempt authentication while locked out -> should raise lockout ValueError...")
        try:
            authenticate_user(db, test_email, "Password123!")
            assert False, "Should have raised lockout exception"
        except ValueError as e:
            assert "locked out" in str(e).lower(), f"Unexpected lockout error: {e}"
            print("Lockout correctly raised ValueError:", e)

        # Cleanup
        db.query(User).filter(User.email == test_email).delete()
        db.commit()
        print("Lockout Verification: PASSED ✅\n")

    except Exception as e:
        print("Lockout Verification: FAILED ❌", e)
        db.rollback()
    finally:
        db.close()


def test_session_rotation():
    """Verify that login creates an active session and tracks device logs."""
    print("Running Session Tracking Verification Test...")
    db = SessionLocal()
    try:
        test_email = "session_test@example.com"
        db.query(User).filter(User.email == test_email).delete()
        db.commit()

        from schemas.user import UserCreate
        from services.user_service import create_user
        
        user_data = UserCreate(
            email=test_email,
            username="session_test",
            full_name="Session Test User",
            password="Password123!",
            role="student",
        )
        user = create_user(db, user_data)
        
        print("1. Login user...")
        result = login_user(db, test_email, "Password123!", remember_me=True, ip_address="192.168.1.5", user_agent="Firefox")
        
        print("2. Fetch active sessions...")
        sessions = get_active_sessions(db, user.id)
        assert len(sessions) == 1, f"Expected 1 active session, got {len(sessions)}"
        session = sessions[0]
        assert session.ip_address == "192.168.1.5"
        assert session.user_agent == "Firefox"
        assert session.is_active is True
        
        # Cleanup
        db.query(User).filter(User.email == test_email).delete()
        db.commit()
        print("Session Tracking Verification: PASSED ✅\n")

    except Exception as e:
        print("Session Tracking Verification: FAILED ❌", e)
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("--- STARTING SECURITY COMPLIANCE TESTS ---\n")
    test_failed_login_lockout()
    test_session_rotation()
    print("--- ALL COMPLIANCE TESTS COMPLETE ---")

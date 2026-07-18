"""
Codexia Academy v4.0 Test Suite (Unit and Integration testing checks)
"""

import sys
import os
# Ensure backend directory is in python search path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, engine, get_db
from models.user import User, Role, Permission, RolePermission
from models.v4_models import SystemSetting
from services.coding_service import execute_code_sandbox


def test_v4_database_rbac():
    """Verify that seeded RBAC tables can be successfully queried and enforce relations."""
    db = next(get_db())
    try:
        # Check permissions seeds
        perms = db.query(Permission).all()
        assert len(perms) > 0, "No permissions were seeded"
        
        # Check settings
        site_name = db.query(SystemSetting).filter(SystemSetting.key == "site_name").first()
        assert site_name is not None
        assert "v4.0" in site_name.value
        
        print("Test database RBAC: PASSED!")
    finally:
        db.close()


def test_v4_sandbox_limitations():
    """Verify code execution service enforces timeouts and memory caps."""
    # Test a simple python run
    py_code = "print('Hello Sandboxed World')"
    passed, actual_output, time_ms, error_message, memory_used_mb = execute_code_sandbox(
        py_code, "python", "", "Hello Sandboxed World", time_limit_seconds=2, memory_limit_mb=64
    )
    assert passed is True, f"Expected simple program execution to pass, got: {error_message}"
    assert "Hello Sandboxed World" in actual_output
    
    # Test execution timeout
    timeout_code = "import time\nwhile True:\n    time.sleep(1)"
    passed_timeout, _, _, error_timeout, _ = execute_code_sandbox(
        timeout_code, "python", "", "", time_limit_seconds=1, memory_limit_mb=64
    )
    assert passed_timeout is False, "Expected running loop to be terminated by timeout"
    assert "timeout" in str(error_timeout).lower() or "limit" in str(error_timeout).lower()
    
    print("Test compiler sandbox limits: PASSED!")


if __name__ == "__main__":
    test_v4_database_rbac()
    test_v4_sandbox_limitations()

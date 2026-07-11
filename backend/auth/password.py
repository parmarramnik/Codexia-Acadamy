"""
Password hashing and verification using bcrypt directly.
Avoids passlib compatibility issues with modern bcrypt versions.
"""

import bcrypt


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    # bcrypt uses first 72 bytes; encode then hash
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False

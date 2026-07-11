"""
Validation utilities for input sanitization and format checking.
"""

import re
from typing import Optional


def sanitize_string(value: str) -> str:
    """Strip whitespace and remove dangerous characters."""
    return re.sub(r"[<>\"';]", "", value.strip())


def validate_email_format(email: str) -> bool:
    """Basic email format validation."""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))


def validate_file_extension(filename: str, allowed_extensions: list[str]) -> bool:
    """Check if a file has an allowed extension."""
    if not filename:
        return False
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return extension in allowed_extensions


def validate_file_size(size_bytes: int, max_size_mb: int) -> bool:
    """Check if a file size is within the allowed limit."""
    return size_bytes <= max_size_mb * 1024 * 1024


def truncate_string(value: str, max_length: int, suffix: str = "...") -> str:
    """Truncate a string to a maximum length with a suffix."""
    if len(value) <= max_length:
        return value
    return value[: max_length - len(suffix)] + suffix

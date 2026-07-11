"""
General helper utilities — slug generation, pagination, date formatting.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from slugify import slugify as python_slugify


def generate_slug(title: str, unique: bool = True) -> str:
    """Generate a URL-safe slug from a title."""
    slug = python_slugify(title, max_length=300)
    if unique:
        short_id = uuid.uuid4().hex[:6]
        slug = f"{slug}-{short_id}"
    return slug


def generate_unique_filename(original_filename: str) -> str:
    """Generate a unique filename preserving the extension."""
    extension = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else ""
    unique_name = f"{uuid.uuid4().hex}"
    return f"{unique_name}.{extension}" if extension else unique_name


def ensure_directory(directory: str) -> None:
    """Create a directory if it does not exist."""
    os.makedirs(directory, exist_ok=True)


def format_duration(seconds: int) -> str:
    """Format seconds into a human-readable duration string."""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    remaining_seconds = seconds % 60

    if hours > 0:
        return f"{hours}h {minutes}m"
    elif minutes > 0:
        return f"{minutes}m {remaining_seconds}s"
    else:
        return f"{remaining_seconds}s"


def calculate_percentage(part: float, total: float) -> float:
    """Calculate percentage, returns 0.0 if total is 0."""
    if total == 0:
        return 0.0
    return round((part / total) * 100, 2)


def paginate_query(query, page: int = 1, page_size: int = 20):
    """Apply pagination to a SQLAlchemy query."""
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    offset = (page - 1) * page_size
    return query.offset(offset).limit(page_size)


class PaginatedResponse:
    """Standard pagination response wrapper."""

    def __init__(self, items: list, total: int, page: int, page_size: int):
        self.items = items
        self.total = total
        self.page = page
        self.page_size = page_size
        self.total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        self.has_next = page < self.total_pages
        self.has_prev = page > 1

    def to_dict(self) -> dict:
        return {
            "items": self.items,
            "total": self.total,
            "page": self.page,
            "page_size": self.page_size,
            "total_pages": self.total_pages,
            "has_next": self.has_next,
            "has_prev": self.has_prev,
        }

"""Test isolation: never read or write a developer's live Redis cache."""
import os

os.environ["REDIS_URL"] = "redis://127.0.0.1:1/0"  # unreachable -> in-memory cache fallback

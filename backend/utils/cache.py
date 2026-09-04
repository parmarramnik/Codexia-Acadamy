"""
Redis Caching Service with graceful offline fallback.
Provides fast in-memory key-value caching, prefix-based invalidation,
and endpoint decorators for high-performance responses.
"""

import json
import logging
from functools import wraps
from typing import Any, Callable, Optional
from datetime import datetime, date

from config import settings

logger = logging.getLogger("codexia.cache")

import time

# Lazy redis client instance & in-memory cache fallback
_redis_client = None
_redis_available = None
_mem_cache: dict[str, tuple[Any, float]] = {}


class JSONCustomEncoder(json.JSONEncoder):
    """Handles serialization of dates, datetimes, and complex models."""
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if hasattr(obj, "dict") and callable(obj.dict):
            return obj.dict()
        if hasattr(obj, "__dict__"):
            return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}
        return super().default(obj)


def get_redis_client():
    """Initializes and returns the Redis client or None if unavailable."""
    global _redis_client, _redis_available
    if _redis_available is False:
        return None
    if _redis_client is not None:
        return _redis_client

    if not getattr(settings, "CACHE_ENABLED", True):
        _redis_available = False
        return None

    try:
        import redis
        client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_timeout=1.0,
            socket_connect_timeout=1.0,
        )
        client.ping()
        _redis_client = client
        _redis_available = True
        logger.info(f"Connected to Redis cache at {settings.REDIS_URL}")
        return _redis_client
    except Exception:
        _redis_available = False
        logger.info("External Redis not configured/offline. Operating with high-performance in-memory caching.")
        return None


def cache_get(key: str) -> Optional[Any]:
    """Retrieve and deserialize a cached object by key."""
    client = get_redis_client()
    if client:
        try:
            data = client.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.debug(f"Cache get error for key '{key}': {e}")
        return None

    # In-memory cache fallback
    entry = _mem_cache.get(key)
    if entry:
        val, expire_at = entry
        if time.time() < expire_at:
            return val
        _mem_cache.pop(key, None)
    return None


def cache_set(key: str, value: Any, ttl: int = 300) -> bool:
    """Serialize and store a value in cache with TTL in seconds."""
    client = get_redis_client()
    if client:
        try:
            payload = json.dumps(value, cls=JSONCustomEncoder)
            return bool(client.setex(key, ttl, payload))
        except Exception as e:
            logger.debug(f"Cache set error for key '{key}': {e}")
            return False

    # In-memory cache fallback
    try:
        _mem_cache[key] = (value, time.time() + ttl)
        # Periodic pruning if memory cache grows large
        if len(_mem_cache) > 1000:
            now = time.time()
            expired = [k for k, (_, exp) in _mem_cache.items() if exp < now]
            for k in expired:
                _mem_cache.pop(k, None)
        return True
    except Exception:
        return False


def cache_delete(key: str) -> bool:
    """Delete a specific cache key."""
    client = get_redis_client()
    if client:
        try:
            client.delete(key)
        except Exception as e:
            logger.debug(f"Cache delete error for key '{key}': {e}")
    _mem_cache.pop(key, None)
    return True


def cache_invalidate_prefix(prefix: str) -> int:
    """Invalidate all keys matching the prefix pattern '{prefix}:*'."""
    deleted_count = 0
    client = get_redis_client()
    if client:
        try:
            pattern = f"{prefix}:*"
            keys = list(client.scan_iter(match=pattern, count=100))
            if keys:
                deleted_count += client.delete(*keys)
                logger.info(f"Invalidated {deleted_count} cache keys for prefix '{prefix}'")
        except Exception as e:
            logger.debug(f"Cache invalidation error for prefix '{prefix}': {e}")

    # In-memory invalidation
    mem_keys = [k for k in _mem_cache if k.startswith(f"{prefix}:")]
    for k in mem_keys:
        _mem_cache.pop(k, None)
        deleted_count += 1

    return deleted_count


def cached(prefix: str, ttl: int = 300, key_builder: Optional[Callable] = None):
    """
    Decorator for caching function or endpoint responses.
    Falls back gracefully to executing the underlying function if Redis is offline.
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # If custom key builder provided, use it; else build from kwargs
            if key_builder:
                cache_key = f"{prefix}:{key_builder(*args, **kwargs)}"
            else:
                params_str = ":".join(f"{k}={v}" for k, v in sorted(kwargs.items()) if k not in ("db", "request", "current_user"))
                cache_key = f"{prefix}:{func.__name__}:{params_str}" if params_str else f"{prefix}:{func.__name__}:all"

            # Check cache
            cached_val = cache_get(cache_key)
            if cached_val is not None:
                return cached_val

            # Cache miss — execute function
            result = func(*args, **kwargs)

            # Store result in cache
            cache_set(cache_key, result, ttl=ttl)
            return result
        return wrapper
    return decorator

"""
Elasticsearch Client and Cluster Management for Codexia LMS.
Provides resilient connectivity, automatic index creation, and availability detection.
"""

import logging
import os
from typing import Optional

logger = logging.getLogger("codexia.elasticsearch")

try:
    from elasticsearch import Elasticsearch, ConnectionError, TransportError
    ES_INSTALLED = True
except ImportError:
    ES_INSTALLED = False
    Elasticsearch = None
    ConnectionError = Exception
    TransportError = Exception

# Index constants
INDEX_COURSES = "codexia_courses"
INDEX_CODING = "codexia_coding"
INDEX_QUIZZES = "codexia_quizzes"
INDEX_NOTES = "codexia_notes"
INDEX_DISCUSSIONS = "codexia_discussions"
INDEX_USERS = "codexia_users"

ALL_INDICES = [
    INDEX_COURSES,
    INDEX_CODING,
    INDEX_QUIZZES,
    INDEX_NOTES,
    INDEX_DISCUSSIONS,
    INDEX_USERS,
]

_es_client: Optional[object] = None
_es_availability_cache: Optional[bool] = None
_last_check_time: float = 0.0


def get_es_url() -> str:
    """Retrieve Elasticsearch URL from environment with fallback."""
    env_url = os.getenv("ELASTICSEARCH_URL")
    if env_url:
        return env_url
    from config import settings
    url = getattr(settings, "ELASTICSEARCH_URL", None) or "http://elasticsearch:9200"
    if "localhost" in url:
        try:
            import socket
            socket.gethostbyname("elasticsearch")
            return "http://elasticsearch:9200"
        except Exception:
            pass
    return url


def get_es_client() -> Optional[object]:
    """Returns singleton Elasticsearch client instance."""
    global _es_client
    if not ES_INSTALLED:
        return None

    if _es_client is None:
        es_url = get_es_url()
        try:
            _es_client = Elasticsearch(
                [es_url],
                request_timeout=3.0,
                max_retries=2,
                retry_on_timeout=True
            )
        except Exception as e:
            logger.warning(f"Could not initialize Elasticsearch client at {es_url}: {e}")
            _es_client = None

    return _es_client


def is_es_available() -> bool:
    """
    Check if Elasticsearch is healthy and reachable.
    Caches result for 5 seconds to avoid frequent network ping overhead.
    """
    import time
    global _es_availability_cache, _last_check_time

    now = time.time()
    if _es_availability_cache is not None and (now - _last_check_time < 5.0):
        return _es_availability_cache

    client = get_es_client()
    if client is None:
        _es_availability_cache = False
        _last_check_time = now
        return False

    try:
        ping_ok = bool(client.ping())
        _es_availability_cache = ping_ok
    except Exception:
        _es_availability_cache = False

    _last_check_time = now
    return _es_availability_cache


# Index Mappings for each domain entity
INDEX_SCHEMAS = {
    INDEX_COURSES: {
        "mappings": {
            "properties": {
                "id": {"type": "integer"},
                "title": {"type": "text", "analyzer": "standard", "fields": {"keyword": {"type": "keyword"}}},
                "slug": {"type": "keyword"},
                "category": {"type": "keyword"},
                "difficulty": {"type": "keyword"},
                "short_description": {"type": "text"},
                "description": {"type": "text"},
                "tags": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "price": {"type": "float"},
                "instructor_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "is_published": {"type": "boolean"},
                "is_approved": {"type": "boolean"},
                "created_at": {"type": "date"}
            }
        }
    },
    INDEX_CODING: {
        "mappings": {
            "properties": {
                "id": {"type": "integer"},
                "title": {"type": "text", "analyzer": "standard", "fields": {"keyword": {"type": "keyword"}}},
                "slug": {"type": "keyword"},
                "difficulty": {"type": "keyword"},
                "tags": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "description": {"type": "text"},
                "category": {"type": "keyword"},
                "is_published": {"type": "boolean"},
                "created_at": {"type": "date"}
            }
        }
    },
    INDEX_QUIZZES: {
        "mappings": {
            "properties": {
                "id": {"type": "integer"},
                "title": {"type": "text", "analyzer": "standard", "fields": {"keyword": {"type": "keyword"}}},
                "description": {"type": "text"},
                "topic": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "course_id": {"type": "integer"},
                "course_title": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "difficulty": {"type": "keyword"},
                "passing_percentage": {"type": "integer"},
                "created_at": {"type": "date"}
            }
        }
    },
    INDEX_NOTES: {
        "mappings": {
            "properties": {
                "id": {"type": "integer"},
                "user_id": {"type": "integer"},
                "course_id": {"type": "integer"},
                "course_title": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "title": {"type": "text", "analyzer": "standard", "fields": {"keyword": {"type": "keyword"}}},
                "content": {"type": "text"},
                "is_bookmarked": {"type": "boolean"},
                "updated_at": {"type": "date"}
            }
        }
    },
    INDEX_DISCUSSIONS: {
        "mappings": {
            "properties": {
                "id": {"type": "integer"},
                "user_id": {"type": "integer"},
                "user_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "title": {"type": "text", "analyzer": "standard", "fields": {"keyword": {"type": "keyword"}}},
                "content": {"type": "text"},
                "is_doubt": {"type": "boolean"},
                "category": {"type": "keyword"},
                "course_id": {"type": "integer"},
                "created_at": {"type": "date"}
            }
        }
    },
    INDEX_USERS: {
        "mappings": {
            "properties": {
                "id": {"type": "integer"},
                "full_name": {"type": "text", "analyzer": "standard", "fields": {"keyword": {"type": "keyword"}}},
                "email": {"type": "keyword"},
                "username": {"type": "keyword"},
                "role": {"type": "keyword"},
                "is_active": {"type": "boolean"},
                "created_at": {"type": "date"}
            }
        }
    }
}


def init_indices() -> bool:
    """Creates all required indices with schema definitions if they do not exist."""
    if not is_es_available():
        logger.warning("Elasticsearch is currently unavailable. Indices will be created upon first reconnect.")
        return False

    client = get_es_client()
    success = True

    for index_name, schema in INDEX_SCHEMAS.items():
        try:
            if not client.indices.exists(index=index_name):
                client.indices.create(index=index_name, body=schema)
                logger.info(f"Created Elasticsearch index: {index_name}")
        except Exception as e:
            logger.error(f"Error creating index {index_name}: {e}")
            success = False

    return success

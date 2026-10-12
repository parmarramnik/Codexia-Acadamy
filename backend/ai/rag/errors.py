"""Light-weight RAG exception types (no numpy/torch imports), shared by every service's error handlers."""


class RagUnavailable(Exception):
    """Course retrieval is enabled but the embedding model or FAISS is not usable (HTTP 503)."""

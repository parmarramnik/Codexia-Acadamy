"""
Sentence Transformers embeddings.

The model is loaded once per process (lazily, thread-safe) and reused for every request.
Vectors are L2-normalised float32, so inner product equals cosine similarity.
There is deliberately no fallback to random vectors or keyword search: if the model cannot
load, callers get EmbeddingUnavailable with an operational message.
"""

import logging
import os
import threading
from typing import Optional, Protocol

import numpy as np

from config import settings

logger = logging.getLogger("codexia.rag.embedder")


class EmbeddingUnavailable(Exception):
    """The embedding model is not installed, cannot be downloaded, or failed to load."""


class Embedder(Protocol):
    model_name: str
    dim: int

    def encode(self, texts: list[str]) -> np.ndarray: ...


class SentenceTransformerEmbedder:
    def __init__(self, model_name: str):
        self.model_name = model_name
        cache = settings.EMBEDDING_CACHE_DIR
        if cache:
            os.makedirs(cache, exist_ok=True)
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            logger.error("sentence-transformers import failed: %s", exc)
            raise EmbeddingUnavailable(
                "sentence-transformers could not be imported: it is not installed, or its torch dependency "
                "failed to load (see backend/requirements.txt and the server log)."
            ) from exc
        try:
            self._model = SentenceTransformer(model_name, cache_folder=cache or None)
        except Exception as exc:  # network failure, bad model id, corrupt cache, out of memory
            logger.error("Embedding model %s failed to load: %s", model_name, type(exc).__name__)
            raise EmbeddingUnavailable(
                f"The embedding model '{model_name}' could not be loaded. Check the server's network access "
                "to Hugging Face, EMBEDDING_CACHE_DIR, and available memory."
            ) from exc
        self.dim = int(self._model.get_sentence_embedding_dimension())
        logger.info("Loaded embedding model %s (dim=%s)", model_name, self.dim)

    def encode(self, texts: list[str]) -> np.ndarray:
        vectors = self._model.encode(
            texts, batch_size=settings.EMBEDDING_BATCH_SIZE, convert_to_numpy=True,
            normalize_embeddings=True, show_progress_bar=False,
        )
        return np.ascontiguousarray(vectors, dtype=np.float32)


_embedder: Optional[Embedder] = None
_lock = threading.Lock()


def get_embedder() -> Embedder:
    """Return the process-wide embedder, loading it on first use."""
    global _embedder
    if _embedder is None:
        with _lock:
            if _embedder is None:
                _embedder = SentenceTransformerEmbedder(settings.EMBEDDING_MODEL)
    return _embedder


def set_embedder(embedder: Optional[Embedder]) -> None:
    """Install (or clear) the process-wide embedder. Used by tests and by startup warm-up."""
    global _embedder
    with _lock:
        _embedder = embedder


def embed_texts(texts: list[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, get_embedder().dim), dtype=np.float32)
    return get_embedder().encode(texts)


def health() -> dict:
    """Load the model (if needed) and embed one string. Never raises."""
    try:
        embedder = get_embedder()
        vector = embedder.encode(["health check"])
        return {"status": "healthy", "model": embedder.model_name, "dim": int(vector.shape[1])}
    except EmbeddingUnavailable as exc:
        return {"status": "unavailable", "detail": str(exc)}
    except Exception as exc:  # noqa: BLE001
        return {"status": "unhealthy", "detail": type(exc).__name__}

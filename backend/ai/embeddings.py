"""
Embedding and vector search using Sentence Transformers and FAISS.
Provides course-contextual retrieval for RAG-powered AI features.
Gracefully degrades if sentence-transformers or faiss-cpu is not installed.
"""

import os
from typing import Optional

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

# Lazy imports for heavy dependencies
_model = None
_index_cache = {}

EMBEDDINGS_AVAILABLE = False


def _get_embedding_model():
    """Lazy-load the sentence transformer model."""
    global _model, EMBEDDINGS_AVAILABLE
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer("all-MiniLM-L6-v2")
            EMBEDDINGS_AVAILABLE = True
        except ImportError:
            EMBEDDINGS_AVAILABLE = False
            return None
    return _model


def create_embeddings(texts: list[str]):
    """Create embeddings for a list of text strings."""
    model = _get_embedding_model()
    if model is None:
        return None
    return model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)


def build_faiss_index(texts: list[str], index_name: str = "default"):
    """Build and cache a FAISS index from a list of texts."""
    try:
        import faiss
    except ImportError:
        return None

    embeddings = create_embeddings(texts)
    if embeddings is None:
        return None

    dimension = embeddings.shape[1]
    index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity (normalized)
    index.add(embeddings.astype("float32"))

    _index_cache[index_name] = {
        "index": index,
        "texts": texts,
    }
    return index


def search_similar(
    query: str,
    index_name: str = "default",
    top_k: int = 3,
) -> list[dict]:
    """Search for similar texts in a cached FAISS index."""
    if index_name not in _index_cache:
        return []

    cache = _index_cache[index_name]
    query_embedding = create_embeddings([query])
    if query_embedding is None:
        return []

    query_embedding = query_embedding.astype("float32")
    distances, indices = cache["index"].search(query_embedding, min(top_k, len(cache["texts"])))

    results = []
    for idx, (distance, text_idx) in enumerate(zip(distances[0], indices[0])):
        if text_idx < len(cache["texts"]):
            results.append({
                "text": cache["texts"][text_idx],
                "score": float(distance),
                "rank": idx + 1,
            })
    return results


def get_relevant_context(query: str, course_content: str, top_k: int = 3) -> str:
    """
    Split course content into chunks, embed, search, and return relevant context.
    This is the main RAG retrieval function used by the AI tutor.
    Falls back to simple text truncation if embeddings are unavailable.
    """
    # Split content into paragraphs/chunks
    chunks = [chunk.strip() for chunk in course_content.split("\n\n") if chunk.strip()]
    if not chunks:
        return ""

    # Check if embedding infrastructure is available
    model = _get_embedding_model()
    if model is None:
        # Fallback: return first few chunks as context
        return "\n\n".join(chunks[:top_k])

    # Build a temporary index
    index_name = f"temp_{hash(course_content[:100])}"
    if index_name not in _index_cache:
        build_faiss_index(chunks, index_name)

    results = search_similar(query, index_name, top_k)
    return "\n\n".join(result["text"] for result in results)

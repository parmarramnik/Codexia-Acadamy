"""
AI Service entrypoint.
Port: 8005
Owns: /ai, v3_ai, /rag
"""
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from routes import ai, v3_ai, rag
from config import settings
from microservices.shared.factory import create_service_app

SERVICE_NAME = "AI Service"
SERVICE_PORT = 8005

def _checks() -> dict:
    import importlib.util
    packages = {n: importlib.util.find_spec(n) is not None for n in ("faiss", "sentence_transformers")}
    ok = not settings.RAG_ENABLED or all(packages.values())
    return {
        "ai": {"status": "healthy" if settings.GEMINI_API_KEY else "degraded", "configured": bool(settings.GEMINI_API_KEY)},
        "rag": {"status": "healthy" if ok else "degraded", "enabled": settings.RAG_ENABLED, "packages_installed": packages},
    }


def _recover() -> None:
    from ai.rag.service import recover_interrupted_documents
    recover_interrupted_documents()

app = create_service_app(
    SERVICE_NAME,
    SERVICE_PORT,
    [
        (ai.router, "/ai"),
        (v3_ai.router, ""),
        (rag.router, "/rag"),
    ],
    extra_checks=_checks,
    on_startup=_recover,
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=SERVICE_PORT)

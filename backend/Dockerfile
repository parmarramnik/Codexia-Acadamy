# ==============================================================================
# Production Multi-Stage Dockerfile for Codexia Backend
# Security Hardened: Non-root execution & minimal runner image
# ==============================================================================

FROM python:3.11-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# requirements.txt includes the other files, so all three must be copied.
# Default image = API without the ML stack (small, fits Render's free 512 MB plan; set RAG_ENABLED=false).
# Build with --build-arg INSTALL_RAG=true to add torch / FAISS / sentence-transformers for course RAG.
ARG INSTALL_RAG=false
COPY requirements-base.txt requirements-rag.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements-base.txt     && if [ "$INSTALL_RAG" = "true" ]; then pip install --no-cache-dir --prefix=/install -r requirements-rag.txt; fi

# Final stage
FROM python:3.11-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/install/bin:$PATH \
    PYTHONPATH=/install/lib/python3.11/site-packages:/app \
    PORT=8000

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -u 1001 -m appuser

# Copy installed packages from builder
COPY --from=builder /install /install
COPY . /app

# Ensure proper permissions and switch to non-root user
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]

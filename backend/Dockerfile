# =============================================================
# Roulette Analyzer — backend container image
# Used by Fly.io / Render / any other Docker-based host.
# =============================================================

FROM python:3.11-slim

# Avoid writing .pyc files and force unbuffered stdout (so logs show up live).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install system deps needed by lxml / cryptography wheels.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc libxml2-dev libxslt-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps (cached layer if requirements.txt didn't change)
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy the rest of the code
COPY . .

# Fly.io exposes port 8080 by default; we listen on $PORT or fall back to 8080.
ENV PORT=8080
EXPOSE 8080

# Use uvicorn directly (no --reload in production).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]

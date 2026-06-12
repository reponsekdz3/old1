# Multi-stage build for production-ready VipChat
# Stage 1: Build React web app
FROM node:20-alpine AS web-builder
WORKDIR /app/web

# Install all deps (including devDependencies needed for the build)
COPY web/package*.json ./
RUN npm ci --ignore-scripts

COPY web/ ./
RUN npm run build

# Stage 2: Python backend + bundled frontend
FROM python:3.11-slim AS backend
WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libpq-dev libssl-dev libffi-dev python3-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn gevent-websocket

# Backend source
COPY backend/ .

# Copy built React app into backend static dir (Flask will serve it)
COPY --from=web-builder /app/web/build ./static

# APK release directory (mount or copy your APK here)
RUN mkdir -p uploads/releases

ENV FLASK_APP=run.py
ENV PYTHONUNBUFFERED=1
ENV WORKERS=4

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:8000 --workers ${WORKERS:-4} --worker-class geventwebsocket.gunicorn.workers.GeventWebSocketWorker --timeout 120 --access-logfile - --error-logfile - wsgi:app"]

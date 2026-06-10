# Multi-stage build for production-ready VipChat
FROM node:18-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci --only=production
COPY web/ ./
RUN npm run build

FROM node:18-alpine AS mobile-builder
WORKDIR /app/mobile
COPY mobile/package*.json ./
RUN npm ci
COPY mobile/ ./

FROM python:3.11-slim AS backend
WORKDIR /app
RUN apt-get update && apt-get install -y \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn gevent-websocket

COPY backend/ .
COPY --from=web-builder /app/web/build ./static

ENV FLASK_APP=run.py
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--worker-class", "geventwebsocket.gunicorn.workers.GeventWebSocketWorker", "--timeout", "120", "wsgi:app"]

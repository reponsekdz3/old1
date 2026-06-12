#!/bin/bash
set -e

echo "=== Starting VipChat ==="

# Start backend in background on port 8000
echo "[1/2] Starting backend on :8000..."
cd backend
python run.py &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
for i in {1..30}; do
  if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "    Backend ready!"
    break
  fi
  echo "    Waiting for backend... ($i/30)"
  sleep 2
done

# Start frontend on port 5000 with host check disabled for Replit proxy
echo "[2/2] Starting frontend on :5000..."
cd web
HOST=0.0.0.0 PORT=5000 BROWSER=none DANGEROUSLY_DISABLE_HOST_CHECK=true npm start

# Cleanup on exit
wait $BACKEND_PID

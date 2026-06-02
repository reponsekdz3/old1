#!/bin/bash
set -e

echo "=== Starting RedOrrange ==="

# Install backend dependencies
echo "[1/3] Installing backend dependencies..."
cd backend
pip install -r requirements.txt -q 2>&1 | tail -3
cd ..

# Install frontend dependencies
echo "[2/3] Installing frontend dependencies..."
cd frontend
npm install --legacy-peer-deps --silent 2>&1 | tail -3
cd ..

# Start backend in background
echo "[3/3] Starting backend on :8000..."
cd backend
python run.py &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
for i in {1..20}; do
  if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "    Backend ready!"
    break
  fi
  sleep 1
done

# Start frontend on port 5000
echo "     Starting frontend on :5000..."
cd frontend
PORT=5000 BROWSER=none npm start

# Cleanup on exit
wait $BACKEND_PID

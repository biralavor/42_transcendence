#!/bin/sh
set -e

echo "[entrypoint] Running Alembic migrations for game-service..."
cd /app/service
alembic upgrade head
echo "[entrypoint] Migrations complete. Starting uvicorn..."

cd /app
exec uvicorn service.main:app \
    --host 0.0.0.0 \
    --port "${GAME_SERVICE_PORT:-8002}" \
    --reload \
    --reload-dir /app/service \
    --reload-dir /app/shared

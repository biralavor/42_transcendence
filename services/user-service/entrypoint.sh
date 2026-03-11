#!/bin/sh
set -e

echo "[entrypoint] Running Alembic migrations for user-service..."
cd /app/service
alembic upgrade head
echo "[entrypoint] Migrations complete. Starting uvicorn..."

cd /app
exec uvicorn service.main:app \
    --host 0.0.0.0 \
    --port "${USER_SERVICE_PORT:-8001}" \
    --reload \
    --reload-dir /app/service \
    --reload-dir /app/shared

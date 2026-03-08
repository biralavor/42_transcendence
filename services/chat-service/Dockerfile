FROM backend-base

WORKDIR /app

COPY --chown=appuser:appgroup src/backend/chat-service/requirements.txt ./service-requirements.txt
RUN pip install --no-cache-dir -r service-requirements.txt 2>/dev/null || true

COPY --chown=appuser:appgroup src/backend/shared/ /app/shared/
COPY --chown=appuser:appgroup src/backend/chat-service/ /app/service/

EXPOSE 8003

CMD ["sh", "-c", "uvicorn service.main:app --host 0.0.0.0 --port ${CHAT_SERVICE_PORT:-8003} --reload --reload-dir /app/service --reload-dir /app/shared"]

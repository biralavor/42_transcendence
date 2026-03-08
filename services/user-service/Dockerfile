FROM backend-base

WORKDIR /app

COPY --chown=appuser:appgroup src/backend/user-service/requirements.txt ./service-requirements.txt
RUN pip install --no-cache-dir -r service-requirements.txt

COPY --chown=appuser:appgroup src/backend/shared/ /app/shared/
COPY --chown=appuser:appgroup src/backend/user-service/ /app/service/

EXPOSE 8001

CMD ["sh", "-c", "uvicorn service.main:app --host 0.0.0.0 --port ${USER_SERVICE_PORT:-8001} --reload --reload-dir /app/service --reload-dir /app/shared"]

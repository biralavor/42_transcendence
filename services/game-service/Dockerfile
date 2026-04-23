FROM backend-base

WORKDIR /app

COPY --chown=appuser:appgroup src/backend/game-service/requirements.txt ./service-requirements.txt
RUN pip install --no-cache-dir -r service-requirements.txt

COPY --chown=appuser:appgroup src/backend/shared/ /app/shared/
COPY --chown=appuser:appgroup src/backend/game-service/ /app/service/

COPY services/game-service/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8002

ENTRYPOINT ["/entrypoint.sh"]

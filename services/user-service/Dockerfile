FROM backend-base

WORKDIR /app

COPY --chown=appuser:appgroup src/backend/user-service/requirements.txt ./service-requirements.txt
RUN pip install --no-cache-dir -r service-requirements.txt

COPY --chown=appuser:appgroup src/backend/shared/ /app/shared/
COPY --chown=appuser:appgroup src/backend/user-service/ /app/service/

COPY services/user-service/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8001

ENTRYPOINT ["/entrypoint.sh"]

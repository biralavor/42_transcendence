FROM backend-base

WORKDIR /app

COPY --chown=appuser:appgroup src/backend/chat-service/requirements.txt ./service-requirements.txt
RUN pip install --no-cache-dir -r service-requirements.txt

COPY --chown=appuser:appgroup src/backend/shared/ /app/shared/
COPY --chown=appuser:appgroup src/backend/chat-service/ /app/service/

COPY services/chat-service/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8003

ENTRYPOINT ["/entrypoint.sh"]

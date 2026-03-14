FROM python:3.12-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY src/backend/shared/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

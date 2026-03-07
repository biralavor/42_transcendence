#!/bin/sh
# Generate self-signed cert at container start using the configured DOMAIN.
# This ensures CN and SAN match whatever DOMAIN is set to in .env.
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx.key \
    -out    /etc/nginx/ssl/nginx.crt \
    -subj   "/C=FR/ST=IDF/L=Paris/O=42/CN=${DOMAIN}" \
    -addext "subjectAltName=DNS:${DOMAIN}"

# Substitute BACKEND_PORT, FRONTEND_PORT, DOMAIN — leave nginx vars ($host, $remote_addr, etc.) intact.
envsubst '${BACKEND_PORT} ${FRONTEND_PORT} ${DOMAIN}' \
    < /etc/nginx/nginx.conf.template \
    > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'

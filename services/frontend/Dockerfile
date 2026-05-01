# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY src/frontend/package*.json ./
RUN npm install
COPY src/frontend/ .
RUN npm run build

# Stage 2: serve
FROM nginx:1.28-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY services/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000

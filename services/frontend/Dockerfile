FROM node:20-alpine

WORKDIR /app

COPY src/frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY src/frontend/ .

EXPOSE 3000

CMD ["npm", "run", "dev"]

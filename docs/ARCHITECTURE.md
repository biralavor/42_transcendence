# Architecture — ft_transcendence

## System Diagram

```
                    ┌─────────────────────────────────────────────────────────┐
                    │              transcendence_network  (bridge)             │
                    │                                                          │
Host port 8080 ────►│  nginx (HTTP → redirect to HTTPS)                        │
Host port 8443 ────►│  nginx (HTTPS)                                           │
                    │    ├──/api/users/──► user-service:8001 ──► db:5432       │
                    │    ├──/api/game/───► game-service:8002 ──► db:5432       │
                    │    ├──/api/chat/───► chat-service:8003 ──► db:5432       │
                    │    │                         (PostgreSQL 16)             │
                    │    └──/*──────────► frontend:3000  (React/Vite)         │
                    │                                                          │
Host port 8888 ────►│  adminer:8080  ──────────────────────► db:5432          │
                    └─────────────────────────────────────────────────────────┘
```

## Services

| Container | Base image | Internal port | Host port | Role |
|-----------|-----------|---------------|-----------|------|
| `db` | `postgres:16-alpine` | 5432 | none | PostgreSQL database |
| `user-service` | `backend-base` | 8001 | none | User management, auth, profiles |
| `game-service` | `backend-base` | 8002 | none | Pong, tournament, AI opponent |
| `chat-service` | `backend-base` | 8003 | none | Real-time chat, WebSockets |
| `frontend` | `node:20-alpine` | 3000 | none | React app (Vite dev server) |
| `nginx` | `nginx:1.28.2-alpine` | 80, 443 | **8080**, **8443** | TLS + reverse proxy |
| `adminer` | `adminer:latest` | 8080 | **8888** | Database management UI |

## nginx Routing

The `/api/<service>/` prefix is stripped by nginx before reaching each FastAPI service.
FastAPI routes must NOT include the prefix.

| Request path | Upstream | FastAPI route |
|---|---|---|
| `/api/users/health` | `user-service:8001` | `/health` |
| `/api/users/auth/register` | `user-service:8001` | `/auth/register` |
| `/api/game/health` | `game-service:8002` | `/health` |
| `/api/chat/health` | `chat-service:8003` | `/health` |
| `/*` | `frontend:3000` | — |

> Upstream ports are defaults — actual values driven by `USER_SERVICE_PORT`, `GAME_SERVICE_PORT`, `CHAT_SERVICE_PORT` env vars.

## Volume Mapping

| Type | Host path | Container path | Contents |
|------|-----------|---------------|----------|
| Named volume | `db_data` | `/var/lib/postgresql/data` | PostgreSQL data |
| Bind mount | `./src/frontend/` | `/app/` | React source + Vite dev server |
| Anonymous volume | (Docker-managed) | `/app/node_modules` | Protects container's npm packages from host bind mount |
| Bind mount | `./src/backend/user-service/` | `/app/service/` | user-service source |
| Bind mount | `./src/backend/game-service/` | `/app/service/` | game-service source |
| Bind mount | `./src/backend/chat-service/` | `/app/service/` | chat-service source |
| Bind mount | `./src/backend/shared/` | `/app/shared/` | Shared utilities (all services) |

> **Why db uses a named volume:** `sgoinfre` is NFS — PostgreSQL's `chown` on startup fails on NFS.
> Named volumes live in `/var/lib/docker/volumes/` on local disk where `chown` works.

## Key Rules

- **nginx** is the sole TLS termination point. HTTPS traffic enters on port 8443; HTTP on port 8080 redirects to HTTPS.
- **Microservices** are never directly exposed — nginx proxies by URL prefix.
- **db** has no host port binding — internal only.
- **Shared code** (`src/backend/shared/`) is bind-mounted into every service at `/app/shared/`.

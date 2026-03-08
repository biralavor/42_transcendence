# Developer Documentation — ft_transcendence

## Prerequisites

Install the following tools before setting up the project:

| Tool | Minimum version | Check |
|------|----------------|-------|
| Docker Engine | 24.x | `docker --version` |
| Docker Compose v2 | 2.x | `docker compose version` |
| GNU Make | 4.x | `make --version` |
| OpenSSL | 3.x | `openssl version` |
| Git | 2.x | `git --version` |

> On 42 school machines all tools are pre-installed.

---

## First-Time Setup

### 1. Clone the repository

```bash
git clone <repo-url> ft_transcendence
cd ft_transcendence
```

### 2. Create `.env`

```bash
cp .env.example .env
$EDITOR .env        # fill in every credential before running make
```

The file is **never committed** (covered by `.gitignore`).

### 3. Review `.env`

| Variable | Example value | Purpose |
|----------|--------------|---------|
| `DB_HOST` | `db` | PostgreSQL hostname (matches container name) |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `transcendence_user` | Database user |
| `DB_PASSWORD` | *(your choice)* | Database password |
| `DB_NAME` | `transcendence_db` | Database name |
| `USER_SERVICE_PORT` | `8001` | user-service internal port |
| `GAME_SERVICE_PORT` | `8002` | game-service internal port |
| `CHAT_SERVICE_PORT` | `8003` | chat-service internal port |
| `FRONTEND_PORT` | `3000` | React dev server internal port |
| `DOMAIN` | `localhost` | Domain for nginx and health checks |

### 4. Start the stack

```bash
make
```

What happens:
1. Docker builds the `backend-base` image then the per-service images from `services/*/Dockerfile` (`adminer` uses a pre-built image)
2. `db` starts first — PostgreSQL runs `init.sql` creating the `users` table
3. `user-service`, `game-service`, `chat-service` wait for `db` to be healthy, then each starts FastAPI on its own port (8001, 8002, 8003)
4. `frontend` starts the Vite dev server on port 3000
5. `adminer` waits for `db` to be healthy, then starts on host port **8888**
6. `nginx` generates a self-signed TLS cert for `$DOMAIN` (CN + SAN) and starts on port 443

Visit **https://localhost** (click through the self-signed certificate warning).

### Adminer — Database Management UI

Open **http://localhost:8888** and login with:

| Field | Value |
|-------|-------|
| System | PostgreSQL |
| Server | `db` |
| Username | `DB_USER` from `.env` |
| Password | `DB_PASSWORD` from `.env` |
| Database | `DB_NAME` from `.env` |

---

## Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │              transcendence_network  (bridge)             │
                    │                                                          │
Host port 8443 ────►│  nginx                                                   │
                    │    ├──/api/users/──► user-service:8001  (FastAPI/uvicorn)│
                    │    │                        │                            │
                    │    ├──/api/game/───► game-service:8002  (FastAPI/uvicorn)│
                    │    │                        │                            │
                    │    ├──/api/chat/───► chat-service:8003  (FastAPI/uvicorn)│
                    │    │                        │                            │
                    │    │                        └──────► db:5432             │
                    │    │                                 (PostgreSQL 16)     │
                    │    └──/*──────────► frontend:3000   (React/Vite)        │
                    │                                                          │
Host port 8888 ────►│  adminer:8080  ──────────────────► db:5432              │
                    └─────────────────────────────────────────────────────────┘

Named volume:  db_data  →  /var/lib/postgresql/data  (persists across restarts)
```

- **nginx** is the sole TLS termination point. All traffic enters on port 443.
- The `/api/<service>/` prefix is stripped by nginx before reaching each FastAPI service.
  FastAPI routes must NOT include the prefix (e.g. `@app.get("/health")`, not `@app.get("/api/users/health")`).
- **Microservices** are never directly exposed — nginx proxies to them by URL prefix.
- **db** is internal only: no host port binding.
- **Shared code** (`src/backend/shared/`) is bind-mounted into every service container at `/app/shared/`.

---

## Build & Launch

All commands run from the **repository root**.

| Command | Action |
|---------|--------|
| `make` | Build images + start all containers |
| `make down` | Stop and remove containers |
| `make clean` | Stop containers + remove orphans |
| `make fclean` | Full clean: containers + volumes + images |
| `make re` | `fclean` then `make` |
| `make logs` | Tail all container logs |
| `make ps` | Show container status |
| `make check` | Run health check, save report to `release.txt` |
| `make windows` | Same as `make` — for GNU Make on Windows (Git Bash/WSL) |
| `make build-base` | Build the `backend-base` image (run once, or after shared deps change) |
| `make up-frontend` | Rebuild and restart the frontend container only |
| `make down-frontend` | Stop and remove the frontend container only |
| `make re-front` | Full reset of frontend container (no-cache rebuild) |
| `make re-back` | Full reset of all 3 backend services (no-cache rebuild) |
| `make up-user` | Rebuild and restart user-service only |
| `make down-user` | Stop and remove user-service only |
| `make re-user` | Full reset of user-service (no-cache rebuild) |
| `make up-game` | Rebuild and restart game-service only |
| `make down-game` | Stop and remove game-service only |
| `make re-game` | Full reset of game-service (no-cache rebuild) |
| `make up-chat` | Rebuild and restart chat-service only |
| `make down-chat` | Stop and remove chat-service only |
| `make re-chat` | Full reset of chat-service (no-cache rebuild) |

**Windows users (no GNU Make):**

| Shell | Syntax |
|-------|--------|
| CMD | `make.bat up` |
| PowerShell | `.\make.bat up` |

```bat
:: CMD
make.bat up       :: build + start
make.bat down     :: stop
make.bat fclean   :: full clean
make.bat re       :: fclean + up
make.bat check    :: run health check

:: PowerShell
.\make.bat up
.\make.bat down
.\make.bat fclean
.\make.bat re
.\make.bat check
```

---

## Services Overview

| Container | Base image | Internal port | Host port | Role |
|-----------|-----------|---------------|-----------|------|
| `db` | `postgres:16-alpine` | 5432 | none | PostgreSQL database |
| `user-service` | `backend-base` | 8001 | none | User management, auth, profiles |
| `game-service` | `backend-base` | 8002 | none | Pong, tournament, AI opponent |
| `chat-service` | `backend-base` | 8003 | none | Real-time chat, WebSockets |
| `frontend` | `node:20-alpine` | 3000 | none | React app (Vite dev server) |
| `nginx` | `nginx:1.28.2-alpine` | 80, 443 | **8080**, **8443** | TLS + reverse proxy |
| `adminer` | `adminer:latest` | 8080 | **8888** | Database management UI |

`backend-base` image (`services/backend-base/Dockerfile`) installs all shared Python deps once — per-service images extend it without reinstalling the shared layer.

---

## Package Management

### Adding a shared dependency (all services)

```bash
# 1. Add to the shared requirements file
echo "httpx==0.27.0" >> src/backend/shared/requirements.txt

# 2. Rebuild the base image
make build-base

# 3. Restart all services to pick up the new base
make re
```

### Adding a service-specific dependency

```bash
# 1. Add to the service requirements file
echo "stripe==10.0.0" >> src/backend/user-service/requirements.txt

# 2. Rebuild only that service
make up-user    # or up-game / up-chat
```

### Adding a frontend dependency (npm)

```bash
cd src/frontend
npm install react-router-dom   # updates package.json + package-lock.json
cd ../..

make up-frontend
```

### Developer workflow summary

| Scenario | Command |
|----------|---------|
| New `.py` file in a service | Nothing — uvicorn `--reload` picks it up via bind mount |
| New dep in a service `requirements.txt` | `make up-<service>` |
| Broken container / env var change | `make re-<service>` |
| New shared dep in `shared/requirements.txt` | `make build-base` → `make re` |

> Use `make re-<service>` when you need a **full container reset** (e.g. environment variable changes, broken container state).

---

## Container Management

### Open a shell inside a container

```bash
docker exec -it db sh
docker exec -it user-service sh
docker exec -it game-service sh
docker exec -it chat-service sh
docker exec -it frontend sh
docker exec -it nginx sh
docker exec -it adminer sh
```

### Restart a single service

```bash
docker compose restart user-service
docker compose restart game-service
docker compose restart chat-service
```

### View logs for one service

```bash
docker compose logs -f user-service
docker compose logs -f game-service
docker compose logs -f nginx
```

### Inspect a container

```bash
docker inspect user-service
docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' nginx
```

---

## Volume Management

| Type | Name / Host path | Container path | Contents |
|------|-----------------|---------------|----------|
| Named volume | `db_data` | `/var/lib/postgresql/data` | PostgreSQL database files |
| Bind mount | `./src/frontend/` | `/app/` | React source + Vite dev server |
| Bind mount | `./src/backend/user-service/` | `/app/service/` | user-service source (uvicorn --reload) |
| Bind mount | `./src/backend/game-service/` | `/app/service/` | game-service source (uvicorn --reload) |
| Bind mount | `./src/backend/chat-service/` | `/app/service/` | chat-service source (uvicorn --reload) |
| Bind mount | `./src/backend/shared/` | `/app/shared/` | Shared utilities, mounted into all 3 services |

**Why the DB uses a named volume:** `sgoinfre` is an NFS network filesystem. PostgreSQL's entrypoint runs `chown` on its data directory at startup, which NFS does not permit. Named volumes are stored in `/var/lib/docker/volumes/` on local disk, where `chown` works correctly.

```bash
# Inspect the DB named volume
docker volume inspect transcendence_db_data

# Wipe DB data (only needed after schema changes or credential reset)
make fclean
```

Stopping containers (`make down`) does **not** delete data — only `make fclean` removes the named volume.

---

## Health Check

```bash
# Interactive (coloured output)
bash tests/TranscendenceHealthCheck.sh

# Save colour-stripped report to release.txt
make check
cat release.txt
```

The script runs 15 check sections covering containers, TLS, ports, network, DB, API endpoints, Dockerfile safety, and secrets. Exit code 0 = all checks passed.

---

## GitHub Actions

Workflows live in `.github/workflows/`.

| File | Trigger | What it does |
|------|---------|--------------|
| `labeler.yml` | PR opened / updated | Auto-applies labels based on branch name and changed file paths (rules in `.github/labeler.yml`) |
| `close-issue-on-merge-to-develop.yml` | PR merged → `develop` | Parses the PR body for closing keywords and closes the linked issue(s) |

### Closing issues automatically

Add a closing keyword in the PR body referencing the issue number:

```
Closes #42
Fixes #10
Resolves #7
```

Accepted keywords (case-insensitive): `Close`, `Closes`, `Closed`, `Fix`, `Fixes`, `Fixed`, `Resolve`, `Resolves`, `Resolved`.

> **Why not `closingIssuesReferences` (GraphQL)?**
> GitHub's built-in API only resolves linked issues when a PR targets the **default branch** (`main`).
> Since our PRs merge into `develop`, the workflow parses the PR body directly instead.

---

## Live Reload

All services mount their source directories as bind mounts, so **code changes on the host are reflected inside the running container immediately** — no rebuild required.

| Service | Mechanism | What triggers reload |
|---------|-----------|----------------------|
| `user-service` | uvicorn `--reload` watches `/app/service/` and `/app/shared/` | Any `.py` save in `src/backend/user-service/` or `src/backend/shared/` |
| `game-service` | uvicorn `--reload` watches `/app/service/` and `/app/shared/` | Any `.py` save in `src/backend/game-service/` or `src/backend/shared/` |
| `chat-service` | uvicorn `--reload` watches `/app/service/` and `/app/shared/` | Any `.py` save in `src/backend/chat-service/` or `src/backend/shared/` |
| `frontend` | Vite HMR watches `/app/src/` | Any `.jsx` / `.css` save in `src/frontend/` |

```
Host                              Container
src/backend/user-service/  ──►   /app/service/   ← uvicorn --reload watches here
src/backend/shared/        ──►   /app/shared/    ← shared utilities, also watched
src/frontend/              ──►   /app/           ← Vite HMR watches here
```

> `node_modules/` inside the frontend container is protected by an anonymous Docker volume (`/app/node_modules`) declared in `docker-compose.yml`. The bind-mounted `./src/frontend/` never overrides the container's installed packages.

**When you still need `make up-<service>`:**
- Added a new pip package to a service's `requirements.txt`
- Added a new npm package to `src/frontend/package.json`

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `user/game/chat-service` exits immediately | DB not ready | Check `make logs` — increase healthcheck `retries` in compose |
| `nginx` 502 Bad Gateway | Service crashed at startup | Run `make logs` — check for `ModuleNotFoundError` or import errors in the failing service |
| Port 443 already in use | Another process on host | `sudo lsof -i :443` and stop it |
| `make: *** missing separator` | Spaces instead of tabs in Makefile | Replace recipe indentation with real tab characters |
| TLS certificate warning in browser | Self-signed cert (expected) | Click "Advanced" → "Proceed to localhost" |
| `docker compose config` errors | Invalid `.env` or compose syntax | Run `docker compose config` to see the error |
| DB password wrong after `make re` | Old volume with different password | Run `make fclean` to wipe the volume, then `make` |

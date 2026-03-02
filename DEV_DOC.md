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
| `BACKEND_PORT` | `8080` | FastAPI internal port |
| `FRONTEND_PORT` | `3000` | React dev server internal port |
| `DOMAIN` | `localhost` | Domain for nginx and health checks |

### 4. Start the stack

```bash
make
```

What happens:
1. Docker builds all 4 images from `services/*/Dockerfile`
2. `db` starts first — PostgreSQL runs `init.sql` creating the `users` table
3. `backend` waits for `db` to be healthy, then starts FastAPI on port 8080
4. `frontend` starts the Node.js stub on port 3000
5. `nginx` generates a self-signed TLS cert and starts on port 443

Visit **https://localhost** (click through the self-signed certificate warning).

---

## Architecture

```
                    ┌─────────────────────────────────────────────────┐
                    │         transcendence_network  (bridge)          │
                    │                                                  │
Host port 443 ─────►│  nginx                                           │
                    │    ├──/api/*──► backend:8080  (FastAPI/uvicorn)  │
                    │    │                │                            │
                    │    │                └──────► db:5432             │
                    │    │                         (PostgreSQL 16)     │
                    │    └──/*──────► frontend:3000 (React/Node.js)   │
                    └─────────────────────────────────────────────────┘

Named volume:  db_data  →  /var/lib/postgresql/data  (persists across restarts)
```

- **nginx** is the sole TLS termination point. All traffic enters on port 443.
- **backend** and **frontend** are never directly exposed — nginx proxies to them.
- **db** is internal only: no host port binding.
- `/api/*` requests have the `/api` prefix stripped before reaching FastAPI.
  FastAPI routes must be defined without `/api` (e.g. `@app.get("/health")`, not `@app.get("/api/health")`).

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

**Windows CMD users (no GNU Make):**

```bat
make.bat up       :: build + start
make.bat down     :: stop
make.bat fclean   :: full clean
make.bat re       :: fclean + up
```

---

## Services Overview

| Container | Base image | Internal port | Host port | Role |
|-----------|-----------|---------------|-----------|------|
| `db` | `postgres:16-alpine` | 5432 | none | PostgreSQL database |
| `backend` | `python:3.12-alpine` | 8080 | none | FastAPI + uvicorn |
| `frontend` | `node:20-alpine` | 3000 | none | React app |
| `nginx` | `nginx:alpine` | 443 | **443** | TLS + reverse proxy |

---

## Container Management

### Open a shell inside a container

```bash
docker exec -it db sh
docker exec -it backend sh
docker exec -it frontend sh
docker exec -it nginx sh
```

### Restart a single service

```bash
docker compose restart backend
```

### View logs for one service

```bash
docker compose logs -f backend
docker compose logs -f nginx
```

### Inspect a container

```bash
docker inspect backend
docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' nginx
```

---

## Volume Management

All persistent data lives in the named Docker volume `db_data`:

| Volume | Container path | Contents |
|--------|---------------|----------|
| `db_data` | `/var/lib/postgresql/data` | PostgreSQL database files |

Named volumes (unlike bind mounts) work identically on Linux and Windows Docker Desktop.

```bash
# List volumes
docker volume ls | grep db_data

# Inspect volume
docker volume inspect 42_transcendence_db_data
```

Stopping containers (`make down`) does **not** delete data — only `make fclean` removes the volume.

---

## Health Check

```bash
# Interactive (coloured output)
bash TranscendenceHealthCheck.sh

# Save colour-stripped report to release.txt
make check
cat release.txt
```

The script runs 15 check sections covering containers, TLS, ports, network, DB, API endpoints, Dockerfile safety, and secrets. Exit code 0 = all checks passed.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `backend` exits immediately on start | DB not ready | Check `make logs` — increase healthcheck `retries` in compose |
| `nginx` 502 Bad Gateway | backend/frontend not yet up | Wait 10s, retry; run `make logs` |
| Port 443 already in use | Another process on host | `sudo lsof -i :443` and stop it |
| `make: *** missing separator` | Spaces instead of tabs in Makefile | Replace recipe indentation with real tab characters |
| TLS certificate warning in browser | Self-signed cert (expected) | Click "Advanced" → "Proceed to localhost" |
| `docker compose config` errors | Invalid `.env` or compose syntax | Run `docker compose config` to see the error |
| DB password wrong after `make re` | Old volume with different password | Run `make fclean` to wipe the volume, then `make` |

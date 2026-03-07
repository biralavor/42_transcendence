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
| `BACKEND_PORT` | `8080` | FastAPI internal port (uvicorn bind port + nginx proxy target) |
| `FRONTEND_PORT` | `3000` | React dev server internal port (node bind port + nginx proxy target) |
| `DOMAIN` | `localhost` | Domain for nginx and health checks |

### 4. Start the stack

```bash
make
```

What happens:
1. Docker builds 4 images from `services/*/Dockerfile` (`adminer` uses a pre-built image)
2. `db` starts first — PostgreSQL runs `init.sql` creating the `users` table
3. `backend` waits for `db` to be healthy, then starts FastAPI on port 8080
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
                    ┌─────────────────────────────────────────────────┐
                    │         transcendence_network  (bridge)          │
                    │                                                  │
Host port 443 ─────►│  nginx                                           │
                    │    ├──/api/*──► backend:8080  (FastAPI/uvicorn)  │
                    │    │                │                            │
                    │    │                └──────► db:5432             │
                    │    │                         (PostgreSQL 16)     │
                    │    └──/*──────► frontend:3000 (React/Vite)      │
                    │                                                  │
Host port 8888 ────►│  adminer:8080  ──────────► db:5432              │
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
| `make build-backend` | Rebuild and restart the backend container only |
| `make build-frontend` | Rebuild and restart the frontend container only |

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
| `backend` | `python:3.12-alpine` | 8080 | none | FastAPI + uvicorn |
| `frontend` | `node:20-alpine` | 3000 | none | React app (Vite dev server) |
| `nginx` | `nginx:1.28.2-alpine` | 80, 443 | **8080**, **8443** | TLS + reverse proxy |
| `adminer` | `adminer:latest` | 8080 | **8888** | Database management UI |

---

## Package Management

### Adding a backend dependency (pip)

```bash
# 1. Add the package to the requirements file
echo "requests==2.32.3" >> src/backend/requirements.txt

# 2. Rebuild only the backend
make build-backend
```

### Adding a frontend dependency (npm)

```bash
# 1. Add the package to package.json
#    (edit manually or run npm install locally if Node.js is available on your host)
cd src/frontend
npm install react-router-dom   # updates package.json + package-lock.json
cd ../..

# 2. Rebuild only the frontend
make build-frontend
```

> `make build-backend` / `make build-frontend` are only needed when **adding new packages**.
> For regular code edits, live reload picks up changes automatically — see [Live Reload](#live-reload) below.

---

## Container Management

### Open a shell inside a container

```bash
docker exec -it db sh
docker exec -it backend sh
docker exec -it frontend sh
docker exec -it nginx sh
docker exec -it adminer sh
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

# Inspect volume (name is prefixed by the clone directory name)
docker volume inspect $(docker volume ls -q | grep db_data)
```

Stopping containers (`make down`) does **not** delete data — only `make fclean` removes the volume.

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

## Live Reload

Both `backend` and `frontend` mount their source directories as Docker volumes, so **code changes on the host are reflected inside the running container immediately** — no rebuild required.

| Service | Mechanism | What triggers reload |
|---------|-----------|----------------------|
| `backend` | uvicorn `--reload` watches `/app/*.py` | Any `.py` file save in `src/backend/` |
| `frontend` | Vite HMR watches `/app/src/` | Any `.jsx` / `.css` file save in `src/frontend/` |

```
Host                         Container
src/backend/   ──volume──►  /app/   ← uvicorn --reload watches here
src/frontend/  ──volume──►  /app/   ← Vite HMR watches here
```

> `node_modules/` inside the frontend container is protected by an anonymous volume — the host directory never overrides it.

**When you still need `make build-backend` / `make build-frontend`:**
- Added a new pip package to `src/backend/requirements.txt`
- Added a new npm package to `src/frontend/package.json`

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

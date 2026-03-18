# Developer Documentation — ft_transcendence

> See also: [ARCHITECTURE.md](ARCHITECTURE.md) · [MICROSERVICES.md](MICROSERVICES.md) · [CONTRIBUTING.md](CONTRIBUTING.md)
>
> Deep-dives: [about/ABOUT_AUTHENTICATION.md](about/ABOUT_AUTHENTICATION.md) · [about/About_webSockets.md](about/About_webSockets.md)

## Prerequisites

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
| `make wait` | Poll health endpoints until all 3 services respond 200 (60s timeout) |
| `make check` | Wait for services, run full health check, save report to `release.txt` |
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

---

## Health Check

```bash
make check          # waits for all services, then runs the full check and saves release.txt
make wait           # just waits — useful before other commands that need services up
```

`make check` automatically calls `make wait` first, so it is safe to run immediately after `make`. The wait target polls `user-service`, `game-service`, and `chat-service` health endpoints every 2 seconds and exits once all three return HTTP 200. Timeout is 60 seconds.

The report is saved to `release.txt` (ANSI colours stripped) and also printed to the terminal.

---

## Open a Shell Inside a Container

```bash
docker exec -it db sh
docker exec -it user-service sh
docker exec -it game-service sh
docker exec -it chat-service sh
docker exec -it frontend sh
docker exec -it nginx sh
docker exec -it adminer sh
```

---

## Adding a New Database Table

All schema changes **must** go through Alembic migrations. Never use `SQLModel.metadata.create_all()` or `Base.metadata.create_all()` in application code — those bypass migration history and cause drift between environments.

### Step-by-step

**1. Define the model** in the service's `models/` directory using SQLAlchemy `Base`:

```python
# src/backend/user-service/models/my_model.py
from sqlalchemy import Column, Integer, String
from shared.database import Base

class MyModel(Base):
    __tablename__ = "my_table"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
```

> Primary keys intended for DB autoincrement must **not** be required fields.
> Use `nullable=False` for required columns and `unique=True` for natural keys.

**2. Import the model** in the service's `models/__init__.py` so Alembic's `env.py` can see it:

```python
from .my_model import MyModel  # noqa: F401
```

**3. Generate the migration** (service must be running):

```bash
make migrate-user MSG=add_my_table
# or for other services:
make migrate-game MSG=add_my_table
make migrate-chat MSG=add_my_table
```

This creates a new file in `alembic/versions/`. Always review it before applying.

**4. Apply the migration**:

```bash
make migrate-upgrade
```

The entrypoint (`services/<service>/entrypoint.sh`) also runs `alembic upgrade head` automatically on container start, so a `make re-user` (or equivalent) is enough in most workflows.

**5. Verify**:

```bash
make show-tables       # lists all tables
make db-dump           # shows full content of every table
```

### Rules

| Rule | Why |
|------|-----|
| Never call `create_all()` in app code | Bypasses migration history; table won't exist in other envs |
| Always review generated migration files | Autogenerate can miss constraints or produce wrong SQL |
| One concern per migration | Easier to revert; cleaner git history |
| Downgrade must undo upgrade completely | Required for safe rollbacks |
| Never edit a migration that has already been applied in production | Create a new migration instead |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `make check` WebSocket tests fail right after `make` | Services still starting up | `make check` calls `make wait` automatically; if it still fails, run `make logs` to check for import errors |
| `user/game/chat-service` exits immediately | DB not ready | Check `make logs` — increase healthcheck `retries` in compose |
| `nginx` 502 Bad Gateway | Service crashed at startup | Run `make logs` — check for `ModuleNotFoundError` or import errors in the failing service |
| Port 443 already in use | Another process on host | `sudo lsof -i :443` and stop it |
| `make: *** missing separator` | Spaces instead of tabs in Makefile | Replace recipe indentation with real tab characters |
| TLS certificate warning in browser | Self-signed cert (expected) | Click "Advanced" → "Proceed to localhost" |
| `docker compose config` errors | Invalid `.env` or compose syntax | Run `docker compose config` to see the error |
| DB password wrong after `make re` | Old volume with different password | Run `make fclean` to wipe the volume, then `make` |

# Developer Documentation — ft_transcendence

> See also: [ARCHITECTURE.md](ARCHITECTURE.md) · [MICROSERVICES.md](MICROSERVICES.md) · [CONTRIBUTING.md](CONTRIBUTING.md)
>
> Deep-dives: [AUTHENTICATION.md](AUTHENTICATION.md) · [about/About_webSockets.md](about/About_webSockets.md) · [WEBSOCKET_LOGGING.md](WEBSOCKET_LOGGING.md)

## Prerequisites

| Tool | Minimum version | Check |
|------|----------------|-------|
| Docker Engine | 24.x | `docker --version` |
| Docker Compose v2 | 2.x | `docker compose version` |
| GNU Make | 4.x | `make --version` |
| OpenSSL | 3.x | `openssl version` |
| curl | any | `curl --version` (used by `make wait`) |
| Git | 2.x | `git --version` |

> On 42 school machines all tools are pre-installed.

---

## Quick Start

```bash
git clone <repo-url> ft_transcendence
cd ft_transcendence
cp .env.example .env        # edit DB_PASSWORD and JWT_SECRET_KEY before running
make                        # builds backend-base, starts the stack, bootstraps AI + admin
```

Open **https://localhost:8443** and click through the self-signed certificate warning.

`make` is idempotent. To verify the stack is healthy:

```bash
make ps                     # container status
make wait                   # block until all 3 backend services answer 200
make check                  # full integration health-check (seeds DB first)
```

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
| `DB_HOST` | `db` | PostgreSQL hostname (matches the docker-compose service name) |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `transcendence_user` | Database user |
| `DB_PASSWORD` | *(your choice)* | Database password |
| `DB_NAME` | `transcendence_db` | Database name |
| `DB_ECHO` | `true` | SQLAlchemy SQL echo for dev |
| `JWT_SECRET_KEY` | *(your choice)* | Signing key for access/refresh tokens |
| `USER_SERVICE_PORT` | `8001` | user-service internal port |
| `GAME_SERVICE_PORT` | `8002` | game-service internal port |
| `CHAT_SERVICE_PORT` | `8003` | chat-service internal port |
| `FRONTEND_PORT` | `3000` | React dev server internal port |
| `DOMAIN` | `localhost` | Domain baked into the nginx TLS cert. **Auto-overridden** to your LAN IP when you run `make` — no manual edit needed for LAN sharing. |

> The old monolithic `BACKEND_PORT=8080` was removed when the backend was split into 3 microservices in Sprint 03.

### 4. Start the stack

```bash
make
```

Visit **https://localhost:8443** (click through the self-signed certificate warning).

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

## Default Accounts

These rows are bootstrapped automatically by `make` (via `make db-init`, which calls `services/user-service/database_init.sh`). They are also restored after `make seed`.

| Username | Password | Role | ID | Source |
|----------|----------|------|----|----|
| `AI` | `123dev` | AI opponent (non-admin) | `0` (fixed) | `services/user-service/database_init.sh` |
| `admin` | `123` | Site administrator (`is_admin=true`) | auto | `services/user-service/database_init.sh` |
| `alice` | `123dev` | dev user | auto | `tests/seed_dev.py` (only after `make seed`) |
| `bob` | `123dev` | dev user | auto | `tests/seed_dev.py` |
| `charlie` | `123dev` | dev user | auto | `tests/seed_dev.py` |
| `joao` | `123dev` | dev user | auto | `tests/seed_dev.py` |
| `maria` | `123dev` | dev user | auto | `tests/seed_dev.py` |

The AI user (id=0) is the only account with a fixed primary key — game-service relies on `AI_PLAYER_ID = 0` to attribute AI matches.

---

## Build & Launch

All commands run from the **repository root**. The Makefile sets `MAKEFLAGS += --no-print-directory` so sub-make calls stay quiet.

### Lifecycle

| Command | Action |
|---------|--------|
| `make` (alias `make all`, `make up`) | Build `backend-base`, start all containers, then run `db-init` |
| `make windows` | Same as `make` but skips the `DOMAIN` fallback to `localhost` (Windows hosts) |
| `make down` | Stop and remove containers |
| `make clean` | Stop containers + remove orphans |
| `make fclean` | Full clean: containers + volumes + images |
| `make re` | `fclean` then `make` |
| `make logs` | Tail all container logs |
| `make ps` | Show container status |
| `make wait` | Poll the 3 backend health endpoints until all return 200 (60s timeout) |

### Per-service rebuild

| Command | Action |
|---------|--------|
| `make build-base` | Rebuild the `backend-base` image (run after shared deps change) |
| `make up-frontend` / `make down-frontend` / `make re-front` | Frontend container |
| `make up-user` / `make down-user` / `make re-user` | user-service |
| `make up-game` / `make down-game` / `make re-game` | game-service |
| `make up-chat` / `make down-chat` / `make re-chat` | chat-service |
| `make re-back` | No-cache rebuild of all 3 backend services |
| `make re-nginx` | Rebuild and restart nginx only (reissues the TLS cert) |

### Database & seeding

| Command | Action |
|---------|--------|
| `make db-init` | Idempotent bootstrap of AI (id=0) + admin via `database_init.sh` |
| `make clear-db` | **Destructive.** `TRUNCATE ... RESTART IDENTITY CASCADE` of all dev/test tables. Leaves DB empty (no AI, no admin) |
| `make seed` | `clear-db` → `seed_dev.py` (alice/bob/charlie/joao/maria + friendships, matches, hc-* chat rooms) → `db-init` (restore AI + admin) |
| `make show-tables` | List all public tables |
| `make show-table-contents` | Print every row of every non-alembic table |
| `make show-tables-full` | Show table schema: columns, types, nullability |

### Testing & health checks

| Command | Action |
|---------|--------|
| `make check` | `wait` → `seed` → `tests/TranscendenceHealthCheck.sh`, saves report to `make_check_results.txt` |
| `make check-no-wait` | Like `check` but skips `wait` (used by CI after container readiness probe) |
| `make e2e` | `wait` → `seed` → `tests/TranscendenceHealthCheck.sh`, saves report to `release.txt` |

### Migrations

| Command | Action |
|---------|--------|
| `make migrate-user MSG=<desc>` | Autogenerate Alembic revision for user-service |
| `make migrate-game MSG=<desc>` | Autogenerate Alembic revision for game-service |
| `make migrate-chat MSG=<desc>` | Autogenerate Alembic revision for chat-service |
| `make migrate-upgrade` | `alembic upgrade head` on all 3 services |

### LAN access

| Command | Action |
|---------|--------|
| `make show-ip` | Print LAN IP + sharing instructions |

---

## Alembic Migrations

Migrations are managed per-service with Alembic, each with its own history under `src/backend/<service>/alembic/versions/`. The schema is updated automatically at container startup (`alembic upgrade head` runs in each service's `entrypoint.sh`).

### Create a migration

```bash
make migrate-user MSG=add_avatar_url_to_users
make migrate-game MSG=add_tournaments_table
make migrate-chat MSG=add_room_members
```

A new revision file is written to `src/backend/<service>/alembic/versions/`. Always review the generated SQL before applying.

### Apply pending migrations manually

```bash
make migrate-upgrade   # upgrades all 3 services to head
```

### Inspect the database

```bash
make show-tables            # list tables
make show-table-contents    # dump all rows (excludes alembic_version)
make show-tables-full       # column-level schema details
```

---

## LAN Sharing

To access the app from another device on the same Wi-Fi:

```bash
make show-ip        # prints your LAN IP and instructions
```

`make` automatically detects your LAN IP (via `hostname -I`) and passes it as `DOMAIN` to docker-compose, so the **Share this URL** message in the chat page already shows the correct IP. If detection fails (macOS/Windows) `DOMAIN` defaults to `localhost`. Override anytime by setting `DOMAIN=<ip>` in `.env` and running:

```bash
make re-nginx       # rebuilds nginx + reissues TLS cert for the configured DOMAIN
```

The remote device must accept the self-signed certificate the first time (Advanced → Accept the Risk).

---

## Health Check

```bash
make check          # waits for services, seeds DB, runs the full check, saves make_check_results.txt
make e2e            # same flow but writes the report to release.txt
make wait           # just waits — useful before commands that need services up
```

`make check` automatically runs `make wait` and `make seed` before the test script. `make wait` polls `https://localhost:8443/api/users/health`, `/api/game/health`, and `/api/chat/health` every 2 seconds and exits once all three return HTTP 200. Timeout is 60 seconds (30 attempts).

The report is saved to `make_check_results.txt` (ANSI colours stripped) and also printed to the terminal. `make e2e` is the same flow but the report goes to `release.txt`.

The pytest-based API e2e suite under `tests/api_e2e/` is run separately — see `tests/How_to_add_tests.md`.

---

## Database Reset Workflow

A common dev loop when schema or seed data drifts:

```bash
make clear-db       # wipe everything (no AI, no admin)
make db-init        # restore AI + admin
# or, in one shot:
make seed           # clear-db → seed_dev.py → db-init
```

`clear_db.sh` issues `TRUNCATE ... RESTART IDENTITY CASCADE` on the curated table list (`tokens`, `friendships`, `matches`, `messages`, `notifications`, `tournament_matches`, `tournament_participants`, `tournaments`, `blocks`, `users`, `chat_rooms`, `credentials`). `RESTART IDENTITY` resets SERIAL sequences so the next insert starts at 1; `CASCADE` removes FK-dependent rows that aren't in the list (e.g. `user_login_days`).

`database_init.sh` is idempotent — it skips users whose username already exists in `credentials`/`users`.

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
make show-tables             # lists all tables
make show-table-contents     # shows full content of every table
make show-tables-full        # column-level schema details
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
| `user/game/chat-service` exits immediately | DB not ready | Check `make logs`; increase healthcheck `retries` in `docker-compose.yml` |
| `nginx` 502 Bad Gateway | A backend service crashed at startup | Run `make logs` — look for `ModuleNotFoundError` or import errors |
| `make wait` exits with "Timeout: services not ready after 60s" | Service slow to boot or migration failure | `make logs <service>` and inspect the alembic upgrade output |
| `make: *** missing separator` | Spaces instead of tabs in Makefile | Replace recipe indentation with real tab characters |
| Port 443 / 8443 / 8888 already in use | Another process on host | `sudo lsof -i :<port>` and stop the offender |
| TLS certificate warning in browser | Self-signed cert (expected) | Click "Advanced" → "Proceed to localhost" |
| `docker compose config` errors | Invalid `.env` or compose syntax | Run `docker compose config` to see the resolved file |
| DB password wrong after `make re` | Old volume with different password | Run `make fclean` to wipe the volume, then `make` |
| AI matches fail with FK error after a restore | DB was truncated without `db-init` | Run `make db-init` to restore the AI (id=0) row |
| Login as `admin` fails right after `make` | `db-init` ran before migrations finished | Re-run `make db-init` (it is idempotent) |
| `make seed` reports "duplicate key value" if run manually | seed_dev.py expects `clear-db` to run first | Use `make seed` (it chains them); avoid running `seed_dev.py` directly on a populated DB |

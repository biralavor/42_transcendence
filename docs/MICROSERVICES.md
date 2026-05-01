
# Microservices — ft_transcendence

Three FastAPI services share one PostgreSQL database, one Docker network
(`transcendence_network`), and a `shared/` Python package mounted into every
container. nginx terminates TLS and routes requests by URL prefix.

## Topology

```
                                 host:8443 (TLS) / host:8080 (HTTP redirect)
                                                 │
                                                 ▼
                                        ┌────────────────┐
                                        │     nginx      │ (TLS termination, /api/* routing)
                                        └────────┬───────┘
                                                 │
        ┌────────────────────────┬───────────────┼───────────────┬────────────────────────┐
        ▼                        ▼               ▼               ▼                        ▼
┌──────────────┐         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    ┌──────────────┐
│ user-service │ ◄──HTTP─┤ game-service │  │ chat-service │  │   frontend   │    │   adminer    │
│   :8001      │         │   :8002      │  │   :8003      │  │   :3000      │    │   :8080      │
└──────┬───────┘         └──────┬───────┘  └──────┬───────┘  └──────────────┘    └──────┬───────┘
       │                        │                 │                                     │
       │       chat-service ──HTTP── user-service /auth/me                              │
       │       game-service ──HTTP── user-service /auth/me, /game-invites               │
       │                        │                 │                                     │
       └────────────────────────┴────────┬────────┴─────────────────────────────────────┘
                                         ▼
                                ┌────────────────┐
                                │  PostgreSQL    │  shared DB, separate Alembic histories
                                │   db:5432      │
                                └────────────────┘
```

`avatars_data` (named volume) is written by `user-service` at
`/app/uploads/avatars` and mounted read-only into nginx at
`/var/www/uploads/avatars` so it can serve avatar files directly without
proxying through the user-service.

## Services

| Service        | Internal port            | Image                      | Container         | Role                                                 |
|----------------|--------------------------|----------------------------|-------------------|------------------------------------------------------|
| `db`           | 5432                     | `postgres:16-alpine`       | `db`              | PostgreSQL — single shared database                  |
| `user-service` | `${USER_SERVICE_PORT}` (8001) | `services/user-service/Dockerfile` (extends `backend-base`) | `user-service` | Auth, profiles, friends, notifications, presence, activity, avatars |
| `game-service` | `${GAME_SERVICE_PORT}` (8002) | `services/game-service/Dockerfile` (extends `backend-base`) | `game-service` | Pong gameplay, AI, matches, tournaments, history, live spectators |
| `chat-service` | `${CHAT_SERVICE_PORT}` (8003) | `services/chat-service/Dockerfile` (extends `backend-base`) | `chat-service` | Real-time chat (DMs and rooms), block list             |
| `frontend`     | `${FRONTEND_PORT}` (3000) | `services/frontend/Dockerfile` (`node:20-alpine`) | `frontend`        | React + Vite dev server                              |
| `nginx`        | 80, 443                  | `services/nginx/Dockerfile` (`nginx:1.28-alpine`) | `nginx`           | TLS termination + reverse proxy (host 8080 → 80, host 8443 → 443) |
| `adminer`      | 8080                     | `adminer:5.4.2`            | `adminer`         | DB management UI (host 8888 → 8080)                  |

All non-host services communicate over the `transcendence_network` bridge using
their Compose service names as DNS hostnames (e.g. `http://user-service:8001`).

## Data domains

Each service owns a slice of the schema and ships its own Alembic migration
history under `src/backend/<name>-service/alembic/`. There is one Postgres DB,
but no service issues migrations into another service's tables.

| Service        | Tables it owns                                                                                              |
|----------------|-------------------------------------------------------------------------------------------------------------|
| `user-service` | `users`, `credentials`, `tokens`, `friendships`, `notifications`, `achievements`, `user_login_days`         |
| `game-service` | `matches`, `tournaments`, `tournament_participants`, `tournament_matches`                                   |
| `chat-service` | `chat_rooms`, `messages`, `blocks`                                                                          |

Cross-service reads happen via the shared engine (e.g. `chat-service` reads
`users` to resolve `credential_id → user.id`, and `user-service`'s
`/admin/activity` aggregates `matches` and `messages` for the dashboard).
Cross-service writes do not happen directly — services call each other over
HTTP for that (see [Inter-service calls](#inter-service-calls)).

## Container layout (WORKDIR `/app`)

```
Host                                Container
src/backend/<name>-service/  ──►   /app/service/   (bind-mounted in dev; baked into image at build)
src/backend/shared/          ──►   /app/shared/    (bind-mounted in dev; baked into image at build)
```

uvicorn is invoked from `/app` as `service.main:app`, so all in-service
imports must use the `service.` prefix. `shared.*` imports always work because
`/app` is on `sys.path`.

```python
# Correct
from service.models.user import User
from service.service import authenticate
from shared.database import get_db
from shared.config.settings import settings

# Wrong — ModuleNotFoundError at startup
from models.user import User
from service import authenticate
```

## Image strategy: `backend-base`

`services/backend-base/Dockerfile` produces the `backend-base` image —
`python:3.12-alpine` with the shared Python deps from
`src/backend/shared/requirements.txt` pre-installed. Each service image starts
with `FROM backend-base` and adds only its own service-specific
`requirements.txt`. Build it once, then per-service images skip the
shared-deps install.

```bash
make build-base    # build/refresh backend-base
make re            # rebuild + restart all services on top of it
```

Per-service Dockerfiles (`services/{user,game,chat}-service/Dockerfile`) all
follow the same shape:

1. `FROM backend-base`
2. Install service-specific deps
3. `COPY src/backend/shared/` → `/app/shared/`
4. `COPY src/backend/<name>-service/` → `/app/service/`
5. `EXPOSE` the service port
6. `ENTRYPOINT` to the service's `entrypoint.sh`

The `COPY` steps make the image self-contained for production-like runs;
the bind mounts in `docker-compose.yml` shadow them in dev so live-reload
works without rebuilds.

## Entrypoints (Alembic + uvicorn)

Every backend `entrypoint.sh` does the same two things:

```sh
cd /app/service
alembic upgrade head        # apply pending migrations (per-service history)
cd /app
exec uvicorn service.main:app \
    --host 0.0.0.0 \
    --port "${<NAME>_SERVICE_PORT:-<default>}" \
    --reload \
    --reload-dir /app/service \
    --reload-dir /app/shared
```

The result: any container that boots will be on the latest schema for the
tables it owns. If two services migrate concurrently they touch different
tables, so there is no cross-service migration ordering to coordinate.

## The `shared/` package

`src/backend/shared/` is mounted read-write into every service so the same
helpers live in exactly one place:

| Submodule               | What it provides                                                                                                    |
|-------------------------|---------------------------------------------------------------------------------------------------------------------|
| `shared.config.settings`| Pydantic `Settings` — DB env vars, `JWT_SECRET_KEY`, `USER_SERVICE_URL`, `SQLALCHEMY_DATABASE_URI` property          |
| `shared.database`       | Async SQLAlchemy engine + `AsyncSessionLocal` + `get_db()` FastAPI dependency + `Base = DeclarativeBase`            |
| `shared.ws.manager`     | `ConnectionManager` — room-keyed WebSocket registry with player/spectator role tracking and broadcast helpers       |
| `shared.ws.presence`    | Online-presence helpers used by user-service's presence router                                                      |
| `shared.logging.ws_logger` | Structured WS event logging                                                                                      |
| `shared.util.order`     | `get_sort_assoc_from_order_query()` — turn `?order=…` query strings into SQLAlchemy ordering tuples                 |

Adding a new shared dep: edit `src/backend/shared/requirements.txt`, then
`make build-base && make re` so all three service images pick it up.

## Authentication: shared JWT, decoded independently

There is **no central auth gateway**. The user-service issues JWTs signed with
`JWT_SECRET_KEY`, and every service decodes them locally with the same secret.

- Token shape: HS256, `credential_id` claim.
- `user-service` resolves `credential_id → users.id` directly in SQL.
- `game-service` and `chat-service` do the same fast path against the local
  `users` table and **fall back to `GET http://user-service:8001/auth/me`**
  if the user row hasn't been provisioned yet (first login from a non-user
  service). See `src/backend/game-service/auth.py` and the
  `get_current_user` block in `src/backend/chat-service/main.py`.

This is why `JWT_SECRET_KEY` must be identical in every service's environment —
which `docker-compose.yml` enforces by passing the same `${JWT_SECRET_KEY}` to
all three.

## Inter-service calls

Direct HTTP calls between services (over `transcendence_network`):

| Caller         | Callee         | Endpoint                       | Purpose                                                                |
|----------------|----------------|--------------------------------|------------------------------------------------------------------------|
| `game-service` | `user-service` | `GET /auth/me`                 | Auto-provision a `users` row for a credential on first authenticated request |
| `game-service` | `user-service` | `POST /game-invites`           | Fan-out tournament notifications (`tournament_full`, `tournament_match_available`, `tournament_complete`) — see `service/notifications.py` |
| `chat-service` | `user-service` | `GET /auth/me`                 | Same auto-provision fallback as game-service                           |

Everything else flows through the shared DB or through WebSocket broadcasts on
each service's own `ConnectionManager`.

## Routing (nginx → upstreams)

`services/nginx/nginx.conf.template` (rendered at container start) maps URL
prefixes to upstreams. The trailing slash on `proxy_pass` strips the location
prefix, so FastAPI routes inside each service must NOT include the `/api/<svc>`
prefix.

| Path prefix         | Upstream         | Notes                                                                |
|---------------------|------------------|----------------------------------------------------------------------|
| `/api/users/`       | `user-service`   | Includes `/auth/*`, `/profile/*`, `/friends/*`, `/notifications`, `/avatar`, `/admin/activity`, `/activity`, `/preferences`, `/search`, presence + notification WS. `client_max_body_size 3m` for avatar uploads. |
| `/api/games/`       | `game-service`   | REST only (live games list, history, leaderboard, tournaments)       |
| `/api/game/`        | `game-service`   | Gameplay + waiting-room + spectator WebSockets                       |
| `/api/chat/`        | `chat-service`   | DM/room REST + chat WebSockets                                       |
| `/uploads/avatars/` | (static)         | Served from the `avatars_data` volume mounted read-only into nginx   |
| `/`                 | `frontend`       | Vite dev server, with WS upgrade for HMR                             |

Two locations point at `game-service` because the legacy REST routes live
under `/games/` while gameplay (matches, tournaments, AI) lives under `/`
in the service — the nginx split keeps both reachable without renaming
service-internal paths.

## Live reload in dev

All three backend services run uvicorn with `--reload` watching both
`/app/service` and `/app/shared`. The bind mounts in `docker-compose.yml`
make host edits visible inside the container immediately — no rebuild needed
for `.py` changes.

| Service        | Watches                              |
|----------------|--------------------------------------|
| `user-service` | `/app/service/`, `/app/shared/`      |
| `game-service` | `/app/service/`, `/app/shared/`      |
| `chat-service` | `/app/service/`, `/app/shared/`      |
| `frontend`     | `/app/` (Vite HMR)                   |

`node_modules/` inside the frontend container is protected by an anonymous
Docker volume (`/app/node_modules`) so the bind mount of `src/frontend/`
never overwrites the container's installed packages.

When you still need `make up-<service>`:

- Added a new pip package to a service's `requirements.txt`.
- Added a new npm package to `src/frontend/package.json`.

When you need `make build-base && make re`:

- Added a package to `src/backend/shared/requirements.txt` (affects all services).

## Testing on the host

On the host the service directories are named `<name>-service/` (with a dash),
which Python cannot import as a package. Inside the container they are copied
to `/app/service/`, where `from service.* import …` resolves naturally.

To let host-side pytest tests use the same `service.` imports, each service's
`tests/conftest.py` registers a `service` entry in `sys.modules` pointing at
the local directory — mirroring the Docker rename without touching the
filesystem:

```python
# tests/conftest.py
import sys, types
from pathlib import Path

_service_dir = Path(__file__).resolve().parents[1]   # .../<name>-service
_backend_dir = _service_dir.parent                   # .../src/backend

sys.path.insert(0, str(_backend_dir))   # for `shared.*` imports
sys.path.insert(0, str(_service_dir))   # for `from main import app`

if "service" not in sys.modules:
    _mod = types.ModuleType("service")
    _mod.__path__ = [str(_service_dir)]
    _mod.__package__ = "service"
    sys.modules["service"] = _mod
```

Test files themselves do **not** manipulate `sys.path` — conftest owns it.

### Running service tests locally

Each service has a `requirements-test.txt` with test-only deps (`pytest`,
`httpx`) that are **not** installed in the production image. Install them
before running tests:

```bash
# user-service
pip install \
    -r src/backend/shared/requirements-test.txt \
    -r src/backend/user-service/requirements-test.txt
pytest src/backend/user-service/tests/

# game-service
pip install \
    -r src/backend/shared/requirements-test.txt \
    -r src/backend/game-service/requirements-test.txt
pytest src/backend/game-service/tests/

# chat-service
pip install \
    -r src/backend/shared/requirements-test.txt \
    -r src/backend/chat-service/requirements-test.txt
pytest src/backend/chat-service/tests/

# shared/ws unit tests need only the shared test deps
pip install -r src/backend/shared/requirements-test.txt
pytest src/backend/shared/ws/tests/
```

## Adding a new service

1. **Source directory** — create `src/backend/<name>-service/` with at minimum:
   - `main.py` — FastAPI `app`
   - `models/` — SQLAlchemy models (subclass `from shared.database import Base`)
   - `schemas.py` — Pydantic request/response models
   - `requirements.txt` — service-specific deps (leave only the comment if none beyond base)
   - `requirements-test.txt` — pytest/httpx for host-side tests
   - `tests/conftest.py` — the `sys.modules` shim above

2. **Dockerfile** — `services/<name>-service/Dockerfile`:
   - `FROM backend-base`
   - Install `requirements.txt`
   - `COPY` shared/ + service/
   - `EXPOSE` the new port
   - `ENTRYPOINT ["/entrypoint.sh"]`

3. **Entrypoint** — `services/<name>-service/entrypoint.sh`:
   - `cd /app/service && alembic upgrade head`
   - `cd /app && exec uvicorn service.main:app --host 0.0.0.0 --port "${<NAME>_SERVICE_PORT:-…}" --reload --reload-dir /app/service --reload-dir /app/shared`

4. **docker-compose.yml** — add a service block with:
   - `build:` pointing at the new Dockerfile (context `.`)
   - Bind mounts for `./src/backend/<name>-service:/app/service` and `./src/backend/shared:/app/shared`
   - `JWT_SECRET_KEY` + DB env vars + `<NAME>_SERVICE_PORT`
   - `depends_on: db: condition: service_healthy`
   - On `transcendence_network`

5. **nginx** — add an `upstream` block and a `location /api/<name>/` block in `services/nginx/nginx.conf.template`. Set `proxy_set_header Upgrade $http_upgrade; Connection $connection_upgrade;` if the service uses WebSockets.

6. **`.env` / `.env.example`** — add `<NAME>_SERVICE_PORT=…`.

7. **Alembic** — inside the service directory:
   ```bash
   cd src/backend/<name>-service
   alembic init alembic
   ```
   Wire `alembic.ini`'s `sqlalchemy.url` to use the `DATABASE_URL` env var,
   and import your `Base` metadata in `alembic/env.py` (see
   `chat-service/alembic/env.py` as the reference).

8. **Makefile** — add `up-<name>`, `down-<name>`, `re-<name>`,
   `migrate-<name> MSG=…` targets following the pattern of the existing
   service targets.

9. **Auth** — if the service authenticates users, copy the JWT-decode +
   `users` lookup + fallback to `user-service /auth/me` pattern from
   `chat-service/main.py::get_current_user` or `game-service/auth.py`.
   Don't reinvent the auth flow.

## Adding dependencies

### Service-specific

```bash
echo "bcrypt==4.2.1" >> src/backend/user-service/requirements.txt
make re-user
```

### Shared (all services)

```bash
echo "httpx==0.27.0" >> src/backend/shared/requirements.txt
make build-base
make re
```

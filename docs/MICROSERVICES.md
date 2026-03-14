
# Microservices — ft_transcendence

## Service Layout

Each backend service follows the same directory and container layout:

```
Host                              Container (WORKDIR /app)
src/backend/user-service/  ──►   /app/service/
src/backend/shared/        ──►   /app/shared/
```

Uvicorn runs as: `uvicorn service.main:app`

## Import Pattern

Because uvicorn is invoked as `service.main:app` from WORKDIR `/app`, all imports inside
a service must use the `service.` prefix:

```python
# ✅ Correct
from service.models import Credentials, Login, Token
from service.service import register_user, authenticate
from shared.database import get_db

# ❌ Wrong — ModuleNotFoundError at startup
from models import Credentials
from service import register_user
```

## backend-base Image

`services/backend-base/Dockerfile` installs all shared Python dependencies once.
Per-service images extend it without reinstalling the shared layer — faster builds.

When to rebuild the base image:
```bash
# After changing src/backend/shared/requirements.txt
make build-base
make re
```

## Live Reload

All services use bind mounts + uvicorn `--reload`. Saving a `.py` file on the host
is reflected inside the container immediately — no rebuild needed.

| Service | Watches |
|---------|---------|
| `user-service` | `/app/service/`, `/app/shared/` |
| `game-service` | `/app/service/`, `/app/shared/` |
| `chat-service` | `/app/service/`, `/app/shared/` |
| `frontend` | `/app/` (Vite HMR) |

> `node_modules/` inside the frontend container is protected by an anonymous Docker volume
> (`/app/node_modules`) so the bind mount never overwrites the container's installed packages.

**When you still need `make up-<service>`:**
- Added a new pip package to a service's `requirements.txt`
- Added a new npm package to `src/frontend/package.json`

**When you need `make build-base && make re`:**
- Added a package to `src/backend/shared/requirements.txt` (affects all services)

## Adding a New Service

1. Create source directory: `src/backend/<name>-service/`
   - `main.py` — FastAPI app
   - `models.py` — Pydantic models
   - `service.py` — business logic (imported as `from service.service import ...`)
   - `requirements.txt` — service-specific deps (leave empty if none beyond base)

2. Create Dockerfile: `services/<name>-service/Dockerfile`
   - Extend `backend-base`
   - Expose the new port

3. Add to `docker-compose.yml`:
   - New service block with bind mounts for `/app/service/` and `/app/shared/`
   - `depends_on: db: condition: service_healthy`
   - New `<NAME>_SERVICE_PORT` env var

4. Add nginx upstream + location block in `services/nginx/nginx.conf.template`

5. Add `<NAME>_SERVICE_PORT` to `.env.example` and `.env`

6. Add make targets: `up-<name>`, `down-<name>`, `re-<name>` to `Makefile`

## Adding Dependencies

### Service-specific dependency

```bash
echo "bcrypt==4.2.1" >> src/backend/user-service/requirements.txt
make re-user
```

### Shared dependency (all services)

```bash
echo "httpx==0.27.0" >> src/backend/shared/requirements.txt
make build-base
make re
```

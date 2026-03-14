# Troubleshooting — ft_transcendence

Common issues and fixes for local development and evaluation setup.

---

## Docker / Make

### `make` fails immediately

```
Error response from daemon: network not found
```

**Fix:**
```bash
make fclean
make
```

---

### Container exits right after starting

Check logs:
```bash
docker compose logs <service-name>
# e.g.: docker compose logs user-service
```

Common causes:
- Missing or wrong `.env` variable → verify all variables in `.env.example` are set
- Port already in use → `sudo lsof -i :8443` and kill the conflicting process

---

### `make` hangs on `npm install` or Python package install

The first build downloads all dependencies — can take 2–5 minutes on slow connections. Wait it out.

If it truly hangs (>10 min):
```bash
Ctrl+C
make fclean
make
```

---

### Changes to source code not reflected

All services use **live reload** via bind mounts:
- Python (FastAPI): saving a `.py` file triggers uvicorn `--reload` automatically
- React (Vite): HMR updates the browser instantly

If live reload stopped working:
```bash
docker compose restart <service-name>
```

If you added a **new pip package**:
```bash
make up-user-service   # or up-game-service / up-chat-service
```

---

## Database

### `db` container is unhealthy

```bash
docker compose logs db
```

Common cause on 42 machines: PostgreSQL can't `chown` on NFS (`sgoinfre`).

**Fix:** The database uses a **named Docker volume** (`db_data`) — not a bind mount — specifically to avoid this. If the volume is missing:
```bash
make fclean   # removes volumes too
make
```

---

### Can't connect to Adminer

- URL: http://localhost:8888
- System: `PostgreSQL`
- Server: `db` (not `localhost`)
- Username/Password/Database: from your `.env`

If Adminer loads but shows "connection refused": the `db` container is still starting. Wait 10–15 s and refresh.

---

### Database schema not applied

The schema is applied by `services/database/init.sql` on first container start. If the volume already exists from a previous run, `init.sql` is skipped.

**Fix:**
```bash
make fclean   # destroys db_data volume
make          # re-applies init.sql
```

---

## nginx / TLS

### Browser shows "Connection refused" on https://localhost:8443

```bash
docker compose ps nginx
```

If nginx is not running:
```bash
docker compose logs nginx
```

Common cause: certificate generation failed (OpenSSL not available in the container, or `DOMAIN` env var not set).

**Fix:** Ensure `DOMAIN=localhost` is set in `.env`, then:
```bash
docker compose restart nginx
```

---

### Browser shows "Your connection is not private" (NET::ERR_CERT_AUTHORITY_INVALID)

This is expected — the project uses a **self-signed certificate**.

- Chrome: click **Advanced → Proceed to localhost (unsafe)**
- Firefox: click **Advanced → Accept the Risk and Continue**

---

## Backend Services

### `user-service` / `game-service` / `chat-service` returns 502 Bad Gateway

nginx receives the request but can't reach the upstream service.

```bash
docker compose logs user-service   # check for Python import errors or startup crash
```

Most common cause: wrong import path in new code. See `docs/MICROSERVICES.md` for the correct import pattern (`from service.xxx import ...`).

---

### JWT token rejected (401 Unauthorized)

- Token may be expired (default: 30 min)
- Log out and log back in to get a fresh token
- If still failing: check `JWT_SECRET` is set identically in `.env` across all services that validate tokens

---

## Frontend

### React app shows blank page

```bash
docker compose logs frontend
```

Common causes:
- Vite build error (syntax error in JSX)
- `node_modules` volume conflict → `make fclean && make`

---

### WebSocket connection fails in browser console

```
WebSocket connection to 'wss://localhost:8443/api/chat/ws/...' failed
```

- Ensure nginx is configured to pass `Upgrade` and `Connection` headers (check `services/nginx/nginx.conf.template`)
- Ensure the chat-service WebSocket endpoint is running: `docker compose logs chat-service`

---

## Health Check Script

```bash
bash tests/TranscendenceHealthCheck.sh
```

This script hits `/api/users/health`, `/api/game/health`, `/api/chat/health`, and the frontend. Each should return `200 OK`.

If one fails, check that service's logs:
```bash
docker compose logs <service-name>
```

---

## Nuclear Option

Wipes everything and starts fresh:

```bash
make fclean   # stops containers, removes images + volumes + networks
make          # full rebuild
```

> `fclean` removes the `db_data` volume — all database data is lost.

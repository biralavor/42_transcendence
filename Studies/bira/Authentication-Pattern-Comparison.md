# Authentication Pattern Comparison

**Author:** Bira
**Last revised:** 2026-05-01
**Context:** Personal study notes — comparing classical web-auth patterns and grounding them in what we actually shipped in ft_transcendence (real-time Pong + chat).

---

## Why I am writing this

Every time I touch our login code I find myself re-deriving the same questions: why a JWT and not a session cookie? Why two tokens? Why sha256 the refresh token but sign the access one? Why does the WS endpoint accept the token in a query string when our REST endpoints take it in a header?

This document is my attempt to settle those questions in one place. The first half is the conceptual comparison (Sessions vs JWT vs OAuth/OIDC). The second half is what ft_transcendence actually does, with file paths and line numbers I can jump to in VS Code.

I keep this file in `Studies/bira/` and not in `docs/` on purpose: the canonical reference is `docs/AUTHENTICATION.md`. This is my notebook.

---

## Part 1 — Conceptual comparison

### The shape of the problem

An authentication system has to answer two questions on every request:

1. **Who is this caller?** (identification)
2. **Are they allowed to do what they are asking?** (authorization)

The interesting design choice is *where the answer lives*: on the server (sessions), in the token itself (JWT), or with a third party (OAuth/OIDC). Everything else — refresh tokens, hashing, expiry, rotation — is plumbing on top of that core choice.

### Sessions vs JWT vs OAuth — at a glance

| Aspect | Server-side sessions | Stateless JWT | OAuth 2.0 / OIDC |
|---|---|---|---|
| **Where state lives** | Server (DB/Redis), keyed by opaque session id | Inside the token (signed, self-contained) | Authorization server issues tokens; resource servers verify them |
| **What the client holds** | A random opaque id (usually a cookie) | A signed JSON blob (`header.payload.signature`) | An access token (often JWT) + optional refresh token |
| **Validation cost** | DB/cache lookup per request | Signature verify + claim check (no I/O) | Local verify if JWT; otherwise introspection call to AS |
| **Revocation** | Trivial — delete the row | Hard — must wait for `exp` or maintain a denylist | Token introspection / revocation endpoint |
| **Horizontal scaling** | Needs shared store (sticky sessions or Redis) | Trivial — any node can validate | Any node can validate; centralized AS is the bottleneck |
| **Payload size on wire** | Small (just an id) | Larger (claims + signature, base64) | Same as JWT, plus extra metadata |
| **Cross-domain / mobile** | CSRF concerns, cookie scoping | Easy — `Authorization: Bearer …` is portable | Designed for it; this is the whole point |
| **Identity federation** | DIY | DIY | Native — login with Google/42/etc. |
| **Failure mode if leaked** | Steal one user’s session until it expires or is revoked | Steal until `exp`; revocation is a problem | Same as JWT, but refresh-token rotation can detect replay |
| **Best fit** | Classic monoliths, server-rendered apps | SPAs, microservices, mobile clients | Third-party login, multi-tenant, public APIs |

### The trade-off I keep forgetting

Stateless JWTs trade **revocation** for **scalability**. A signed token with a 24-hour lifetime is, by design, valid for 24 hours — there is no `DELETE FROM sessions WHERE id = …` you can run when a user clicks "log out everywhere".

The standard fix is the **two-token pattern**:

- A **short-lived access token** (15 min or so) that is stateless and validated locally.
- A **long-lived refresh token** that is stateful — stored server-side, revocable, used only to mint new access tokens.

You get most of the scalability of JWT (the hot path is signature verification, no I/O), and most of the control of sessions (the refresh-token row is the revocation lever). The cost is the second round-trip every 15 minutes and the slightly more complex client. This is the pattern we ended up using.

### Where OAuth/OIDC fits

OAuth 2.0 is not really a competitor to "sessions vs JWT" — it is one layer up. It defines *how a third-party authorization server hands tokens to your app*. Inside that token, you can still use a JWT (most providers do) or an opaque token introspected via a separate call.

OIDC adds an `id_token` (always a JWT) carrying user identity claims. If we ever wire up "Login with 42", that is the protocol we would speak.

We do not use OAuth in ft_transcendence — auth lives entirely inside `user-service`. I am noting it for completeness so that if I add Google login next sprint I do not start from zero.

### Hashing notes (the parts I always have to look up)

| Concern | What to use | Why |
|---|---|---|
| **Password storage** | bcrypt / argon2 | Slow on purpose. Rainbow-table resistant via per-password salt. |
| **Refresh-token storage** | sha256 | Token already has 256 bits of entropy from a CSPRNG — no need for slow hashing. Constant-time compare. |
| **JWT signing** | HS256 (shared secret) or RS256 (key pair) | HS256 is fine for one team owning all services. RS256 lets verifiers hold only the public key. |
| **Session id** | CSPRNG, 128+ bits | Treat the id like a password. Hashing on the server side is reasonable. |

---

## Part 2 — How ft_transcendence does it

The short version: **two-token JWT** with a stateful refresh side. Access tokens are stateless JWTs validated locally; refresh tokens are random hex strings whose sha256 is stored in `tokens` and rotated on every refresh.

Files I keep coming back to:

- `src/backend/user-service/service.py` — all the auth business logic
- `src/backend/user-service/main.py` — the `/auth/*` routes
- `src/backend/user-service/models/credentials.py` — `Credentials` and `Tokens` tables
- `src/backend/user-service/models/user.py` — the profile row, linked by `credential_id`
- `src/backend/shared/config/settings.py` — `JWT_SECRET_KEY` source
- `src/frontend/src/utils/apiClient.js` — the 401-retry / refresh dance
- `src/frontend/src/utils/jwtUtils.js` — base64url decode + expiry helpers
- `src/frontend/src/context/authContext.jsx` — proactive refresh timer + inactivity logout
- `src/frontend/src/context/authStorage.js` — sessionStorage / localStorage routing

### The data model

We have **two tables** for auth, plus the `users` profile row.

**`credentials`** (`models/credentials.py:7`)
- `id` (PK)
- `username` (unique)
- `password` — bcrypt hash, stored as a UTF-8 string

**`tokens`** (`models/credentials.py:15`)
- `id` (PK)
- `credential_id` (FK → `credentials.id`) — one row per credential, upserted on each login
- `token_type` — always `"bearer"`
- `refresh_token_hash` — sha256 of the raw refresh token, hex
- `created_at`
- `expires_at` — set 7 days out at issue time

**`users`** (`models/user.py:7`)
- `id` (PK) — this is the id used everywhere downstream
- `username`, `display_name`, `bio`, `avatar_url`, `status`, `game_preferences`
- `credential_id` (FK → `credentials.id`, NOT NULL, UNIQUE) — the join back to auth
- `is_admin` (boolean, default false) — added in migration `20260427_a8b2c4d6e8f0`
- `last_login_at` — naive timestamp, updated by `authenticate()`

The migrations that established this shape:
- `20260318_a1b2c3d4e5f6_add_credentials_and_tokens.py` — created both tables
- `20260318_b2c3d4e5f6a7_harden_tokens_table.py` — dropped plaintext `access_token`, renamed `refresh_token` → `refresh_token_hash`, added `created_at` / `expires_at`
- `20260325_082195afefdc_make_credential_id_not_null_in_users.py` — enforced the FK as NOT NULL
- `20260427_a8b2c4d6e8f0_add_admin_login_tracking.py` — added `is_admin`, `last_login_at`, and the `user_login_days` table for streaks

The `b2c3d4e5f6a7_harden_tokens_table` migration is the one I want to remember: the original schema stored plaintext access tokens and plaintext refresh tokens. We deleted both. Access tokens are now never stored at all (the JWT signature is the proof). Refresh tokens are stored only as their sha256.

### Registration — `POST /auth/register`

Routed at `main.py:78`, implemented by `register_credentials()` at `service.py:139`.

1. SELECT against `credentials.username` to fail-fast with 409 on duplicates.
2. `hash_password()` (`service.py:32`) calls `bcrypt.gensalt()` + `bcrypt.hashpw()`. Salt is per-password and embedded in the hash.
3. INSERT `credentials`. The DB-level UNIQUE constraint catches the race window between the SELECT and the INSERT — the `IntegrityError` handler maps it to 409.
4. **No `users` row is created here.** That happens lazily on first login.

### Login — `POST /auth/login`

Routed at `main.py:60`, implemented by `authenticate()` at `service.py:62`.

The flow:

1. SELECT `credentials` by username.
2. `bcrypt.checkpw()` against the stored hash. Constant-time, so it does not leak length info.
3. `_ensure_user()` (`service.py:38`) — get-or-create the `users` row. This is the single user-creation point. If two requests race here, the UNIQUE on `users.credential_id` raises `IntegrityError` and we 409.
4. Update `users.last_login_at` and INSERT into `user_login_days` (idempotent, `ON CONFLICT DO NOTHING`) — drives the activity-streak counter.
5. Mint the access JWT via `create_access_token()` (`service.py:25`). Claims: `{sub, credential_id, exp}`. Algorithm HS256. Secret from `settings.JWT_SECRET_KEY`. Lifetime `ACCESS_TOKEN_EXPIRE_MINUTES = 15`.
6. Generate the refresh token: `secrets.token_hex(32)` → 64 hex chars (256 bits of entropy). Store `sha256(raw)` in `tokens.refresh_token_hash`. Set `expires_at = now + 7 days`. Upsert — one row per credential.
7. Return `{access_token, token_type, refresh_token}`. The raw refresh token is shown to the client exactly once at this moment; we never have it on the server again.

Important nuance from `service.py:78`: `last_login_at` is stored as a *naive* timestamp because the column matches `users.created_at` which is also naive. The code explicitly strips `tzinfo` before assignment. Future me, do not "fix" this without changing the column.

### Refresh — `POST /auth/refresh`

Routed at `main.py:73`, implemented by `refresh_access_token()` at `service.py:110`.

1. Hash the incoming refresh token, look up the row by `refresh_token_hash`.
2. Reject if not found *or* `expires_at <= now` — same 401 either way (no oracle).
3. Look up the `Credentials` row by `tokens.credential_id`.
4. Mint a brand-new access JWT.
5. **Rotate the refresh token**: generate a new one, overwrite `refresh_token_hash`, push `expires_at` out by another 7 days. The old refresh token is invalidated by being overwritten.
6. Return the new pair.

The rotation is what makes "refresh-token theft" detectable in principle: if both the legitimate client and an attacker hold the same refresh token, whoever refreshes second gets a 401, which is a strong signal something is wrong. We do not currently act on that signal, but the shape is right.

Note: `refresh_access_token()` does not create or update the `users` row. It deliberately leaves that to `get_me()` (the comment at `service.py:123` says so). I had originally written this as "be defensive, create on refresh too", and Mauricio pushed back — three creation points was a maintenance trap.

### `GET /auth/me` — the identity endpoint

Routed at `main.py:65`, implemented by `get_me()` at `service.py:169`.

1. `jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])`. The `jose` library raises:
   - `ExpiredSignatureError` → 401 "Token expired" (specific so the frontend can decide to refresh)
   - `JWTError` (everything else: bad signature, malformed, missing claims) → 401 "Invalid token"
2. Pull `sub` (username) and `credential_id` from the claims. Either being absent → 401.
3. `_ensure_user(credential_id, username, session)` — get-or-create the `users` row.
4. Return the full User. The frontend reads `id`, `username`, `avatar_url`, `is_admin`, `display_name`, etc.

This is the **only** place a `users` row gets created in the backend. Both `authenticate()` and `refresh_access_token()` deliberately do not. If a service ever needs to "wake up" a profile row, the path is: hit `/auth/me` with the token.

Admin status: `users.is_admin` is **bootstrapped at DB-init time** — admin users are seeded with `is_admin=true` in their row. There is no longer a "promote on login if username matches `ADMIN_USERNAME`" code path; the old `ADMIN_USERNAME` setting was removed. `settings.py` no longer holds it. The admin endpoints (`/admin/activity` at `main.py:467`) just check `current_user.is_admin`.

### What goes inside our JWT

The exact claims (`service.py:88` and `service.py:124`):

```json
{
  "sub": "alice",
  "credential_id": 17,
  "exp": 1748728800
}
```

- `sub` is the username — handy for logs and for the frontend to display "logged in as …" without a round trip (`getTokenUsername()` in `jwtUtils.js:140`).
- `credential_id` is the stable database key. Other services (game, chat) decode it locally and use `SELECT id FROM users WHERE credential_id = ?` to resolve the actual `user.id` they need for foreign keys.
- `exp` is a Unix timestamp in seconds. The `jwtUtils.js:62` helper multiplies by 1000 to get JS milliseconds.

We deliberately do **not** put `user.id` in the JWT. The reason: at JWT-creation time inside `authenticate()`, the `users` row may not yet exist (it gets created by `_ensure_user()` in the same function, but that ordering is fragile). `credential_id` is always available because we just looked it up to verify the password. Stable claims should reference stable keys.

### Frontend — the apiClient + AuthContext duet

Two components on the frontend, with a clear split of responsibility.

**`apiClient.js` is the transport layer.** Every authenticated request goes through `apiCall()` (`apiClient.js:141`). It:

1. Reads the access token from `getStoredAuth()` (`apiClient.js:147`).
2. Attaches `Authorization: Bearer <token>` (`apiClient.js:149`).
3. Fires the request.
4. If the response is **401** and `skipRefreshOn401` is not set: calls `queuedTokenRefresh()` (`apiClient.js:174`), which calls `attemptTokenRefresh()` against `/api/users/auth/refresh`. If the refresh succeeds, it retries the original request once with the new access token. If the refresh fails, it dispatches an `auth:logout` event and redirects to `/login`.
5. The `queuedTokenRefresh` indirection (`apiClient.js:71`) ensures that ten parallel 401s do not fire ten refresh requests — only the first triggers a refresh, the others await the same promise.

**`authContext.jsx` is the React-state layer.** It:

1. Hydrates from storage on mount (`authContext.jsx:19`).
2. Exposes `auth`, `isAuthenticated`, `login(data, rememberMe)`, `logout()` via `useAuth()`.
3. Runs a **proactive refresh timer** (`authContext.jsx:54`): on every `access_token` change, it decodes the JWT, computes `expiresAt - now - 30s`, and schedules a `manualRefreshToken()` for that moment. So in the happy path the token is rotated before any 401 ever happens — the apiClient retry path is the fallback.
4. Runs an **inactivity tracker** (`authContext.jsx:118`) that pops `<InactivityWarning />` and ultimately calls `logout()` if the user is idle.

**Storage routing** (`authStorage.js`): tokens live in `sessionStorage` by default (cleared on tab close) and in `localStorage` when "Remember me" is checked. `getStoredAuth()` checks sessionStorage first, then localStorage, and tags the result with `storageType` so refresh writes back to the same one. `clearAuth()` wipes both, which matters if a stale token is sitting in the wrong place.

### WebSocket auth

REST gets the JWT via the `Authorization` header. WebSockets cannot set custom headers on `new WebSocket(...)` in browsers, so we pass it as a **query-string param**:

```
wss://host/api/users/ws/notifications/<user_id>?token=<jwt>
```

Server side, `notification_router.py:23` reads `token: str = ""` from the query, calls `get_me(token, session)` (the same function the REST `/auth/me` route uses), and either accepts the connection or closes it with a code:
- `4001` — missing or invalid token
- `4003` — token is valid but `me.id != user_id` (you are trying to subscribe to someone else's channel)

Game and chat services do the same trick with the same `?token=` param. This is the one place where a JWT ends up in a URL, which is mildly unfortunate (URLs end up in proxy logs) — the mitigation is the 15-minute lifetime.

---

## Part 3 — Things I learned the hard way

### `credential_id` vs `user.id`

We originally put `user.id` in the JWT. Two problems:

1. The `users` row might not exist yet at JWT-creation time, depending on the call order.
2. DM room slugs (`DM-4-5`) use `user.id`, but other services were extracting "the id from the JWT" and treating it as a `user.id` when it was sometimes a `credential_id`. The participant check failed silently and notifications went to the wrong room.

The rule I now follow: **JWT claims must be keys that are stable from the moment the JWT is minted**. `credential_id` is stable (we just verified the password against that row). `user.id` is not, in our schema, because the `users` row is created lazily.

### Hash the right thing with the right algorithm

- Passwords go through bcrypt because attackers can guess them. Cost factor matters.
- Refresh tokens go through sha256 because they are already 256 bits of CSPRNG entropy. Bcrypting a refresh token would just be slow for no security gain. The DB-leak property we want is "leaked rows cannot be replayed against the API", and sha256 gives us exactly that.
- The access token is not hashed because it is not stored. The signature is the proof.

### Single user-creation point

Earlier versions of `service.py` created the `users` row in three places: `authenticate()`, `refresh_access_token()`, and `get_me()`. Each had slightly different error handling. When the `display_name` column was added I had to change three spots and missed one in tests.

`_ensure_user()` is now the only function that inserts into `users`, and only `authenticate()` and `get_me()` call it. `refresh_access_token()` deliberately does not. The `users` row exists from first login onward; refresh does not need to re-check.

### Why proactive refresh *and* reactive 401-retry

I asked myself why we need both. The answer is: they cover different races.

- **Proactive** (the `authContext.jsx` timer) handles the common case: token is about to expire, refresh it 30s ahead. Zero failed requests, smooth UX.
- **Reactive** (the `apiClient.js` 401 handler) handles the edge cases the timer cannot: tab was suspended, system slept, clock skew, multiple tabs racing, the timer was cleared by a remount. The reactive path is the safety net.

Removing either makes the system fragile in a way that is hard to reproduce in dev.

---

## Part 4 — Open questions / things I might revisit

- **Refresh-token reuse detection.** Right now if an attacker steals a refresh token and uses it once, the legitimate client's next refresh fails with 401 and the user is logged out. We could turn that 401 into a "panic" signal: invalidate the entire `tokens` row for that credential. Not implemented.
- **JWT algorithm.** HS256 with a shared secret is fine for one team owning all three services. If we ever expose a public verifier (a CDN-edge auth check, say), RS256 with a public/private split would be cleaner.
- **Session invalidation on password change.** Currently changing a password does not delete the `tokens` row. Should it? Probably yes, but we have no password-change endpoint yet.
- **OAuth / 42 login.** Listed as a Minor module we did not pick. If a future cohort wants it, the place to add it is a new `/auth/oauth/callback` route that ends in the same `LoginResponse` shape — the rest of the stack would not need to change.

---

## Quick reference

| Thing | Value | Where |
|---|---|---|
| Password hash | bcrypt | `service.py:32` |
| Access token type | JWT, HS256 | `service.py:25` |
| Access token lifetime | 15 minutes | `service.py:19` |
| Access token claims | `sub`, `credential_id`, `exp` | `service.py:88` |
| Refresh token | 64-hex chars from `secrets.token_hex(32)` | `service.py:92` |
| Refresh token storage | sha256 hex in `tokens.refresh_token_hash` | `service.py:93`, `models/credentials.py:21` |
| Refresh token lifetime | 7 days | `service.py:20` |
| Refresh token rotation | On every refresh call | `service.py:128` |
| JWT secret source | `settings.JWT_SECRET_KEY` env var | `shared/config/settings.py:12` |
| Frontend token storage | sessionStorage by default, localStorage if "Remember me" | `context/authStorage.js:30` |
| 401 retry policy | Refresh once, retry once, logout on second failure | `utils/apiClient.js:170` |
| Proactive refresh trigger | 30s before `exp` | `context/authContext.jsx:69` |
| WS auth transport | `?token=<jwt>` query param | `ws/notification_router.py:28` |
| Single user-creation point | `_ensure_user()` called only by `authenticate()` and `get_me()` | `service.py:38` |
| Admin bootstrap | `users.is_admin` seeded at DB init; no login-time promotion | `models/user.py:18` |

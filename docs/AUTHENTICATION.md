# Authentication — How It Works

> Backend: `src/backend/user-service/`
> Frontend: `src/frontend/src/context/`

---

## Overview

Authentication spans three endpoints and two storage layers (DB + browser).

| Endpoint | Method | Auth required | Purpose |
|----------|--------|---------------|---------|
| `/api/users/auth/register` | POST | — | Create credentials |
| `/api/users/auth/login` | POST | — | Verify credentials, issue tokens, create User row |
| `/api/users/auth/me` | GET | Bearer token | Validate token, return current User |

---

## Registration flow

```
Client                        user-service                     PostgreSQL
  │                               │                               │
  │── POST /auth/register ────────▶│                               │
  │   {username, password}        │                               │
  │                               │── SELECT credentials WHERE ──▶│
  │                               │   username = ?                │
  │                               │◀─ (empty) ────────────────────│
  │                               │                               │
  │                               │  bcrypt.hashpw(password)      │
  │                               │  → store hash as UTF-8 str    │
  │                               │                               │
  │                               │── INSERT credentials ─────────▶│
  │                               │   (username, password_hash)   │
  │◀─ 201 {username} ─────────────│                               │
```

**Key decisions:**
- Password is hashed with **bcrypt** (salted, built-in cost factor). The hash is stored as a UTF-8 decoded string; on verification it is re-encoded to bytes before `bcrypt.checkpw`.
- If the username already exists the pre-insert SELECT returns early with 409. An `IntegrityError` guard on the DB UNIQUE constraint catches the concurrent-insert race condition.
- Registration only creates a row in `credentials`. The `users` profile row is created on first login.

---

## Login flow

```
Client                        user-service                     PostgreSQL
  │                               │                               │
  │── POST /auth/login ───────────▶│                               │
  │   {username, password}        │                               │
  │                               │── SELECT credentials ─────────▶│
  │                               │◀─ row ────────────────────────│
  │                               │                               │
  │                               │  bcrypt.checkpw(password,     │
  │                               │    stored_hash.encode())      │
  │                               │                               │
  │                               │  jwt.encode({sub, exp})       │
  │                               │  → access_token (not stored)  │
  │                               │                               │
  │                               │  secrets.token_hex(32)        │
  │                               │  → raw_refresh_token          │
  │                               │  sha256(raw) → hash           │
  │                               │                               │
  │                               │── UPSERT tokens ──────────────▶│
  │                               │   (credential_id,             │
  │                               │    refresh_token_hash,        │
  │                               │    expires_at)                │
  │                               │                               │
  │◀─ 200 {access_token,          │                               │
  │        token_type,            │                               │
  │        refresh_token} ────────│                               │
```

**Key decisions:**
- The **access token** is a signed JWT (HS256, `sub` = username). It is **never stored** — it is self-contained and expires after 30 minutes. The secret key is read from `settings.JWT_SECRET_KEY` (env var `JWT_SECRET_KEY`).
- The **refresh token** is a cryptographically random 64-hex-char string (`secrets.token_hex(32)`). Only its **SHA-256 hash** is stored in the DB — a DB leak cannot be used to replay sessions.
- `expires_at` is set to 30 days and stored alongside the hash for future revocation checks.
- On subsequent logins the existing `tokens` row is updated in-place (upsert); no duplicate rows accumulate.
- **No `user_id` in the login response.** The caller must hit `GET /auth/me` to resolve the profile id. This keeps `authenticate()` focused on credential verification only.
- The `users` profile row is **not** created at login time — it is created lazily on the first `GET /auth/me` call (see below).

---

## `GET /auth/me` flow

```
Client                        user-service                     PostgreSQL
  │                               │                               │
  │── GET /auth/me ───────────────▶│                               │
  │   Authorization: Bearer <tok> │                               │
  │                               │  jwt.decode(token,            │
  │                               │    JWT_SECRET_KEY)            │
  │                               │  → username from sub          │
  │                               │                               │
  │                               │── SELECT credentials ─────────▶│
  │                               │   WHERE username = ?          │
  │                               │◀─ row ────────────────────────│
  │                               │                               │
  │                               │── SELECT users ───────────────▶│
  │                               │   WHERE credential_id = ?     │
  │                               │◀─ row (or empty) ─────────────│
  │                               │                               │
  │                               │  if no row:                   │
  │                               │── INSERT users ───────────────▶│
  │                               │   (username, credential_id)   │
  │                               │◀─ new row ─────────────────────│
  │                               │                               │
  │◀─ 200 {id, username, ...} ────│                               │
```

**This is the only place a `users` row is created.** `authenticate()` no longer touches the `users` table — `get_me()` is the single creation point, ensuring `credential_id` is always set.

**Error responses:**
| Condition | HTTP |
|-----------|------|
| Token expired (`exp` in the past) | 401 `Token expired` |
| Malformed / invalid signature | 401 `Invalid token` |
| `sub` claim missing | 401 `Invalid token` |
| Credential not found in DB | 401 `Invalid token` |

**`jose` exception mapping:**
- `ExpiredSignatureError` → 401 "Token expired" (specific message for clients to trigger refresh)
- `JWTError` (all other decode failures) → 401 "Invalid token"

---

## Frontend — AuthProvider

Token state is managed by a React context (`src/frontend/src/context/authContext.jsx`) so any component can call `useAuth()` without touching storage directly.

```
Login.jsx
  │── POST /auth/login ──▶ backend
  │◀── {access_token, refresh_token, token_type}   ← no user_id
  │
  └── login(data, rememberMe)   ← from useAuth()
        │
        ▼
   AuthProvider state          authStorage.js
   { access_token,     ──────▶  rememberMe=true  → localStorage
     refresh_token,              rememberMe=false → sessionStorage
     token_type }

Profile.jsx (and any page needing user identity)
  │── GET /auth/me ──▶ backend
  │   Authorization: Bearer <access_token>
  │◀── {id, username, ...}
  │
  └── uses id for subsequent profile / match-history fetches
```

**Storage rules (`authStorage.js`):**
- `rememberMe = true` → tokens in `localStorage` (survive browser close)
- `rememberMe = false` (default) → tokens in `sessionStorage` (cleared on tab close)
- The other storage is always cleared to avoid stale tokens in both places simultaneously.
- On `AuthProvider` mount, `getStoredAuth()` checks `sessionStorage` first, then `localStorage`, and rehydrates state.

**`useAuth()` returns:**
| Field | Type | Notes |
|-------|------|-------|
| `auth.access_token` | string \| null | Current JWT |
| `auth.refresh_token` | string \| null | Current refresh token |
| `auth.token_type` | string \| null | Always `"bearer"` |
| `isAuthenticated` | boolean | `true` iff all three fields are set |
| `login(data, rememberMe)` | function | Sets state + writes storage |
| `logout()` | function | Clears state + clears both storages |

**Usage requirement:** any component calling `useAuth()` must be a descendant of `<AuthProvider>`. Missing the wrapper throws `"useAuth must be used within an AuthProvider"`.

---

## Database schema

### `credentials`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PK, autoincrement | |
| `username` | VARCHAR | NOT NULL, UNIQUE | Natural key — enforced at DB level |
| `password` | VARCHAR | NOT NULL | bcrypt hash, stored as UTF-8 string |

### `tokens`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PK, autoincrement | |
| `credential_id` | INTEGER | FK → credentials.id, NOT NULL | One row per credential (upsert on login) |
| `token_type` | VARCHAR | NOT NULL | Always `"bearer"` |
| `refresh_token_hash` | VARCHAR | NOT NULL | SHA-256 of the raw refresh token |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `expires_at` | TIMESTAMPTZ | NOT NULL | now() + 30 days |

### `users`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | INTEGER | PK, autoincrement | Profile ID returned to clients |
| `username` | VARCHAR | NOT NULL, UNIQUE | Copied from credentials at first login |
| `display_name` | VARCHAR | nullable | User-editable display name |
| `status` | VARCHAR | NOT NULL, default `"offline"` | |
| `bio` | TEXT | nullable | |
| `avatar_url` | VARCHAR | nullable | |
| `dark_mode` | BOOLEAN | NOT NULL, default `false` | |
| `credential_id` | INTEGER | FK → credentials.id, NOT NULL, UNIQUE | Links profile to auth; enforced NOT NULL by migration `082195afefdc` |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

---

## Security properties

| Property | How it is achieved |
|----------|--------------------|
| Passwords never stored in plaintext | bcrypt with per-password salt |
| DB leak cannot replay sessions | Access tokens not stored; refresh tokens stored as SHA-256 hash only |
| JWT secret not hardcoded | `JWT_SECRET_KEY` env var via `shared/config/settings.py` |
| Concurrent duplicate registration | DB UNIQUE constraint + `IntegrityError` handler |
| Refresh tokens are unpredictable | `secrets.token_hex(32)` — CSPRNG, 256 bits of entropy |
| Token expiry | Access token: 30 min (JWT `exp`); refresh token: 30 days (`expires_at`) |
| Expired vs invalid token distinction | `ExpiredSignatureError` caught separately → 401 "Token expired" (enables client-side refresh logic) |
| Response shape is explicit | `LoginResponse` / `RegisterResponse` / `MeResponse` Pydantic models — no ORM fields leak |
| Every user row has a credential | `credential_id NOT NULL` enforced at DB level (migration `082195afefdc`) |
| Single user-creation point | `users` row only created in `get_me()` — `authenticate()` never touches the `users` table |
| Browser token isolation | `sessionStorage` default; `localStorage` only when "Remember me" is checked |

---

## Source files

### Backend

| File | Role |
|------|------|
| `src/backend/user-service/main.py` | FastAPI routes: `POST /auth/login`, `POST /auth/register`, `GET /auth/me` |
| `src/backend/user-service/service.py` | Business logic: `authenticate`, `register_credentials`, `get_me` |
| `src/backend/user-service/schemas.py` | Pydantic I/O models: `Login`, `LoginResponse`, `RegisterRequest`, `RegisterResponse`, `MeResponse` |
| `src/backend/user-service/models/credentials.py` | SQLAlchemy ORM: `Credentials`, `Tokens` |
| `src/backend/user-service/models/user.py` | SQLAlchemy ORM: `User` (`credential_id NOT NULL`) |
| `src/backend/shared/config/settings.py` | `JWT_SECRET_KEY` setting loaded from env |
| `src/backend/user-service/alembic/versions/` | Migration history — includes `082195afefdc` enforcing `credential_id NOT NULL` |

### Frontend

| File | Role |
|------|------|
| `src/frontend/src/context/authContext.jsx` | `AuthProvider` component + `useAuth()` hook |
| `src/frontend/src/context/authStorage.js` | `getStoredAuth` / `saveAuth` / `clearAuth` — sessionStorage/localStorage routing |
| `src/frontend/src/pages/Login.jsx` | Login form — calls `login()` from `useAuth()` on success |
| `src/frontend/src/pages/Profile.jsx` | Calls `GET /auth/me` with Bearer token to resolve user id before fetching profile |

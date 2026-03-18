# Authentication — How It Works

> Part of the user-service (`src/backend/user-service/`).

---

## Overview

Authentication is handled by two endpoints on the user-service:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/users/auth/register` | POST | Create a new account |
| `/api/users/auth/login` | POST | Verify credentials, issue tokens |

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
- Password is hashed with **bcrypt** (salted, cost factor built-in). The hash is stored as a UTF-8 decoded string; on verification it is re-encoded to bytes before `bcrypt.checkpw`.
- If the username already exists the pre-insert SELECT returns early with 409. An `IntegrityError` guard on the DB unique constraint catches the concurrent-insert race condition.

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
  │                               │── INSERT tokens ──────────────▶│
  │                               │   (credential_id, type,       │
  │                               │    refresh_token_hash,        │
  │                               │    created_at, expires_at)    │
  │◀─ 200 {access_token,          │                               │
  │        token_type,            │                               │
  │        refresh_token} ────────│                               │
```

**Key decisions:**
- The **access token** is a signed JWT (HS256). It is **never stored** — it is self-contained and expires after 30 minutes.
- The **refresh token** is a cryptographically random 64-hex-char string generated with `secrets.token_hex(32)`. Only its **SHA-256 hash** is stored in the DB, so a DB leak cannot be used to replay sessions.
- `expires_at` is set to 30 days from issuance and stored alongside the hash to enable future revocation checks.

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
| `credential_id` | INTEGER | FK → credentials.id, NOT NULL | |
| `token_type` | VARCHAR | NOT NULL | Always `"bearer"` |
| `refresh_token_hash` | VARCHAR | NOT NULL | SHA-256 of the raw refresh token |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `expires_at` | TIMESTAMPTZ | NOT NULL | now() + 30 days |

---

## Security properties

| Property | How it is achieved |
|----------|--------------------|
| Passwords never stored in plaintext | bcrypt with per-password salt |
| DB leak cannot replay sessions | Access tokens not stored; refresh tokens stored as SHA-256 hash only |
| Concurrent duplicate registration | DB UNIQUE constraint + `IntegrityError` handler |
| Refresh tokens are unpredictable | `secrets.token_hex(32)` — CSPRNG, 256 bits of entropy |
| Token expiry | Access token: 30 min (JWT `exp`); refresh token: 30 days (`expires_at`) |
| Response shape is explicit | `LoginResponse` / `RegisterResponse` Pydantic models — no ORM fields leak |

---

## Source files

| File | Role |
|------|------|
| `src/backend/user-service/main.py` | FastAPI routes, `AsyncSession` dependency injection |
| `src/backend/user-service/service.py` | Business logic: `authenticate`, `register_credentials` |
| `src/backend/user-service/schemas.py` | Pydantic I/O models: `Login`, `RegisterRequest`, `LoginResponse`, `RegisterResponse` |
| `src/backend/user-service/models/credentials.py` | SQLAlchemy ORM: `Credentials`, `Tokens` |
| `src/backend/user-service/alembic/versions/` | Migration history for credentials + tokens tables |

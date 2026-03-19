# Alembic — Database Migration Guide

## SQLAlchemy vs Alembic — Two Tools, One Job Each

These are two separate libraries that work together. Confusing them is the most
common source of "why didn't my migration pick up my model?" questions.

### SQLAlchemy — the ORM (Object-Relational Mapper)

An ORM is the bridge between Python code and the database. Instead of writing raw SQL,
you define Python classes (models) and SQLAlchemy translates operations on those objects
into SQL queries automatically.

```python
# Without ORM — raw SQL
await db.execute("SELECT * FROM credentials WHERE username = $1", username)

# With SQLAlchemy ORM — plain Python
await db.execute(select(Credentials).where(Credentials.username == username))
```

```python
# Without ORM — raw SQL (INSERT a new user)
await db.execute(
    "INSERT INTO credentials (username, password) VALUES ($1, $2)",
    username, hashed_password
)
await db.execute("COMMIT")

# With SQLAlchemy ORM — plain Python
credential = Credentials(username=username, password=hashed_password)
db.add(credential)
await db.commit()
await db.refresh(credential)  # populates credential.id from the DB
```

```python
# Without ORM — raw SQL (INSERT with unique-constraint collision guard)
try:
    await db.execute(
        "INSERT INTO credentials (username, password) VALUES ($1, $2)",
        username, hashed_password
    )
    await db.execute("COMMIT")
except asyncpg.UniqueViolationError:
    await db.execute("ROLLBACK")
    raise HTTPException(status_code=409, detail="Username already taken")

# With SQLAlchemy ORM — plain Python
try:
    db.add(Credentials(username=username, password=hashed_password))
    await db.commit()
except IntegrityError:
    await db.rollback()
    raise HTTPException(status_code=409, detail="Username already taken")
```

The model class *describes* the table — its columns, types, constraints, and
relationships. SQLAlchemy uses that description both to query the DB at runtime and
to let Alembic know what the schema *should* look like.

### Alembic — the migration tool

Alembic manages the **version history of the DB schema**. It compares the current
state of SQLAlchemy models against the live database and generates a migration file
(a Python script with `upgrade()` and `downgrade()` functions) describing what SQL
to run to bring the DB in sync.

Each applied migration is recorded in a version table (e.g. `alembic_version_user`),
so Alembic always knows which revisions have already been applied and which are pending.

### The analogy

| Concept | Git | This project |
|---|---|---|
| Track file content | File system | SQLAlchemy models |
| Record change history | Git commits | Alembic migrations |
| Tool | Git | Alembic |
| Underlying storage | `.git/` | `alembic_version_*` tables |

SQLAlchemy is the file system — it knows what exists right now.
Alembic is Git — it knows how you got here and how to go back.

---

Alembic is the **single source of truth** for the database schema in this project.
`services/database/init.sql` no longer creates tables — Alembic does.

Each backend service runs `alembic upgrade head` automatically on container startup
via its `entrypoint.sh`.

---

## How It Works

```
Container starts
    └─► entrypoint.sh
            ├─► cd /app/service
            ├─► alembic upgrade head   ← applies all pending migrations
            └─► uvicorn service.main:app
```

Alembic reads the database URL from environment variables (via `shared/config/settings.py`),
not from `alembic.ini` (which has a placeholder URL).

Each service tracks its own migration history in a separate version table:

| Service | Version table |
|---------|--------------|
| user-service | `alembic_version_user` |
| game-service | `alembic_version_game` |
| chat-service | `alembic_version_chat` |

This prevents version conflicts when all services share the same database.

---

## Changelog Structure

Migrations live in each service's `alembic/versions/` directory:

```
src/backend/user-service/alembic/versions/
├── 20260310_d7ad2f503e4e_init.py                      ← Revision 1: CREATE TABLE users
├── 20260315_a1b2c3d4e5f6_add_avatar_url_to_users.py   ← Revision 2: ADD COLUMN avatar_url
└── 20260320_b2c3d4e5f6a7_add_display_name_to_users.py ← Revision 3: ADD COLUMN display_name
```

File naming format: `YYYYMMDD_{revision_id}_{slug}.py`

Each file contains:
- A unique **revision ID** (auto-generated hash, used internally by Alembic)
- A `down_revision` pointing to the previous revision (forms the chain)
- `upgrade()` — what to apply (`CREATE TABLE`, `ALTER TABLE ADD COLUMN`, etc.)
- `downgrade()` — how to undo it (`DROP TABLE`, `ALTER TABLE DROP COLUMN`, etc.)

---

## Creating a New Migration

Always generate migrations from inside the running container so Alembic can
compare the live database against your SQLAlchemy models.

### Makefile targets (recommended)

| Target | What it does |
|--------|-------------|
| `make migrate-user MSG=<name>` | Generate migration for user-service |
| `make migrate-game MSG=<name>` | Generate migration for game-service |
| `make migrate-chat MSG=<name>` | Generate migration for chat-service |
| `make migrate-upgrade` | Apply pending migrations on all 3 services |

```bash
# Generate
make migrate-user MSG=add_avatar_url_and_display_name_to_users

# Review the generated file in src/backend/user-service/alembic/versions/
# Then apply
make migrate-upgrade
```

### Manual equivalent

```bash
docker compose exec user-service sh -c \
  "cd /app/service && alembic revision --autogenerate -m 'add_avatar_url_to_users'"
```

This creates a new file in `alembic/versions/`. **Always review it before applying** —
autogenerate can miss things (e.g. check constraints, server defaults).

Name migrations descriptively:
```bash
# Good
make migrate-user MSG=add_avatar_url_to_users
make migrate-game MSG=add_tournaments_table
make migrate-chat MSG=add_room_members

# Bad
make migrate-user MSG=update
make migrate-user MSG=fix
```

---

## Checking Current State

```bash
# Which revision is the DB currently at?
docker compose exec user-service sh -c "cd /app/service && alembic current"

# Full migration history
docker compose exec user-service sh -c "cd /app/service && alembic history --verbose"

# Preview what the next upgrade would execute (no DB changes)
docker compose exec user-service sh -c "cd /app/service && alembic upgrade head --sql"
```

### Inspecting Tables

```bash
# List all tables (excludes alembic version trackers)
make show-tables

# Full schema: all tables with columns, types, nullability, defaults
make show-tables-full
```

---

## Rolling Back

Roll back one step:
```bash
docker compose exec user-service sh -c "cd /app/service && alembic downgrade -1"
```

Roll back to a specific revision (use the revision ID from `alembic history`):
```bash
docker compose exec user-service sh -c "cd /app/service && alembic downgrade d7ad2f503e4e"
```

Roll back everything (empty schema for this service):
```bash
docker compose exec user-service sh -c "cd /app/service && alembic downgrade base"
```

> **Note:** `downgrade base` on user-service drops the `users` table.
> Use `make fclean && make` instead if you want a full environment reset.

---

## Adding a Column — Full Workflow Example

Scenario: adding `avatar_url` and `display_name` to `users`.

**1. Update the model**

```python
# src/backend/user-service/models/user.py
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True)
    password_hash = Column(String)
    status = Column(String(20), default="offline")
    avatar_url = Column(String, nullable=True)       # ← new
    display_name = Column(String(50), nullable=True) # ← new
    created_at = Column(TIMESTAMP, default=func.now())
```

**2. Generate the migration**

```bash
docker compose exec user-service sh -c \
  "cd /app/service && alembic revision --autogenerate -m 'add_avatar_and_display_name_to_users'"
```

**3. Review the generated file** — verify `upgrade()` and `downgrade()` look correct.

**4. Apply it** (happens automatically on next container restart, or manually):

```bash
docker compose exec user-service sh -c "cd /app/service && alembic upgrade head"
```

**5. Verify**

```bash
docker compose exec db psql -U $DB_USER -d $DB_NAME -c "\d users"
```

**6. Commit both files together**

```bash
git add src/backend/user-service/models/user.py
git add src/backend/user-service/alembic/versions/<new_revision>.py
git commit -m "feat: add avatar_url and display_name to users"
```

---

## Adding a New Table — Full Workflow Example

Scenario: adding `credentials` and `tokens` tables to user-service (the actual work done in PR #130).

**1. Create the model file**

New tables need a SQLAlchemy model class. Create it in the service's `models/` directory:

```python
# src/backend/user-service/models/credentials.py
from sqlalchemy import Column, ForeignKey, Integer, String, TIMESTAMP
from sqlalchemy.sql import func
from shared.database import Base


class Credentials(Base):
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=False)          # bcrypt hash stored as str


class Tokens(Base):
    __tablename__ = "tokens"

    id = Column(Integer, primary_key=True)
    credential_id = Column(Integer, ForeignKey("credentials.id"), nullable=False)
    token_type = Column(String, nullable=False)
    refresh_token_hash = Column(String, nullable=False) # SHA-256 hash, never the raw token
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
```

**2. Import the model in Alembic's `env.py`**

Alembic's autogenerate compares SQLAlchemy's `Base.metadata` against the live DB.
For it to see your new model, it must be imported before `run_migrations_*()` is called.

```python
# src/backend/user-service/alembic/env.py  (target_metadata section)
from shared.database import Base
import service.models.credentials  # ← import every new model module here
```

> **Why this step?** Python only adds a class to `Base.metadata` when the module
> containing it is imported. Skipping this import causes autogenerate to produce an
> empty migration — no `CREATE TABLE` statements — even though the model exists.

**3. Generate the migration**

```bash
make migrate-user MSG=add_credentials_and_tokens
```

Or manually:

```bash
docker compose exec user-service sh -c \
  "cd /app/service && alembic revision --autogenerate -m 'add_credentials_and_tokens'"
```

**4. Review the generated file**

Open `src/backend/user-service/alembic/versions/<revision>_add_credentials_and_tokens.py`
and verify:

- `upgrade()` contains `op.create_table("credentials", ...)` and `op.create_table("tokens", ...)`
- `downgrade()` drops them **in reverse dependency order** — `tokens` before `credentials`
  (foreign key constraint: `tokens.credential_id` → `credentials.id`)
- Column types, nullability, and defaults match the model

```python
def upgrade() -> None:
    op.create_table(
        "credentials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("password", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_table(
        "tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("credential_id", sa.Integer(), nullable=False),
        sa.Column("token_type", sa.String(), nullable=False),
        sa.Column("refresh_token_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["credential_id"], ["credentials.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("tokens")      # drop child first (FK dependency)
    op.drop_table("credentials")
```

**5. Apply it**

```bash
make migrate-upgrade
```

Or restart the container — `entrypoint.sh` runs `alembic upgrade head` automatically.

**6. Verify**

```bash
# List all tables — credentials and tokens should appear
make show-tables

# Inspect columns, types, nullability
make show-tables-full
```

**7. Commit model + migration together**

```bash
git add src/backend/user-service/models/credentials.py
git add src/backend/user-service/alembic/versions/<new_revision>.py
git commit -m "feat: add credentials and tokens tables"
```

### Common pitfall — empty migration

If `upgrade()` is empty (`pass`), Alembic didn't see your model. Check:

1. The model module is imported in `env.py` (Step 2)
2. The class inherits from `Base` (not a plain Python class)
3. You're running the command inside the container (not on the host), so Alembic connects to the real PostgreSQL instance

---

## Rules

1. **Never edit a migration that has already been applied** to a shared DB. Create a new revision instead.
2. **Always implement `downgrade()`** — even a simple `op.drop_table()` or `op.drop_column()`.
3. **Commit migrations with the model changes** that triggered them — same commit.
4. **Never run `alembic stamp`** unless you know exactly what you are doing.

---

## Querying Relational Data with SQLAlchemy ORM

### 1-to-1 — Credentials → Tokens

Each `Credentials` row has at most one active `Tokens` row (one user, one session).
The FK lives on the child (`tokens.credential_id → credentials.id`).

```python
# Find the active token for a given username
result = await db.execute(
    select(Tokens)
    .join(Credentials, Tokens.credential_id == Credentials.id)
    .where(Credentials.username == username)
)
token = result.scalars().first()
```

Raw SQL equivalent:
```sql
SELECT tokens.*
FROM tokens
JOIN credentials ON tokens.credential_id = credentials.id
WHERE credentials.username = 'alice';
```

> **In this project:** `authenticate()` in `user-service/service.py` uses this pattern
> to look up the stored refresh token hash after login.

---

### 1-to-N — ChatRoom → Messages

One `ChatRoom` has many `Message` rows. The FK lives on the child (`messages.room_id → chat_rooms.id`).

```python
# Fetch the 50 most recent messages in a room, oldest-first
result = await db.execute(
    select(Message)
    .where(Message.room_id == room.id)
    .order_by(Message.created_at.desc())
    .limit(50)
)
messages = list(reversed(result.scalars().all()))
```

Raw SQL equivalent:
```sql
SELECT * FROM (
    SELECT * FROM messages
    WHERE room_id = 3
    ORDER BY created_at DESC
    LIMIT 50
) sub
ORDER BY created_at ASC;
```

> **In this project:** `get_room_history()` in `chat-service/persistence.py` uses
> this exact query to replay history to a newly connected WebSocket client.

---

### N-to-N — Players ↔ Matches

A match has two players; a player participates in many matches.
This is a many-to-many relationship. In this project it is modelled without a
SQLAlchemy `relationship()` (because `player_id` is a cross-service integer, not a
local FK), so the join is written explicitly.

**How it is stored today** (`game-service/models/match.py`):

```python
class Match(Base):
    __tablename__ = "matches"
    id         = Column(Integer, primary_key=True)
    player1_id = Column(Integer, nullable=False)  # references user-service User.id
    player2_id = Column(Integer, nullable=False)
    winner_id  = Column(Integer, nullable=True)
    score_p1   = Column(Integer, default=0)
    score_p2   = Column(Integer, default=0)
    status     = Column(String(20))
```

**Query — all matches a player was involved in:**

```python
result = await db.execute(
    select(Match).where(
        (Match.player1_id == user_id) | (Match.player2_id == user_id)
    ).order_by(Match.started_at.desc())
)
matches = result.scalars().all()
```

Raw SQL equivalent:
```sql
SELECT * FROM matches
WHERE player1_id = 7 OR player2_id = 7
ORDER BY started_at DESC;
```

**If you needed a true join table** (e.g. tournament participants), the pattern is:

```python
# Association table — no model class needed, just a Table object
tournament_players = Table(
    "tournament_players",
    Base.metadata,
    Column("tournament_id", Integer, ForeignKey("tournaments.id"), primary_key=True),
    Column("user_id",       Integer,                               primary_key=True),
)

# Query: all user_ids in tournament 5
result = await db.execute(
    select(tournament_players.c.user_id)
    .where(tournament_players.c.tournament_id == 5)
)
user_ids = result.scalars().all()
```

---

### Cross-service references — no ORM join possible

`Match.player1_id` and `Message.user_id` point to rows in **user-service's** database,
which is a separate PostgreSQL schema. SQLAlchemy cannot join across service boundaries.

The pattern used in this project:

```python
# 1. Fetch the match from game-service DB
result = await db.execute(select(Match).where(Match.id == match_id))
match = result.scalars().first()

# 2. Call user-service over HTTP to resolve player names
# (httpx, or the internal service URL via docker-compose networking)
player1 = await http_client.get(f"http://user-service/users/{match.player1_id}")
```

Raw SQL cannot solve this — the tables live in different services. This is the
trade-off of a microservices architecture: you gain service isolation, you lose
DB-level joins.

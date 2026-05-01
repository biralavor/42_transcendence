#!/bin/sh
# Bootstrap users that must always exist for the platform to function:
#   - AI       (id=0, password "123dev", non-admin) — opponent for AI matches
#   - admin    (password "123", is_admin=true)      — site administrator
#
# Idempotent: skips rows whose username already exists.
# Runs every time `make` (or `make db-init`) is invoked, after migrations.
set -e

echo "[database_init] Seeding bootstrap users..."

python3 - <<'PYEOF'
import asyncio
import os
import bcrypt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

DATABASE_URL = "postgresql+asyncpg://{}:{}@{}:{}/{}".format(
    os.environ.get("DB_USER",     "postgres"),
    os.environ.get("DB_PASSWORD", "postgres"),
    os.environ.get("DB_HOST",     "db"),
    os.environ.get("DB_PORT",     "5432"),
    os.environ.get("DB_NAME",     "transcendence_db"),
)

USERS = [
    dict(id=0, username="AI", email="ai@example.com", password="123dev",
         display_name="AI Opponent", status="offline",
         bio="I'm the AI.", avatar_url=None, is_admin=False),
    dict(username="admin", email="admin@example.com", password="123",
         display_name="Admin", status="offline",
         bio="Site administrator.", avatar_url=None, is_admin=True),
]


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


async def init():
    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        for u in USERS:
            # ── credentials ─────────────────────────────────────────
            existing = await session.execute(
                text("SELECT id FROM credentials WHERE username = :u"),
                {"u": u["username"]},
            )
            row = existing.fetchone()
            if row:
                cred_id = row[0]
                print(f"  [skip] credentials '{u['username']}' already exist (id={cred_id})")
            else:
                pw_hash = _hash(u["password"])
                if "id" in u:
                    await session.execute(
                        text("INSERT INTO credentials (id, username, email, password) "
                             "VALUES (:id, :u, :e, :p)"),
                        {"id": u["id"], "u": u["username"], "e": u["email"], "p": pw_hash},
                    )
                    cred_id = u["id"]
                else:
                    result = await session.execute(
                        text("INSERT INTO credentials (username, email, password) "
                             "VALUES (:u, :e, :p) RETURNING id"),
                        {"u": u["username"], "e": u["email"], "p": pw_hash},
                    )
                    cred_id = result.fetchone()[0]
                print(f"  [ok]   credentials '{u['username']}' created (id={cred_id})")

            # ── user row ────────────────────────────────────────────
            existing_user = await session.execute(
                text("SELECT id FROM users WHERE username = :u"),
                {"u": u["username"]},
            )
            if existing_user.fetchone():
                print(f"  [skip] user '{u['username']}' already exists")
                continue

            cols = ["username", "display_name", "status", "bio",
                    "avatar_url", "credential_id", "is_admin"]
            vals = [":username", ":display_name", ":status", ":bio",
                    ":avatar_url", ":credential_id", ":is_admin"]
            params = {
                "username": u["username"],
                "display_name": u["display_name"],
                "status": u["status"],
                "bio": u["bio"],
                "avatar_url": u["avatar_url"],
                "credential_id": cred_id,
                "is_admin": u["is_admin"],
            }
            if "id" in u:
                cols.insert(0, "id")
                vals.insert(0, ":id")
                params["id"] = u["id"]

            await session.execute(
                text(f"INSERT INTO users ({', '.join(cols)}) "
                     f"VALUES ({', '.join(vals)})"),
                params,
            )
            print(f"  [ok]   user '{u['username']}' created (is_admin={u['is_admin']})")

        await session.commit()

    await engine.dispose()
    print("[database_init] Done.")


asyncio.run(init())
PYEOF

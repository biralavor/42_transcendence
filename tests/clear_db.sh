#!/bin/sh
# Wipe all dev/test data from the database AND reset auto-increment sequences.
# Used by `make clear-db` and `make seed` (which calls clear-db first, then
# seeds test users via seed_dev.py, then restores AI + admin via db-init).
#
# TRUNCATE ... RESTART IDENTITY CASCADE is intentional:
#   - RESTART IDENTITY resets SERIAL sequences so the next insert starts at 1
#   - CASCADE wipes FK-dependent rows (e.g. user_login_days when users is hit)
#   - the try/except below tolerates missing tables on partially-migrated DBs
set -e

echo "[clear_db] Wiping dev/test tables and resetting sequences..."

python3 - <<'PYEOF'
import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

DATABASE_URL = "postgresql+asyncpg://{}:{}@{}:{}/{}".format(
    os.environ.get("DB_USER",     "postgres"),
    os.environ.get("DB_PASSWORD", "postgres"),
    os.environ.get("DB_HOST",     "db"),
    os.environ.get("DB_PORT",     "5432"),
    os.environ.get("DB_NAME",     "transcendence_db"),
)

# Tables truncated for a clean test/dev state. CASCADE handles FK-dependent
# tables not listed here (e.g. user_login_days follows users).
TABLES = [
    "tokens", "friendships", "matches", "messages", "notifications",
    "tournament_matches", "tournament_participants", "tournaments",
    "blocks", "users", "chat_rooms", "credentials",
]


async def clear():
    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        try:
            await session.execute(
                text(f"TRUNCATE TABLE {', '.join(TABLES)} RESTART IDENTITY CASCADE")
            )
            await session.commit()
            print(f"  [ok]   truncated {len(TABLES)} tables (RESTART IDENTITY CASCADE)")
        except Exception as e:
            await session.rollback()
            print(f"  [warn] truncation failed (some tables might not exist): {e}")

    await engine.dispose()
    print("[clear_db] Done.")


asyncio.run(clear())
PYEOF

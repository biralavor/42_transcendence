import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from alembic import context

# ---------------------------------------------------------------------------
# Adjust sys.path so that "shared" (two levels up from this file) is importable.
# Layout:  src/backend/chat-service/alembic/env.py
#                       ^shared is at src/backend/shared
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from shared.config.settings import settings  # noqa: E402
from shared.database import Base             # noqa: E402

# NOTE: "from service.models..." cannot be used here because service.py
# shadows the service package when /app/service/ is the working directory.
# Import models directly — they are importable from the cwd.
from models.chat_room import ChatRoom  # noqa: E402, F401
from models.message import Message     # noqa: E402, F401

# Tables owned by this service — Alembic will ONLY manage these.
_SERVICE_TABLES = {"chat_rooms", "messages"}

# Each service gets its own version-tracking table so they don't collide.
_VERSION_TABLE = "alembic_version_chat"

# ---------------------------------------------------------------------------
# Alembic Config object
# ---------------------------------------------------------------------------
config = context.config
config.set_main_option("sqlalchemy.url", settings.SQLALCHEMY_DATABASE_URI)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def include_object(obj, name, type_, reflected, compare_to):
    """Only manage tables that belong to this service."""
    if type_ == "table":
        return name in _SERVICE_TABLES
    return True


# ---------------------------------------------------------------------------
# Migration runners
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no live DB connection needed)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table=_VERSION_TABLE,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table=_VERSION_TABLE,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode with an async engine."""
    connectable: AsyncEngine = create_async_engine(
        settings.SQLALCHEMY_DATABASE_URI,
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())

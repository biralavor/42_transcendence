import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from alembic import context

# ---------------------------------------------------------------------------
# Container layout (entrypoint runs: cd /app/service && alembic upgrade head):
#
#   /app/
#   ├── service/          ← user-service source; CWD when alembic runs
#   │   ├── alembic/
#   │   │   └── env.py   ← this file  (__file__ = /app/service/alembic/env.py)
#   │   └── models/
#   │       └── user.py
#   └── shared/           ← shared library
#       ├── config/
#       │   └── settings.py
#       └── database/
#
# We need two directories on sys.path:
#   /app          → makes "shared.*" importable
#   /app/service  → makes "models.*" importable
#
# NOTE: "from service.models..." cannot be used here because user-service has a
# service.py file that shadows the service/ package when /app/service is on sys.path.
# ---------------------------------------------------------------------------
_here = os.path.dirname(os.path.abspath(__file__))        # /app/service/alembic
_service_root = os.path.abspath(os.path.join(_here, ".."))  # /app/service
_app_root = os.path.abspath(os.path.join(_here, "..", ".."))  # /app

for _p in (_app_root, _service_root):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from shared.config.settings import settings  # noqa: E402
from shared.database import Base             # noqa: E402

# Import the service models so Alembic can detect them in Base.metadata
from models.user import User  # noqa: E402, F401

# Tables owned by this service — Alembic will ONLY manage these.
_SERVICE_TABLES = {"users"}

# Each service gets its own version-tracking table so they don't collide.
_VERSION_TABLE = "alembic_version_user"

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

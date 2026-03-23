"""
Host-side test path setup for chat-service.

In Docker, the Dockerfile copies chat-service/ → /app/service/ and uvicorn
runs as `service.main:app` from WORKDIR /app, so `service.` imports resolve
naturally.  On the host the directory is named chat-service/ (a dash makes it
unimportable as a package), so we register a `service` entry in sys.modules
that points to the same directory — mirroring the Docker layout without a
real rename.
"""
import sys
import types
from pathlib import Path

_service_dir = Path(__file__).resolve().parents[1]  # .../chat-service
_backend_dir = _service_dir.parent                   # .../src/backend

# _service_dir → `from main import app` resolves
# _backend_dir → `from shared.ws.manager import` resolves
sys.path.insert(0, str(_backend_dir))
sys.path.insert(0, str(_service_dir))

# Register 'service' package pointing to chat-service/
# so `from service.ws.router import router` works on the host.
if "service" not in sys.modules:
    _mod = types.ModuleType("service")
    _mod.__path__ = [str(_service_dir)]
    _mod.__package__ = "service"
    sys.modules["service"] = _mod

# Patch the shared database engine to use NullPool so that concurrent
# WebSocket handlers in tests each get a fresh connection (avoids the
# asyncpg "another operation is in progress" error when two WS sessions
# open at the same time and the pool hands them the same connection).
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
import shared.database as _db
from shared.config.settings import settings

_test_engine = create_async_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    echo=settings.DB_ECHO,
    poolclass=NullPool,
)
_db.engine = _test_engine
_db.AsyncSessionLocal = async_sessionmaker(
    _test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

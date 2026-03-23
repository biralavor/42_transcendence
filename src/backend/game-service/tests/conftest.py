"""
Host-side test path setup for game-service.

In Docker, the Dockerfile copies game-service/ → /app/service/ and uvicorn
runs as `service.main:app` from WORKDIR /app, so `service.` imports resolve
naturally.  On the host the directory is named game-service/ (a dash makes it
unimportable as a package), so we register a `service` entry in sys.modules
that points to the same directory — mirroring the Docker layout without a
real rename.

Also provides a `get_db` dependency override that returns a mock AsyncSession
so tests can run without a real PostgreSQL connection.
"""
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

_service_dir = Path(__file__).resolve().parents[1]  # .../game-service
_backend_dir = _service_dir.parent                   # .../src/backend

# _service_dir → `from main import app` resolves
# _backend_dir → `from shared.ws.manager import` resolves
sys.path.insert(0, str(_backend_dir))
sys.path.insert(0, str(_service_dir))

# Register 'service' package pointing to game-service/
# so `from service.ws.router import router` works on the host.
if "service" not in sys.modules:
    _mod = types.ModuleType("service")
    _mod.__path__ = [str(_service_dir)]
    _mod.__package__ = "service"
    sys.modules["service"] = _mod


def _make_empty_session():
    """Return a mock AsyncSession whose execute() yields an empty scalars result."""
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = []

    result_mock = MagicMock()
    result_mock.scalars.return_value = scalars_mock

    session = AsyncMock()
    session.execute.return_value = result_mock
    return session


@pytest.fixture
def mock_db_session():
    return _make_empty_session()


@pytest.fixture(autouse=True)
def override_get_db(mock_db_session):
    """Override FastAPI's get_db dependency for every test in this package."""
    from service.main import app
    from shared.database import get_db

    async def _fake_get_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = _fake_get_db
    yield
    app.dependency_overrides.pop(get_db, None)

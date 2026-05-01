"""
Path shim so host-side pytest can import `service.*` the same way Docker does.
Mirrors the pattern used by chat-service/tests/conftest.py and game-service/tests/conftest.py.

Also provides a `get_db` dependency override that returns a mock AsyncSession
so tests can run without a real PostgreSQL connection.
"""
import sys
import types
import pytest

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock
from contextlib import asynccontextmanager
from service.main import app, get_current_user
from shared.database import get_db

_service_dir = Path(__file__).resolve().parents[1]   # .../user-service
_backend_dir = _service_dir.parent                    # .../src/backend

sys.path.insert(0, str(_backend_dir))
sys.path.insert(0, str(_service_dir))

if "service" not in sys.modules:
    _mod = types.ModuleType("service")
    _mod.__path__ = [str(_service_dir)]
    _mod.__package__ = "service"
    sys.modules["service"] = _mod


def _make_empty_session():
    """Return a mock AsyncSession whose execute() yields an empty result (scalars → None)."""

    scalars_mock = MagicMock()
    scalars_mock.first.return_value = None
    scalars_mock.all.return_value = []

    mappings_mock = MagicMock()
    mappings_mock.first.return_value = None
    mappings_mock.one.return_value = None
    mappings_mock.all.return_value = []

    result_mock = MagicMock()
    result_mock.scalars.return_value = scalars_mock
    result_mock.mappings.return_value = mappings_mock

    session = AsyncMock()
    session.execute.return_value = result_mock
    
    # Mock begin_nested() to support async context manager (required by create_notification)
    @asynccontextmanager
    async def _begin_nested():
        yield
    
    session.begin_nested = MagicMock(return_value=_begin_nested())
    return session


@pytest.fixture
def mock_db_session():
    return _make_empty_session()


@pytest.fixture(autouse=True)
def override_get_db(mock_db_session):
    """Override FastAPI's get_db and get_current_user dependencies for every test."""

    async def _fake_get_db():
        yield mock_db_session

    default_user = MagicMock()
    default_user.id = 9999  # matches the user_id used in most test paths

    app.dependency_overrides[get_db] = _fake_get_db
    app.dependency_overrides[get_current_user] = lambda: default_user
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)

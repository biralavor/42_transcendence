"""
Path shim so host-side pytest can import `service.*` the same way Docker does.
Mirrors the pattern used by chat-service/tests/conftest.py and game-service/tests/conftest.py.

Also provides a `get_db` dependency override that returns a mock AsyncSession
so tests can run without a real PostgreSQL connection.
"""
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

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

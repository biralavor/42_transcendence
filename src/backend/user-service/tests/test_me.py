# src/backend/user-service/tests/test_me.py
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.exc import IntegrityError

from service.main import app
from service.schemas import MeResponse
from service.service import create_access_token


def _make_credential(username: str = "alice"):
    cred = MagicMock()
    cred.id = 1
    cred.username = username
    return cred


def _make_user(credential_id: int = 1, user_id: int = 42, is_admin: bool = False):
    user = MagicMock()
    user.id = user_id
    user.credential_id = credential_id
    user.username = "alice"
    user.display_name = None
    user.status = "offline"
    user.avatar_url = None
    user.created_at = None
    user.bio = None
    user.is_admin = is_admin
    return user


def _session_returning(*call_results):
    session = AsyncMock()
    sides = []
    for obj in call_results:
        scalars_mock = MagicMock()
        scalars_mock.first.return_value = obj
        result_mock = MagicMock()
        result_mock.scalars.return_value = scalars_mock
        result_mock.scalar_one_or_none.return_value = obj
        sides.append(result_mock)
    session.execute.side_effect = sides
    return session


def _valid_token(username: str = "alice") -> str:
    return create_access_token({"sub": username, "credential_id": 1 }, expires_delta=timedelta(minutes=30))


@pytest.mark.asyncio
async def test_get_me_returns_existing_user():
    """Valid token + existing User row → 200 with user data."""
    cred = _make_credential()
    user = _make_user()

    session = _session_returning(user, "alice@example.com")
    session.refresh = AsyncMock()

    from shared.database import get_db

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {_valid_token()}"})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200, resp.text
    assert resp.json()["username"] == "alice"
    assert resp.json()["is_admin"] is False


@pytest.mark.asyncio
async def test_get_me_exposes_is_admin_true():
    """MeResponse must surface is_admin=true for admin users."""
    user = _make_user(is_admin=True)
    session = _session_returning(user, "admin@example.com")
    session.refresh = AsyncMock()

    from shared.database import get_db

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {_valid_token()}"})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200, resp.text
    assert resp.json()["is_admin"] is True


@pytest.mark.asyncio
async def test_get_me_creates_user_on_first_call():
    """Valid token but no User row yet → User is created and returned."""
    cred = _make_credential()

    session = _session_returning(None, "alice@example.com")

    added_objects = []
    session.add = MagicMock(side_effect=added_objects.append)

    new_user = _make_user()

    def _apply_db_defaults(obj):
        obj.id = new_user.id
        obj.status = "offline"
        obj.is_admin = False

    async def mock_merge(user_obj):
        user_obj.credential_id = user_obj.credential_id if user_obj.credential_id is not None else 1
        _apply_db_defaults(user_obj)
        added_objects.append(user_obj)
        return user_obj

    session.merge = AsyncMock(side_effect=mock_merge)
    session.refresh = AsyncMock(side_effect=lambda obj: _apply_db_defaults(obj))
    session.commit = AsyncMock()

    from shared.database import get_db

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {_valid_token()}"})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200, resp.text

    from service.models.user import User
    created = [o for o in added_objects if isinstance(o, User)]
    assert len(created) == 1
    assert created[0].credential_id == cred.id
    assert created[0].username == cred.username


@pytest.mark.asyncio
async def test_get_me_returns_401_for_expired_token():
    from jose import jwt
    from service.service import ALGORITHM
    from shared.config.settings import settings

    expired = jwt.encode({"sub": "alice", "exp": 0}, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)
    session = _session_returning()

    from shared.database import get_db

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Token expired"


# ----------------------------------------------------------------- #
# MeResponse model_validator — pure unit tests                      #
# ----------------------------------------------------------------- #

class TestMeResponseNormalizesDisplayName:
    def test_none_becomes_username(self):
        me = MeResponse(id=1, username='alice', display_name=None, status='offline')
        assert me.display_name == 'alice'

    def test_empty_string_becomes_username(self):
        me = MeResponse(id=1, username='alice', display_name='', status='offline')
        assert me.display_name == 'alice'

    def test_whitespace_becomes_username(self):
        me = MeResponse(id=1, username='alice', display_name='   ', status='offline')
        assert me.display_name == 'alice'

    def test_valid_display_name_preserved(self):
        me = MeResponse(id=1, username='alice', display_name='Alice B', status='offline')
        assert me.display_name == 'Alice B'


# ----------------------------------------------------------------- #
# GET /auth/me endpoint — display_name normalization via HTTP       #
# ----------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_get_me_coalesces_empty_display_name():
    """GET /auth/me must return username when display_name is '' in DB."""
    user = _make_user()
    user.display_name = ''

    session = _session_returning(user, "alice@example.com")
    session.refresh = AsyncMock()

    from shared.database import get_db

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {_valid_token()}"})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200
    assert resp.json()['display_name'] == 'alice'


@pytest.mark.asyncio
async def test_get_me_coalesces_whitespace_display_name():
    """GET /auth/me must return username when display_name is whitespace-only."""
    user = _make_user()
    user.display_name = '   '

    session = _session_returning(user, "alice@example.com")
    session.refresh = AsyncMock()

    from shared.database import get_db

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {_valid_token()}"})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200
    assert resp.json()['display_name'] == 'alice'


@pytest.mark.asyncio
async def test_get_me_preserves_valid_display_name():
    """GET /auth/me must return display_name unchanged when it is set."""
    user = _make_user()
    user.display_name = 'Alice B'

    session = _session_returning(user, "alice@example.com")
    session.refresh = AsyncMock()

    from shared.database import get_db

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {_valid_token()}"})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200
    assert resp.json()['display_name'] == 'Alice B'

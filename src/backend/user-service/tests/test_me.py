# src/backend/user-service/tests/test_me.py
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from service.main import app
from service.service import create_access_token


def _make_credential(username: str = "alice"):
    cred = MagicMock()
    cred.id = 1
    cred.username = username
    return cred


def _make_user(credential_id: int = 1, user_id: int = 42):
    user = MagicMock()
    user.id = user_id
    user.credential_id = credential_id
    user.username = "alice"
    user.display_name = None
    user.status = "offline"
    user.avatar_url = None
    user.created_at = None
    user.bio = None
    user.dark_mode = False
    return user


def _session_returning(*call_results):
    session = AsyncMock()
    sides = []
    for obj in call_results:
        scalars_mock = MagicMock()
        scalars_mock.first.return_value = obj
        result_mock = MagicMock()
        result_mock.scalars.return_value = scalars_mock
        sides.append(result_mock)
    session.execute.side_effect = sides
    return session


def _valid_token(username: str = "alice") -> str:
    return create_access_token({"sub": username}, expires_delta=timedelta(minutes=30))


@pytest.mark.asyncio
async def test_get_me_returns_existing_user():
    """Valid token + existing User row → 200 with user data."""
    cred = _make_credential()
    user = _make_user()
    # execute calls: 1=credentials, 2=user by credential_id (hit)
    session = _session_returning(cred, user)
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


@pytest.mark.asyncio
async def test_get_me_creates_user_on_first_call():
    """Valid token but no User row yet → User is created and returned."""
    cred = _make_credential()
    # execute calls: 1=credentials, 2=user by credential_id (miss → create)
    session = _session_returning(cred, None)

    added_objects = []
    session.add = MagicMock(side_effect=added_objects.append)

    new_user = _make_user()

    def _apply_db_defaults(obj):
        obj.id = new_user.id
        obj.status = "offline"
        obj.dark_mode = False

    session.refresh = AsyncMock(side_effect=lambda obj: _apply_db_defaults(obj))

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

# src/backend/user-service/tests/test_authenticate.py
from unittest.mock import AsyncMock, MagicMock

import bcrypt
import pytest
from httpx import ASGITransport, AsyncClient

from service.main import app


def _hashed(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _make_credential(username: str = "alice", password: str = "secret123"):
    cred = MagicMock()
    cred.id = 1
    cred.username = username
    cred.password = _hashed(password)
    return cred


def _make_token_row(credential_id: int = 1):
    token = MagicMock()
    token.credential_id = credential_id
    token.refresh_token_hash = "oldhash"
    return token


def _session_returning(*call_results):
    """Build a mock AsyncSession whose execute() returns call_results in order."""
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


@pytest.mark.asyncio
async def test_login_returns_tokens_without_user_id():
    """authenticate() only deals with credentials + tokens — no user_id in response."""
    cred = _make_credential()
    user = MagicMock()
    user.id = 1
    # execute calls: 1=credentials, 2=user (for uid), 3=tokens (None → new)
    session = _session_returning(cred, user, None)

    from shared.database import get_db

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/auth/login", json={"username": "alice", "password": "secret123"})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert "user_id" not in data


@pytest.mark.asyncio
async def test_subsequent_login_updates_token_not_duplicates():
    """Second login: existing Tokens row is updated in-place, no new row added."""
    cred = _make_credential()
    existing_token = _make_token_row(credential_id=cred.id)
    user = MagicMock()
    user.id = 1
    # execute calls: 1=credentials, 2=user (for uid), 3=tokens (found)
    session = _session_returning(cred, user, existing_token)

    added_objects = []
    session.add = MagicMock(side_effect=added_objects.append)

    from shared.database import get_db

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db

    old_hash = existing_token.refresh_token_hash

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/auth/login", json={"username": "alice", "password": "secret123"})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200, resp.text

    # No new Tokens row should have been added
    from service.models.credentials import Tokens
    added_tokens = [o for o in added_objects if isinstance(o, Tokens)]
    assert len(added_tokens) == 0

    # The existing token's hash must have been rotated
    assert existing_token.refresh_token_hash != old_hash


@pytest.mark.asyncio
async def test_login_token_contains_uid():
    """JWT issued on login must carry a numeric uid matching the user's DB id."""
    import bcrypt
    from unittest.mock import AsyncMock, MagicMock
    from service.main import app
    from shared.database import get_db
    from jose import jwt
    from shared.config.settings import settings

    cred = MagicMock()
    cred.id = 7
    cred.username = "alice"
    cred.password = bcrypt.hashpw(b"pass", bcrypt.gensalt()).decode()

    user = MagicMock()
    user.id = 42

    token_row = MagicMock()
    token_row.credential_id = 7
    token_row.refresh_token_hash = "old"

    def _result(obj):
        scalars = MagicMock()
        scalars.first.return_value = obj
        r = MagicMock()
        r.scalars.return_value = scalars
        return r

    session = AsyncMock()
    session.execute.side_effect = [
        _result(cred),       # find credential
        _result(user),       # find user for uid
        _result(token_row),  # find token row
    ]

    async def fake_db():
        yield session

    app.dependency_overrides[get_db] = fake_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/auth/login", json={"username": "alice", "password": "pass"})
        assert resp.status_code == 200
        token = resp.json()["access_token"]
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        assert payload["uid"] == 42
    finally:
        app.dependency_overrides.pop(get_db, None)

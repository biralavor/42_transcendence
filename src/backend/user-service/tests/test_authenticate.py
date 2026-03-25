# src/backend/user-service/tests/test_authenticate.py
from unittest.mock import AsyncMock, MagicMock, patch

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


def _make_user(credential_id: int = 1, user_id: int = 42):
    user = MagicMock()
    user.id = user_id
    user.credential_id = credential_id
    user.username = "alice"
    user.password_hash = None
    return user


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
async def test_first_login_creates_user_linked_to_credential():
    """First login: no existing User row → one is created with credential_id set."""
    cred = _make_credential()
    # execute calls: 1=credentials, 2=tokens (None → new), 3=user (None → new)
    session = _session_returning(cred, None, None)

    new_user = _make_user()
    session.refresh = AsyncMock(side_effect=lambda obj: setattr(obj, "id", new_user.id) or None)

    added_objects = []
    session.add = MagicMock(side_effect=added_objects.append)

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

    # A User object must have been added to the session
    from service.models.user import User
    created_users = [o for o in added_objects if isinstance(o, User)]
    assert len(created_users) == 1
    assert created_users[0].credential_id == cred.id
    assert created_users[0].username == cred.username
    # password_hash must NOT be copied from credentials
    assert created_users[0].password_hash is None


@pytest.mark.asyncio
async def test_subsequent_login_updates_token_not_duplicates():
    """Second login: existing Tokens row is updated in-place, no new row added."""
    cred = _make_credential()
    existing_token = _make_token_row(credential_id=cred.id)
    existing_user = _make_user(credential_id=cred.id)
    # execute calls: 1=credentials, 2=tokens (found), 3=user (found)
    session = _session_returning(cred, existing_token, existing_user)
    session.refresh = AsyncMock()

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

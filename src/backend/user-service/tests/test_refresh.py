# src/backend/user-service/tests/test_refresh.py
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from service.main import app

SAMPLE_REFRESH_TOKEN = "a" * 64  # 64 hex chars, valid token_hex(32) length


def _make_credential(username: str = "alice"):
    cred = MagicMock()
    cred.id = 1
    cred.username = username
    return cred


def _make_token_row(expired: bool = False):
    token = MagicMock()
    token.credential_id = 1
    if expired:
        token.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    else:
        token.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
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
async def test_refresh_success_returns_new_tokens():
    """Valid refresh token returns a new access_token and refresh_token."""
    token_row = _make_token_row()
    cred = _make_credential()
    session = _session_returning(token_row, cred)

    from shared.database import get_db

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/auth/refresh", json={"refresh_token": SAMPLE_REFRESH_TOKEN})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_refresh_rotates_token_hash():
    """Successful refresh updates the stored hash (token rotation)."""
    token_row = _make_token_row()
    cred = _make_credential()
    session = _session_returning(token_row, cred)

    from shared.database import get_db

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db

    old_hash = token_row.refresh_token_hash

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/auth/refresh", json={"refresh_token": SAMPLE_REFRESH_TOKEN})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200
    assert token_row.refresh_token_hash != old_hash


@pytest.mark.asyncio
async def test_refresh_invalid_token_returns_401():
    """Token hash not found in DB returns 401."""
    session = _session_returning(None)

    from shared.database import get_db

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/auth/refresh", json={"refresh_token": SAMPLE_REFRESH_TOKEN})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_expired_token_returns_401():
    """Token found but expires_at is in the past returns 401."""
    expired_token = _make_token_row(expired=True)
    session = _session_returning(expired_token)

    from shared.database import get_db

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/auth/refresh", json={"refresh_token": SAMPLE_REFRESH_TOKEN})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_missing_credential_returns_401():
    """Token row is valid but the linked credential no longer exists returns 401."""
    token_row = _make_token_row()
    session = _session_returning(token_row, None)

    from shared.database import get_db

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/auth/refresh", json={"refresh_token": SAMPLE_REFRESH_TOKEN})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 401

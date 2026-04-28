# src/backend/user-service/tests/test_admin_activity.py
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from service.main import app, get_current_user


def _scalar_result(value):
    """Build a MagicMock that mimics a SQLAlchemy Result with .scalar_one()."""
    result = MagicMock()
    result.scalar_one.return_value = value
    return result


def _make_admin(user_id: int = 7):
    user = MagicMock()
    user.id = user_id
    user.is_admin = True
    return user


def _make_non_admin(user_id: int = 8):
    user = MagicMock()
    user.id = user_id
    user.is_admin = False
    return user


@pytest.mark.asyncio
async def test_admin_activity_requires_token():
    """No Authorization header → 401."""
    # Drop the autouse override so the real bearer scheme runs.
    app.dependency_overrides.pop(get_current_user, None)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/admin/activity")
    finally:
        # Restore for subsequent tests (autouse fixture re-applies on next test).
        pass
    assert resp.status_code in (401, 403)  # FastAPI HTTPBearer returns 403 by default


@pytest.mark.asyncio
async def test_admin_activity_forbidden_for_non_admin():
    """Authenticated non-admin → 403."""
    app.dependency_overrides[get_current_user] = lambda: _make_non_admin()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/admin/activity")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 403
    assert resp.json()["detail"] == "Admin only"


@pytest.mark.asyncio
async def test_admin_activity_returns_aggregate_counts(mock_db_session):
    """Admin user → 200 with the three integer counts from the three queries."""
    # Three sequential execute calls inside the endpoint.
    mock_db_session.execute = AsyncMock(side_effect=[
        _scalar_result(12),  # active_users_last_7d
        _scalar_result(5),   # games_today
        _scalar_result(34),  # messages_today
    ])
    app.dependency_overrides[get_current_user] = lambda: _make_admin()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/admin/activity")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data == {
        "active_users_last_7d": 12,
        "games_today": 5,
        "messages_today": 34,
    }

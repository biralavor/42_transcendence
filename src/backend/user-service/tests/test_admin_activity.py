# src/backend/user-service/tests/test_admin_activity.py
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from service.main import app, get_current_user


def _scalar_result(value):
    """Build a MagicMock that mimics a SQLAlchemy Result with .scalar_one()."""
    result = MagicMock()
    result.scalar_one.return_value = value
    return result


def _row(**fields):
    """Build a MagicMock with attribute access matching a SQLAlchemy Row."""
    row = MagicMock()
    for k, v in fields.items():
        setattr(row, k, v)
    return row


def _all_result(rows):
    """Build a MagicMock that mimics a SQLAlchemy Result with .all() returning rows."""
    result = MagicMock()
    result.all.return_value = rows
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
    app.dependency_overrides.pop(get_current_user, None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/admin/activity")
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
async def test_admin_activity_default_range_is_30_days(mock_db_session):
    """No query params → response covers exactly 30 days ending today."""
    today = datetime.now(timezone.utc).date()
    expected_start = today - timedelta(days=29)

    mock_db_session.execute = AsyncMock(side_effect=[
        _scalar_result(0),
        _all_result([]),
        _all_result([]),
    ])
    app.dependency_overrides[get_current_user] = lambda: _make_admin()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/admin/activity")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["range_start"] == expected_start.isoformat()
    assert data["range_end"] == today.isoformat()
    assert len(data["games_per_day"]) == 30
    assert len(data["messages_per_day"]) == 30


@pytest.mark.asyncio
async def test_admin_activity_returns_aggregate_counts(mock_db_session):
    """Admin user → 200 with active_users, totals, and per-day buckets."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=2)  # 3-day window

    mock_db_session.execute = AsyncMock(side_effect=[
        _scalar_result(12),  # active_users
        _all_result([
            _row(d=start, c=2),
            _row(d=today, c=3),
        ]),
        _all_result([
            _row(d=today, c=7),
        ]),
    ])
    app.dependency_overrides[get_current_user] = lambda: _make_admin()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                f"/admin/activity?start={start.isoformat()}&end={today.isoformat()}"
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["active_users"] == 12
    assert data["games_total"] == 5
    assert data["messages_total"] == 7
    assert len(data["games_per_day"]) == 3
    assert len(data["messages_per_day"]) == 3
    games_by_date = {p["date"]: p["count"] for p in data["games_per_day"]}
    assert games_by_date[start.isoformat()] == 2
    assert games_by_date[today.isoformat()] == 3
    # Middle day not in mock rows → filled with zero
    middle = (start + timedelta(days=1)).isoformat()
    assert games_by_date[middle] == 0


@pytest.mark.asyncio
async def test_admin_activity_rejects_inverted_range():
    """start > end → 400."""
    today = datetime.now(timezone.utc).date()
    app.dependency_overrides[get_current_user] = lambda: _make_admin()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                f"/admin/activity?start={today.isoformat()}"
                f"&end={(today - timedelta(days=1)).isoformat()}"
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_admin_activity_rejects_window_over_30_days():
    """start older than today-29 → 400."""
    today = datetime.now(timezone.utc).date()
    too_old = today - timedelta(days=30)
    app.dependency_overrides[get_current_user] = lambda: _make_admin()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                f"/admin/activity?start={too_old.isoformat()}&end={today.isoformat()}"
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_admin_activity_rejects_future_end():
    """end in the future → 400."""
    today = datetime.now(timezone.utc).date()
    future = today + timedelta(days=1)
    app.dependency_overrides[get_current_user] = lambda: _make_admin()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                f"/admin/activity?start={today.isoformat()}&end={future.isoformat()}"
            )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 400

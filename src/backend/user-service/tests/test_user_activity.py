# src/backend/user-service/tests/test_user_activity.py
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from service.main import app, get_current_user, _compute_login_streak


def _row(**fields):
    """Build a MagicMock that supports attribute access matching SQLAlchemy Row."""
    row = MagicMock()
    for k, v in fields.items():
        setattr(row, k, v)
    return row


def _result_with_rows(rows):
    """Build a MagicMock that mimics a SQLAlchemy Result with .all() returning rows."""
    result = MagicMock()
    result.all.return_value = rows
    return result


def _make_user(user_id: int = 7, last_login: datetime | None = None):
    user = MagicMock()
    user.id = user_id
    user.is_admin = False
    user.last_login_at = last_login
    return user


# ── _compute_login_streak unit tests ──────────────────────────────────────────


def test_streak_empty_returns_zero():
    assert _compute_login_streak([], date(2026, 4, 27)) == 0


def test_streak_single_day_today():
    today = date(2026, 4, 27)
    assert _compute_login_streak([today], today) == 1


def test_streak_single_day_yesterday_still_counts():
    today = date(2026, 4, 27)
    yesterday = today - timedelta(days=1)
    assert _compute_login_streak([yesterday], today) == 1


def test_streak_single_day_too_old_is_zero():
    today = date(2026, 4, 27)
    assert _compute_login_streak([today - timedelta(days=2)], today) == 0


def test_streak_three_consecutive_days_ending_today():
    today = date(2026, 4, 27)
    dates = [today, today - timedelta(days=1), today - timedelta(days=2)]
    assert _compute_login_streak(dates, today) == 3


def test_streak_breaks_at_gap():
    today = date(2026, 4, 27)
    # today, yesterday, then a gap (skip 2 days), then 3 more
    dates = [
        today,
        today - timedelta(days=1),
        today - timedelta(days=4),
        today - timedelta(days=5),
        today - timedelta(days=6),
    ]
    assert _compute_login_streak(dates, today) == 2


def test_streak_unsorted_input_is_handled():
    today = date(2026, 4, 27)
    dates = [
        today - timedelta(days=2),
        today,
        today - timedelta(days=1),
    ]
    assert _compute_login_streak(dates, today) == 3


def test_streak_dedupes_same_day_entries():
    today = date(2026, 4, 27)
    # Same date present multiple times — should not inflate the streak.
    dates = [today, today, today]
    assert _compute_login_streak(dates, today) == 1


# ── /activity endpoint tests ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_user_activity_requires_token():
    app.dependency_overrides.pop(get_current_user, None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/activity")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_user_activity_returns_30_day_buckets_and_streak(mock_db_session):
    """Happy path: returns last_login_at, streak, and 30-element daily-count arrays."""
    today = datetime.now(timezone.utc).date()
    last_login = datetime.now(timezone.utc) - timedelta(hours=2)

    games_rows = [_row(d=today, c=2), _row(d=today - timedelta(days=3), c=1)]
    messages_rows = [_row(d=today - timedelta(days=1), c=5)]
    login_rows = [
        _row(login_date=today),
        _row(login_date=today - timedelta(days=1)),
        _row(login_date=today - timedelta(days=2)),
    ]

    mock_db_session.execute = AsyncMock(side_effect=[
        _result_with_rows(games_rows),
        _result_with_rows(messages_rows),
        _result_with_rows(login_rows),
    ])
    app.dependency_overrides[get_current_user] = lambda: _make_user(last_login=last_login)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/activity")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["active_streak_days"] == 3
    assert len(data["games_per_day"]) == 30
    assert len(data["messages_per_day"]) == 30
    # Counts at the right buckets.
    games_by_date = {d["date"]: d["count"] for d in data["games_per_day"]}
    assert games_by_date[today.isoformat()] == 2
    assert games_by_date[(today - timedelta(days=3)).isoformat()] == 1
    # Other days zero.
    assert games_by_date[(today - timedelta(days=10)).isoformat()] == 0
    messages_by_date = {d["date"]: d["count"] for d in data["messages_per_day"]}
    assert messages_by_date[(today - timedelta(days=1)).isoformat()] == 5
    assert messages_by_date[today.isoformat()] == 0


@pytest.mark.asyncio
async def test_user_activity_zero_when_no_history(mock_db_session):
    """No matches/messages/logins → all zeros, empty streak, all 30 buckets present."""
    mock_db_session.execute = AsyncMock(side_effect=[
        _result_with_rows([]),
        _result_with_rows([]),
        _result_with_rows([]),
    ])
    app.dependency_overrides[get_current_user] = lambda: _make_user(last_login=None)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/activity")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["active_streak_days"] == 0
    assert data["last_login_at"] is None
    assert all(item["count"] == 0 for item in data["games_per_day"])
    assert all(item["count"] == 0 for item in data["messages_per_day"])

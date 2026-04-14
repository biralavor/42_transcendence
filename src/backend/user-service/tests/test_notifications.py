from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import AsyncClient, ASGITransport

from service.main import app


# ---------------------------------------------------------------------------
# GET /notifications
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_notifications_returns_empty_list():
    """Authenticated caller with no notifications gets []."""
    with patch("service.notifications.get_notifications", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = []
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/notifications",
                headers={"Authorization": "Bearer fake-token"},
            )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_notifications_returns_items():
    """Authenticated caller gets list of notifications."""
    from datetime import datetime, timezone
    fake_notif = MagicMock()
    fake_notif.id = 1
    fake_notif.user_id = 9999
    fake_notif.type = "friend_request"
    fake_notif.message = "Alice wants to be your friend"
    fake_notif.read = False
    fake_notif.created_at = datetime(2026, 4, 6, 12, 0, 0, tzinfo=timezone.utc)

    with patch("service.notifications.get_notifications", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = [fake_notif]
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/notifications",
                headers={"Authorization": "Bearer fake-token"},
            )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["type"] == "friend_request"
    assert data[0]["read"] is False


# ---------------------------------------------------------------------------
# PUT /notifications/read-all
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_read_all_returns_204():
    """mark_all_notifications_read is called and returns 204."""
    with patch("service.notifications.mark_all_notifications_read", new_callable=AsyncMock) as mock_all:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.put(
                "/notifications/read-all",
                headers={"Authorization": "Bearer fake-token"},
            )
    assert resp.status_code == 204
    mock_all.assert_awaited_once()


# ---------------------------------------------------------------------------
# PUT /notifications/{id}/read
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mark_read_returns_updated_notification():
    """mark_notification_read returns the updated notification."""
    from datetime import datetime, timezone
    fake_notif = MagicMock()
    fake_notif.id = 7
    fake_notif.user_id = 9999
    fake_notif.type = "game_invite"
    fake_notif.message = "Bob challenged you"
    fake_notif.read = True
    fake_notif.created_at = datetime(2026, 4, 6, 12, 0, 0, tzinfo=timezone.utc)

    with patch("service.notifications.mark_notification_read", new_callable=AsyncMock) as mock_read:
        mock_read.return_value = fake_notif
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.put(
                "/notifications/7/read",
                headers={"Authorization": "Bearer fake-token"},
            )
    assert resp.status_code == 200
    assert resp.json()["read"] is True
    assert resp.json()["id"] == 7


@pytest.mark.asyncio
async def test_mark_read_not_owned_returns_404():
    """mark_notification_read raises 404 if not owned."""
    from fastapi import HTTPException
    with patch("service.notifications.mark_notification_read", new_callable=AsyncMock) as mock_read:
        mock_read.side_effect = HTTPException(status_code=404, detail="Notification not found")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.put(
                "/notifications/999/read",
                headers={"Authorization": "Bearer fake-token"},
            )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /notifications/{id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_notification_returns_204():
    """delete_notification is called and returns 204."""
    with patch("service.notifications.delete_notification", new_callable=AsyncMock) as mock_del:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete(
                "/notifications/5",
                headers={"Authorization": "Bearer fake-token"},
            )
    assert resp.status_code == 204
    mock_del.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_notification_not_owned_returns_404():
    """delete_notification raises 404 if not owned."""
    from fastapi import HTTPException
    with patch("service.notifications.delete_notification", new_callable=AsyncMock) as mock_del:
        mock_del.side_effect = HTTPException(status_code=404, detail="Notification not found")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete(
                "/notifications/999",
                headers={"Authorization": "Bearer fake-token"},
            )
    assert resp.status_code == 404


# --- create_notification ---

@pytest.mark.asyncio
async def test_create_notification_adds_row_and_returns_it(mock_db_session):
    """create_notification persists a row and returns the populated object."""
    from unittest.mock import AsyncMock
    from service.notifications import create_notification

    async def fake_refresh(obj):
        obj.id = 42

    # Mock the context manager for begin_nested (savepoint)
    mock_begin_nested = AsyncMock()
    mock_begin_nested.__aenter__ = AsyncMock(return_value=None)
    mock_begin_nested.__aexit__ = AsyncMock(return_value=None)
    mock_db_session.begin_nested.return_value = mock_begin_nested
    
    mock_db_session.refresh = AsyncMock(side_effect=fake_refresh)

    result = await create_notification(
        mock_db_session, user_id=7, notif_type="friend_request", message="alice sent you a friend request"
    )

    mock_db_session.add.assert_called_once()
    mock_db_session.flush.assert_awaited_once()
    mock_db_session.refresh.assert_awaited_once()
    assert result.user_id == 7
    assert result.type == "friend_request"
    assert result.message == "alice sent you a friend request"
    assert result.read is False
    assert result.id == 42

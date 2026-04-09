# src/backend/user-service/tests/test_ws_push.py
"""
Integration tests: verify notification_manager.broadcast is called with the
correct payload at each trigger point.
DB and auth are mocked via conftest.py (autouse).
Business-logic functions (send_friend_request, respond_to_friend_request) are
patched so tests don't depend on session behaviour.
"""
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

from service.main import app, get_current_user


def _fake_friendship(requester_id=1, addressee_id=2, status="pending"):
    return SimpleNamespace(
        id=10,
        requester_id=requester_id,
        addressee_id=addressee_id,
        status=status,
        created_at=datetime.now(timezone.utc),
        requester_username=None,
        addressee_username=None,
    )


def _fake_notif(notif_type="friend_request", user_id=2):
    n = MagicMock()
    n.id = 55
    n.type = notif_type
    n.message = "test message"
    n.read = False
    n.user_id = user_id
    n.created_at = datetime(2026, 4, 9, 12, 0, 0, tzinfo=timezone.utc)
    return n


# ── friend request sent ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_send_friend_request_broadcasts_notification():
    """POST /friends/9999/request/2 → broadcast to room '2' with notification envelope."""
    fake_fs = _fake_friendship(requester_id=9999, addressee_id=2)
    fake_notif = _fake_notif("friend_request", user_id=2)

    requester = MagicMock()
    requester.id = 9999
    requester.username = "alice"

    with patch("service.friends.send_friend_request", new=AsyncMock(return_value=fake_fs)), \
         patch("service.main._notifications.create_notification", new=AsyncMock(return_value=fake_notif)), \
         patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        saved = app.dependency_overrides.get(get_current_user)
        app.dependency_overrides[get_current_user] = lambda: requester
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post(
                    "/friends/9999/request/2",
                    headers={"Authorization": "Bearer fake-token"},
                )
        finally:
            if saved is not None:
                app.dependency_overrides[get_current_user] = saved
            else:
                app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 201
    mock_mgr.broadcast.assert_awaited_once()
    room, payload = mock_mgr.broadcast.call_args[0]
    assert room == "2"
    assert payload["type"] == "notification"
    assert payload["notification"]["type"] == "friend_request"
    assert payload["notification"]["id"] == 55
    assert payload["notification"]["read"] is False
    assert payload["notification"]["created_at"] == "2026-04-09T12:00:00+00:00"


@pytest.mark.asyncio
async def test_send_friend_request_creates_notification_for_addressee():
    """create_notification is called with addressee_id, correct type, and username in message."""
    fake_fs = _fake_friendship(requester_id=9999, addressee_id=2)
    mock_create = AsyncMock(return_value=_fake_notif())

    requester = MagicMock()
    requester.id = 9999
    requester.username = "alice"

    with patch("service.friends.send_friend_request", new=AsyncMock(return_value=fake_fs)), \
         patch("service.main._notifications.create_notification", new=mock_create), \
         patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        saved = app.dependency_overrides.get(get_current_user)
        app.dependency_overrides[get_current_user] = lambda: requester
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                await client.post(
                    "/friends/9999/request/2",
                    headers={"Authorization": "Bearer fake-token"},
                )
        finally:
            if saved is not None:
                app.dependency_overrides[get_current_user] = saved
            else:
                app.dependency_overrides.pop(get_current_user, None)

    args = mock_create.call_args[0]   # positional: (session, user_id, notif_type, message)
    assert args[1] == 2                # user_id = addressee_id
    assert args[2] == "friend_request"
    assert "alice" in args[3]          # requester username in message


# ── friend request accepted ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_accept_friend_request_broadcasts_notification():
    """PUT /friends/9999/requests/10 accept → broadcast to room '3' (requester's id)."""
    fake_fs = _fake_friendship(requester_id=3, addressee_id=9999, status="accepted")
    fake_notif = _fake_notif("friend_request_accepted", user_id=3)

    acceptor = MagicMock()
    acceptor.id = 9999
    acceptor.username = "alice"

    with patch("service.friends.respond_to_friend_request", new=AsyncMock(return_value=fake_fs)), \
         patch("service.main._notifications.create_notification", new=AsyncMock(return_value=fake_notif)), \
         patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        saved = app.dependency_overrides.get(get_current_user)
        app.dependency_overrides[get_current_user] = lambda: acceptor
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.put(
                    "/friends/9999/requests/10",
                    json={"action": "accept"},
                    headers={"Authorization": "Bearer fake-token"},
                )
        finally:
            if saved is not None:
                app.dependency_overrides[get_current_user] = saved
            else:
                app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200
    mock_mgr.broadcast.assert_awaited_once()
    room, payload = mock_mgr.broadcast.call_args[0]
    assert room == "3"   # friendship.requester_id
    assert payload["type"] == "notification"
    assert payload["notification"]["type"] == "friend_request_accepted"


@pytest.mark.asyncio
async def test_decline_friend_request_does_not_broadcast():
    """PUT /friends/9999/requests/10 decline → no broadcast (204, not a notification)."""
    with patch("service.friends.respond_to_friend_request", new=AsyncMock(return_value=None)), \
         patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.put(
                "/friends/9999/requests/10",
                json={"action": "decline"},
                headers={"Authorization": "Bearer fake-token"},
            )

    assert resp.status_code == 204
    mock_mgr.broadcast.assert_not_awaited()


# ── game invite persistence ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_game_invite_persists_notification_row():
    """POST /game-invites type=game_invite → persists with correct type, broadcasts twice."""
    mock_create = AsyncMock(return_value=_fake_notif("game_invite", user_id=7))

    with patch("service.main._notifications.create_notification", new=mock_create), \
         patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/game-invites",
                json={
                    "type": "game_invite",
                    "to_user_id": 7,
                    "room_id": "invite-9999-7-000",
                    "to_username": "bob",
                    "expires_at": 9999999999,
                },
                headers={"Authorization": "Bearer fake-token"},
            )

    assert resp.status_code == 204
    mock_create.assert_awaited_once()
    args = mock_create.call_args[0]
    assert args[1] == 7                   # user_id = to_user_id
    assert args[2] == "game_invite"       # type taken from body.type, not hardcoded
    assert "invited" in args[3]           # correct message for game_invite
    # Two broadcasts: raw payload (for invite UI) + notification envelope (for bell)
    assert mock_mgr.broadcast.await_count == 2
    envelope_call = mock_mgr.broadcast.call_args_list[1]
    assert envelope_call[0][1]["type"] == "notification"


@pytest.mark.asyncio
async def test_game_invite_response_persists_with_correct_type():
    """POST /game-invites type=game_invite_response → persists with type='game_invite_response'."""
    mock_create = AsyncMock(return_value=_fake_notif("game_invite_response", user_id=3))

    with patch("service.main._notifications.create_notification", new=mock_create), \
         patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/game-invites",
                json={
                    "type": "game_invite_response",
                    "to_user_id": 3,
                    "room_id": "invite-9999-3-000",
                    "status": "accepted",
                },
                headers={"Authorization": "Bearer fake-token"},
            )

    assert resp.status_code == 204
    args = mock_create.call_args[0]
    assert args[2] == "game_invite_response"
    assert "accepted" in args[3]

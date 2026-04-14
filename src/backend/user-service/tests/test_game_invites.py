# src/backend/user-service/tests/test_game_invites.py
"""
Tests for POST /game-invites — server-side notification delivery endpoint.
DB and auth mocked via conftest.py (autouse).
notification_manager.broadcast is patched to avoid real WS connections.
"""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

from service.main import app
from service.main import get_current_user


@pytest.mark.asyncio
async def test_game_invite_returns_204():
    """Valid payload returns 204 No Content."""
    with patch("service.main.notification_manager") as mock_mgr:
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


@pytest.mark.asyncio
async def test_game_invite_injects_from_user_id_from_jwt():
    """from_user_id in the broadcast payload comes from the JWT (current_user.id=9999),
    not from the request body — prevents impersonation."""
    with patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post(
                "/game-invites",
                json={
                    "type": "game_invite",
                    "to_user_id": 7,
                    "room_id": "invite-9999-7-000",
                    # attacker tries to spoof a different sender:
                    "from_user_id": 1,
                },
                headers={"Authorization": "Bearer fake-token"},
            )

    # Single broadcast: notification envelope with all necessary data
    assert mock_mgr.broadcast.await_count == 1
    _room, payload = mock_mgr.broadcast.call_args_list[0][0]
    # Server must override any client-supplied from_user_id
    assert payload["from_user_id"] == 9999   # conftest default_user.id


@pytest.mark.asyncio
async def test_game_invite_broadcasts_to_recipient_room():
    """broadcast() is called with room = str(to_user_id)."""
    with patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post(
                "/game-invites",
                json={"type": "game_invite", "to_user_id": 42, "room_id": "r"},
                headers={"Authorization": "Bearer fake-token"},
            )

    # Both broadcasts go to the same room
    room, _payload = mock_mgr.broadcast.call_args_list[0][0]
    assert room == "42"


@pytest.mark.asyncio
async def test_game_invite_response_returns_204():
    """game_invite_response is sent via dedicated /game-invite/response endpoint."""
    with patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/game-invite/response",
                json={
                    "to_user_id": 1,
                    "room_id": "invite-1-9999-000",
                    "status": "accepted",
                },
                headers={"Authorization": "Bearer fake-token"},
            )
    assert resp.status_code == 201  # Response endpoint returns 201, not 204


@pytest.mark.asyncio
async def test_game_invite_timeout_returns_204():
    """game_invite_timeout type is also accepted."""
    with patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/game-invites",
                json={
                    "type": "game_invite_timeout",
                    "to_user_id": 7,
                    "room_id": "invite-9999-7-000",
                },
                headers={"Authorization": "Bearer fake-token"},
            )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_game_invite_invalid_type_returns_422():
    """Unknown event type is rejected by Pydantic validation."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/game-invites",
            json={"type": "hack_attempt", "to_user_id": 7, "room_id": "r"},
            headers={"Authorization": "Bearer fake-token"},
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_game_invite_missing_auth_returns_403():
    """No Authorization header → 403."""

    saved = app.dependency_overrides.pop(get_current_user, None)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/game-invites",
                json={"type": "game_invite", "to_user_id": 7, "room_id": "r"},
            )
        assert resp.status_code == 403
    finally:
        if saved is not None:
            app.dependency_overrides[get_current_user] = saved

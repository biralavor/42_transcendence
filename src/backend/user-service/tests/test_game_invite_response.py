# src/backend/user-service/tests/test_game_invite_response.py
"""
Tests for POST /game-invite/response — game invite response delivery endpoint.
DB and auth mocked via conftest.py (autouse).
notification_manager.broadcast is patched to avoid real WS connections.
"""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

from service.main import app


@pytest.mark.asyncio
async def test_game_invite_response_valid_accepted():
    """Valid game_invite_response with accepted status returns 201."""
    with patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/game-invite/response",
                json={
                    "to_user_id": 7,
                    "status": "accepted",
                    "room_id": "invite-9999-7-000",
                },
                headers={"Authorization": "Bearer fake-token"},
            )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "ok"
    assert "notification_id" in data


@pytest.mark.asyncio
async def test_game_invite_response_valid_declined():
    """Valid game_invite_response with declined status returns 201."""
    with patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/game-invite/response",
                json={
                    "to_user_id": 7,
                    "status": "declined",
                    "room_id": "invite-9999-7-000",
                },
                headers={"Authorization": "Bearer fake-token"},
            )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_game_invite_response_valid_timeout():
    """Valid game_invite_response with timeout status returns 201."""
    with patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/game-invite/response",
                json={
                    "to_user_id": 7,
                    "status": "timeout",
                    "room_id": "invite-9999-7-000",
                },
                headers={"Authorization": "Bearer fake-token"},
            )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_game_invite_response_self_targeting_returns_400():
    """Cannot send response to yourself (to_user_id == current_user.id) → 400 Bad Request."""
    # conftest.py sets default_user.id = 9999
    with patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/game-invite/response",
                json={
                    "to_user_id": 9999,  # Same as current_user.id
                    "status": "accepted",
                    "room_id": "invite-9999-9999-000",
                },
                headers={"Authorization": "Bearer fake-token"},
            )
    assert resp.status_code == 400
    data = resp.json()
    assert "cannot" in data["detail"].lower()
    assert "yourself" in data["detail"].lower()


@pytest.mark.asyncio
async def test_game_invite_response_zero_to_user_id_returns_422():
    """to_user_id=0 is rejected by schema validation → 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/game-invite/response",
            json={
                "to_user_id": 0,
                "status": "accepted",
                "room_id": "invite-9999-0-000",
            },
            headers={"Authorization": "Bearer fake-token"},
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_game_invite_response_negative_to_user_id_returns_422():
    """to_user_id=-5 is rejected by schema validation → 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/game-invite/response",
            json={
                "to_user_id": -5,
                "status": "accepted",
                "room_id": "invite-9999-5-000",
            },
            headers={"Authorization": "Bearer fake-token"},
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_game_invite_response_invalid_status_returns_422():
    """Invalid status value is rejected by schema validation → 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/game-invite/response",
            json={
                "to_user_id": 7,
                "status": "pending",  # Invalid, must be accepted/declined/timeout
                "room_id": "invite-9999-7-000",
            },
            headers={"Authorization": "Bearer fake-token"},
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_game_invite_response_missing_auth_returns_403():
    """No Authorization header → 403."""
    from service.main import get_current_user
    saved = app.dependency_overrides.pop(get_current_user, None)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/game-invite/response",
                json={
                    "to_user_id": 7,
                    "status": "accepted",
                    "room_id": "invite-9999-7-000",
                },
            )
        assert resp.status_code == 403
    finally:
        if saved is not None:
            app.dependency_overrides[get_current_user] = saved


@pytest.mark.asyncio
async def test_game_invite_response_room_id_included_only_for_accepted():
    """room_id is optional but typically included for accepted responses."""
    with patch("service.main.notification_manager") as mock_mgr:
        mock_mgr.broadcast = AsyncMock()
        
        # Test with accepted + room_id
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/game-invite/response",
                json={
                    "to_user_id": 7,
                    "status": "accepted",
                    "room_id": "game-room-123",
                },
                headers={"Authorization": "Bearer fake-token"},
            )
        assert resp.status_code == 201
        
        # Test with declined + no room_id
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/game-invite/response",
                json={
                    "to_user_id": 7,
                    "status": "declined",
                    # room_id omitted
                },
                headers={"Authorization": "Bearer fake-token"},
            )
        assert resp.status_code == 201

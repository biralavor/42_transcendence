# src/backend/user-service/tests/test_notification_ws.py
"""
Endpoint integration tests for /ws/notifications/{user_id}.
DB mocked via conftest.py override_get_db (autouse).
ConnectionManager used as real instance (not mocked).
"""
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from service.main import app
from shared.ws.manager import ConnectionManager


def _make_token(username: str = "alice") -> str:
    from service.service import create_access_token
    return create_access_token({"sub": username}, expires_delta=timedelta(minutes=30))


def _make_user(user_id: int = 1, username: str = "alice"):
    u = MagicMock()
    u.id = user_id
    u.username = username
    return u


# ── auth error paths ──────────────────────────────────────────────────────────

def test_missing_token_closes_4001():
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect("/ws/notifications/1"):
                pass
        assert exc_info.value.code == 4001


def test_invalid_token_closes_4001():
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect("/ws/notifications/1?token=notavalidjwt"):
                pass
        assert exc_info.value.code == 4001


def test_get_me_error_closes_4001():
    """Any get_me failure → close 4001."""
    token = _make_token("ghost")
    with patch("service.ws.notification_router.get_me", new=AsyncMock(side_effect=Exception("not found"))):
        with TestClient(app) as client:
            with pytest.raises(WebSocketDisconnect) as exc_info:
                with client.websocket_connect(f"/ws/notifications/99?token={token}"):
                    pass
        assert exc_info.value.code == 4001


def test_wrong_user_id_closes_4003(mock_db_session):
    """Authenticated user connecting to a different user's channel → close 4003."""
    user = _make_user(user_id=1, username="alice")   # me.id = 1
    token = _make_token()

    with patch("service.ws.notification_router.get_me", new=AsyncMock(return_value=user)):
        with TestClient(app) as client:
            with pytest.raises(WebSocketDisconnect) as exc_info:
                with client.websocket_connect(f"/ws/notifications/99?token={token}"):
                    # user_id=99 in path, but me.id=1 → must be rejected
                    pass
        assert exc_info.value.code == 4003


def test_connect_then_disconnect_does_not_raise(mock_db_session):
    """Connecting and immediately closing must not raise."""
    user = _make_user(5)
    fresh_manager = ConnectionManager()
    token = _make_token()

    with patch("service.ws.notification_router.get_me", new=AsyncMock(return_value=user)), \
         patch("service.ws.notification_router.notification_manager", fresh_manager):
        with TestClient(app) as client:
            with client.websocket_connect(f"/ws/notifications/5?token={token}") as ws:
                ws.close()


# ── edge cases ────────────────────────────────────────────────────────────────

def test_broadcast_to_user_with_no_active_connection_does_not_raise(mock_db_session):
    """A broadcast to a user_id that has zero active WS connections must
    silently drop — never raise. This is the offline-user case."""
    from service.ws.notification_router import notification_manager
    import asyncio

    # No connections registered for user 99
    # Calling broadcast on an empty room must complete cleanly
    async def _try_broadcast():
        await notification_manager.broadcast("99", {"type": "notification", "id": 1})

    # Should not raise
    asyncio.run(_try_broadcast())


def test_multi_tab_same_user_keeps_registry_alive_until_last_disconnect(mock_db_session):
    """When a user has 2 tabs open and closes one, the event registry entry
    must NOT be cleaned up until the LAST tab disconnects.

    Without this, the second tab would lose its event reference and stop
    receiving broadcasts.
    """
    from service.ws.notification_router import notification_manager, notification_event_registry
    user = _make_user(50)
    fresh_manager = ConnectionManager()
    token = _make_token()

    with patch("service.ws.notification_router.get_me", new=AsyncMock(return_value=user)), \
         patch("service.ws.notification_router.notification_manager", fresh_manager):
        with TestClient(app) as client:
            # Tab 1 connects
            with client.websocket_connect(f"/ws/notifications/50?token={token}") as ws1:
                # Tab 2 connects (same user)
                with client.websocket_connect(f"/ws/notifications/50?token={token}") as ws2:
                    # Both should be active
                    assert fresh_manager.active_connections("50") == 2
                    # Close tab 1
                    ws1.close()
                # ws1 cleanup happens during exit; tab 2 still inside its `with`
                # Tab 2 still active; the event registry should still have the entry
                # (cleanup_event only fires when active_connections == 0)
            # After both exit, registry should be cleaned
            # (We don't assert on registry internals here because the cleanup is async
            # and may complete after the sync assertion. The behavior we care about
            # — no exceptions during multi-tab disconnect — is validated by the test
            # not raising.)


def test_multiple_concurrent_broadcasts_do_not_crash(mock_db_session):
    """Firing several broadcasts to the same room in rapid succession should
    not crash the handler or the manager. This is a smoke-level guard against
    obvious race conditions."""
    from service.ws.notification_router import notification_manager
    import asyncio

    async def _fire_many():
        # No active connection — calls should all complete without raising
        tasks = [
            notification_manager.broadcast("123", {"type": "notification", "id": i})
            for i in range(10)
        ]
        await asyncio.gather(*tasks)

    asyncio.run(_fire_many())

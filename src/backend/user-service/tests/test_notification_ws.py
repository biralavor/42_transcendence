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

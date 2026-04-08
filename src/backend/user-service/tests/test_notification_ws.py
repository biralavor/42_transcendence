# src/backend/user-service/tests/test_notification_ws.py
"""
Endpoint integration tests for /ws/notifications/{user_id}.
DB mocked via conftest.py override_get_db (autouse).
ConnectionManager used as real instance (not mocked).
"""
import asyncio
import sys
import types
from datetime import timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

_service_dir = Path(__file__).resolve().parents[1]
_backend_dir = _service_dir.parent
sys.path.insert(0, str(_backend_dir))
sys.path.insert(0, str(_service_dir))

if "service" not in sys.modules:
    _mod = types.ModuleType("service")
    _mod.__path__ = [str(_service_dir)]
    _mod.__package__ = "service"
    sys.modules["service"] = _mod

from service.main import app  # noqa: E402
from shared.ws.manager import ConnectionManager  # noqa: E402


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


# ── happy path: message relay ─────────────────────────────────────────────────

def test_message_sent_to_channel_is_relayed_to_listener(mock_db_session):
    """
    Two sockets connect to the same user_id channel.
    A message sent by one is broadcast to both (including sender).
    """
    user = _make_user(42)
    fresh_manager = ConnectionManager()
    token = _make_token()

    # Pre-register a "receiver" socket in room "42"
    receiver_ws = MagicMock()
    receiver_ws.accept = AsyncMock()
    receiver_ws.send_json = AsyncMock()
    loop = asyncio.new_event_loop()
    loop.run_until_complete(fresh_manager.connect("42", receiver_ws))
    loop.close()

    payload = {"type": "game_invite", "from_user_id": 1, "to_user_id": 42, "room_id": "invite-1-42-000"}

    with patch("service.ws.notification_router.get_me", new=AsyncMock(return_value=user)), \
         patch("service.ws.notification_router.notification_manager", fresh_manager):
        with TestClient(app) as client:
            with client.websocket_connect(f"/ws/notifications/42?token={token}") as ws:
                ws.send_json(payload)

    receiver_ws.send_json.assert_any_await(payload)


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

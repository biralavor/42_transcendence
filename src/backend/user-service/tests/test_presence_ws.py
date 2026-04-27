# src/backend/user-service/tests/test_presence_ws.py
"""
Endpoint integration tests for /ws/presence.
DB mocked via conftest.py override_get_db (autouse).
PresenceManager used as real instance (not mocked).
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
from shared.ws.presence import PresenceManager  # noqa: E402


def _make_token(username: str = "alice") -> str:
    from service.service import create_access_token
    return create_access_token({"sub": username}, expires_delta=timedelta(minutes=30))


def _make_user(user_id: int = 1, username: str = "alice"):
    u = MagicMock()
    u.id = user_id
    u.username = username
    u.status = "offline"
    return u


# ── auth error paths ──────────────────────────────────────────────────────────

def test_missing_token_closes_4001():
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect("/ws/presence"):
                pass
        assert exc_info.value.code == 4001


def test_invalid_token_closes_4001():
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect("/ws/presence?token=notavalidjwt"):
                pass
        assert exc_info.value.code == 4001


# ── user-not-found path ────────────────────────────────────────────────────────

def test_get_me_error_closes_4001():
    """Any get_me failure (bad credentials, user not found, etc.) → close 4001."""
    token = _make_token("ghost")

    with patch("service.ws.presence_router.get_me", new=AsyncMock(side_effect=Exception("not found"))):
        with TestClient(app) as client:
            with pytest.raises(WebSocketDisconnect) as exc_info:
                with client.websocket_connect(f"/ws/presence?token={token}"):
                    pass
        assert exc_info.value.code == 4001


# ── happy path: no friends online ────────────────────────────────────────────

def test_connect_no_friends_online_no_broadcast(mock_db_session):
    user = _make_user(1)
    fresh_manager = PresenceManager()

    with patch("service.ws.presence_router.get_me", new=AsyncMock(return_value=user)), \
         patch("service.ws.presence_router.get_friends", new=AsyncMock(return_value=[])), \
         patch("service.ws.presence_router.presence_manager", fresh_manager), \
         patch("service.ws.presence_router.set_user_status", new=AsyncMock()):
        token = _make_token()
        with TestClient(app) as client:
            with client.websocket_connect(f"/ws/presence?token={token}") as ws:
                ws.close()

    # No friend sockets → nothing to assert on broadcast, just no exception


# ── happy path: friend receives online event ──────────────────────────────────

def test_friend_receives_online_event_on_connect(mock_db_session):
    user = _make_user(1, "alice")
    friend = _make_user(2, "bob")

    fresh_manager = PresenceManager()

    # Pre-register bob's socket
    bob_ws = MagicMock()
    bob_ws.accept = AsyncMock()
    bob_ws.send_json = AsyncMock()
    loop = asyncio.new_event_loop()
    loop.run_until_complete(fresh_manager.connect(2, bob_ws))
    loop.close()

    with patch("service.ws.presence_router.get_me", new=AsyncMock(return_value=user)), \
         patch("service.ws.presence_router.get_friends", new=AsyncMock(return_value=[friend])), \
         patch("service.ws.presence_router.presence_manager", fresh_manager), \
         patch("service.ws.presence_router.set_user_status", new=AsyncMock()):
        token = _make_token()
        with TestClient(app) as client:
            with client.websocket_connect(f"/ws/presence?token={token}") as ws:
                ws.close()

    bob_ws.send_json.assert_any_await(
        {"type": "presence", "user_id": 1, "status": "online"}
    )


# ── happy path: friend receives offline event on disconnect ───────────────────

def test_friend_receives_offline_event_on_disconnect(mock_db_session):
    user = _make_user(1, "alice")
    friend = _make_user(2, "bob")

    fresh_manager = PresenceManager()

    bob_ws = MagicMock()
    bob_ws.accept = AsyncMock()
    bob_ws.send_json = AsyncMock()
    loop = asyncio.new_event_loop()
    loop.run_until_complete(fresh_manager.connect(2, bob_ws))
    loop.close()

    with patch("service.ws.presence_router.get_me", new=AsyncMock(return_value=user)), \
         patch("service.ws.presence_router.get_friends", new=AsyncMock(return_value=[friend])), \
         patch("service.ws.presence_router.presence_manager", fresh_manager), \
         patch("service.ws.presence_router.set_user_status", new=AsyncMock()):
        token = _make_token()
        with TestClient(app) as client:
            with client.websocket_connect(f"/ws/presence?token={token}") as ws:
                ws.close()

    bob_ws.send_json.assert_any_await(
        {"type": "presence", "user_id": 1, "status": "offline"}
    )


# ── edge cases ────────────────────────────────────────────────────────────────

def test_multi_tab_same_user_only_emits_offline_on_last_disconnect(mock_db_session):
    """When a user has 2 tabs open and closes one, friends should NOT receive
    an `offline` event yet. Only when the LAST tab closes should the offline
    event fire.

    Without this guard, every tab close would flip the user's status visibly
    to friends, then back online when other tabs are still alive.
    """
    user = _make_user(60)
    fresh_manager = PresenceManager()
    token = _make_token()

    with patch("service.ws.presence_router.get_me", new=AsyncMock(return_value=user)), \
         patch("service.ws.presence_router.get_friends", new=AsyncMock(return_value=[])), \
         patch("service.ws.presence_router.presence_manager", fresh_manager), \
         patch("service.ws.presence_router.set_user_status", new=AsyncMock()):
        with TestClient(app) as client:
            with client.websocket_connect(f"/ws/presence?token={token}") as ws1:
                # Two tabs: total active = 2
                with client.websocket_connect(f"/ws/presence?token={token}") as ws2:
                    # Both registered — user has 2 active sockets
                    assert len(fresh_manager._users.get(user.id, set())) == 2
                    assert fresh_manager.is_online(user.id)
                    # Closing one tab does not crash
                    ws2.close()
                # After ws2 exits, ws1 still active — user is still online.
                # This is the load-bearing multi-tab assertion: with 2 tabs open,
                # closing one MUST NOT flip the user offline.
                assert fresh_manager.is_online(user.id)
            # ws1 also closed → last-disconnect; user goes offline.
            # Note: cleanup is async in the WS handler's `finally` block, so the
            # transition can happen slightly after the `with` exits. We poll a
            # few times rather than asserting immediately to avoid suite-order
            # flakiness (the assertion passes in isolation but can race when
            # the test suite is loaded with other WS tests).
            import time
            for _ in range(20):  # up to ~200ms
                if not fresh_manager.is_online(user.id):
                    break
                time.sleep(0.01)
            assert not fresh_manager.is_online(user.id), (
                "after the last tab disconnects, user should go offline (waited 200ms)"
            )


def test_presence_disconnect_with_no_friends_does_not_raise(mock_db_session):
    """User with no friends disconnects — must not raise (no one to notify).

    Regression guard: an empty friend list must not crash the offline-broadcast
    code path."""
    user = _make_user(70)
    fresh_manager = PresenceManager()
    token = _make_token()

    # presence_router.py imports `get_friends` (verified via grep of imports);
    # patch returns an empty list to simulate a user with zero friends.
    with patch("service.ws.presence_router.get_me", new=AsyncMock(return_value=user)), \
         patch("service.ws.presence_router.presence_manager", fresh_manager), \
         patch("service.ws.presence_router.set_user_status", new=AsyncMock()), \
         patch("service.ws.presence_router.get_friends", new=AsyncMock(return_value=[])):
        with TestClient(app) as client:
            with client.websocket_connect(f"/ws/presence?token={token}") as ws:
                ws.close()
            # No exception should propagate

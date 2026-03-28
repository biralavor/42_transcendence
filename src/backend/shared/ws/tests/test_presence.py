import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))  # .../src/backend

import pytest
from unittest.mock import AsyncMock, MagicMock
from shared.ws.presence import PresenceManager


@pytest.fixture
def manager():
    return PresenceManager()


def make_ws():
    ws = MagicMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    return ws


@pytest.mark.asyncio
async def test_connect_accepts_websocket(manager):
    ws = make_ws()
    await manager.connect(1, ws)
    ws.accept.assert_awaited_once()


@pytest.mark.asyncio
async def test_connect_tracks_user(manager):
    ws = make_ws()
    await manager.connect(1, ws)
    assert manager.is_online(1) is True


@pytest.mark.asyncio
async def test_is_online_false_before_connect(manager):
    assert manager.is_online(42) is False


@pytest.mark.asyncio
async def test_disconnect_removes_socket(manager):
    ws = make_ws()
    await manager.connect(1, ws)
    manager.disconnect(1, ws)
    assert manager.is_online(1) is False


@pytest.mark.asyncio
async def test_disconnect_prunes_empty_set(manager):
    ws = make_ws()
    await manager.connect(1, ws)
    manager.disconnect(1, ws)
    assert 1 not in manager._users


@pytest.mark.asyncio
async def test_broadcast_to_sends_to_all_sockets_of_user(manager):
    ws1, ws2 = make_ws(), make_ws()
    await manager.connect(1, ws1)
    await manager.connect(1, ws2)
    await manager.broadcast_to(1, {"type": "presence", "user_id": 99, "status": "online"})
    ws1.send_json.assert_awaited_once_with({"type": "presence", "user_id": 99, "status": "online"})
    ws2.send_json.assert_awaited_once_with({"type": "presence", "user_id": 99, "status": "online"})


@pytest.mark.asyncio
async def test_broadcast_to_silently_drops_dead_socket(manager):
    ws_dead, ws_alive = make_ws(), make_ws()
    ws_dead.send_json.side_effect = RuntimeError("closed")
    await manager.connect(1, ws_dead)
    await manager.connect(1, ws_alive)
    await manager.broadcast_to(1, {"type": "presence", "user_id": 2, "status": "online"})
    ws_alive.send_json.assert_awaited_once()
    assert manager.is_online(1) is True  # ws_alive still connected


@pytest.mark.asyncio
async def test_broadcast_to_unknown_user_is_noop(manager):
    # Must not raise
    await manager.broadcast_to(999, {"type": "presence", "user_id": 1, "status": "online"})

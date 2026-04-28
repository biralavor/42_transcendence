import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))  # .../src/backend

import pytest
from unittest.mock import AsyncMock, MagicMock
from shared.ws.manager import ConnectionManager


@pytest.fixture
def manager():
    return ConnectionManager()


def make_ws():
    ws = MagicMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    return ws


@pytest.mark.asyncio
async def test_connect_accepts_websocket(manager):
    ws = make_ws()
    await manager.connect("room1", ws)
    ws.accept.assert_awaited_once()


@pytest.mark.asyncio
async def test_connect_tracks_connection(manager):
    ws = make_ws()
    await manager.connect("room1", ws)
    assert manager.active_connections("room1") == 1


@pytest.mark.asyncio
async def test_disconnect_removes_connection(manager):
    ws = make_ws()
    await manager.connect("room1", ws)
    manager.disconnect("room1", ws)
    assert manager.active_connections("room1") == 0


@pytest.mark.asyncio
async def test_disconnect_removes_empty_room(manager):
    ws = make_ws()
    await manager.connect("room1", ws)
    manager.disconnect("room1", ws)
    # Room key must be pruned from _rooms, not just empty
    assert "room1" not in manager._rooms


@pytest.mark.asyncio
async def test_broadcast_sends_to_all_in_room(manager):
    ws1, ws2 = make_ws(), make_ws()
    await manager.connect("room1", ws1)
    await manager.connect("room1", ws2)
    await manager.broadcast("room1", {"msg": "hello"})
    ws1.send_json.assert_awaited_once_with({"msg": "hello"})
    ws2.send_json.assert_awaited_once_with({"msg": "hello"})


@pytest.mark.asyncio
async def test_broadcast_continues_after_failed_send(manager):
    ws1, ws2 = make_ws(), make_ws()
    ws1.send_json.side_effect = RuntimeError("connection closed")
    await manager.connect("room1", ws1)
    await manager.connect("room1", ws2)
    await manager.broadcast("room1", {"msg": "hello"})
    # Good socket still receives the message
    ws2.send_json.assert_awaited_once_with({"msg": "hello"})
    # Dead socket is evicted — no repeated exceptions on future broadcasts
    assert manager.active_connections("room1") == 1


@pytest.mark.asyncio
async def test_broadcast_does_not_cross_rooms(manager):
    ws1, ws2 = make_ws(), make_ws()
    await manager.connect("room1", ws1)
    await manager.connect("room2", ws2)
    await manager.broadcast("room1", {"msg": "private"})
    ws1.send_json.assert_awaited_once()
    ws2.send_json.assert_not_awaited()


@pytest.mark.asyncio
async def test_connect_default_role_is_player(manager):
    ws = make_ws()
    await manager.connect("room1", ws)
    assert manager.player_count("room1") == 1
    assert manager.spectator_count("room1") == 0


@pytest.mark.asyncio
async def test_connect_with_explicit_role_spectator_is_counted(manager):
    ws = make_ws()
    await manager.connect("room1", ws, role="spectator")
    assert manager.player_count("room1") == 0
    assert manager.spectator_count("room1") == 1
    # active_connections still counts both
    assert manager.active_connections("room1") == 1


@pytest.mark.asyncio
async def test_connect_mixed_roles_in_same_room(manager):
    p1, p2, s1, s2 = make_ws(), make_ws(), make_ws(), make_ws()
    await manager.connect("room1", p1, role="player")
    await manager.connect("room1", p2, role="player")
    await manager.connect("room1", s1, role="spectator")
    await manager.connect("room1", s2, role="spectator")
    assert manager.player_count("room1") == 2
    assert manager.spectator_count("room1") == 2
    assert manager.active_connections("room1") == 4


@pytest.mark.asyncio
async def test_disconnect_drops_role_entry(manager):
    p, s = make_ws(), make_ws()
    await manager.connect("room1", p, role="player")
    await manager.connect("room1", s, role="spectator")
    manager.disconnect("room1", s)
    assert manager.player_count("room1") == 1
    assert manager.spectator_count("room1") == 0
    manager.disconnect("room1", p)
    # both maps must be empty
    assert manager.player_count("room1") == 0
    assert manager.spectator_count("room1") == 0
    assert manager._rooms == {}
    assert manager._roles == {}


@pytest.mark.asyncio
async def test_unknown_room_counts_zero(manager):
    assert manager.player_count("nope") == 0
    assert manager.spectator_count("nope") == 0


@pytest.mark.asyncio
async def test_invalid_role_raises_value_error(manager):
    ws = make_ws()
    with pytest.raises(ValueError):
        await manager.connect("room1", ws, role="cheater")

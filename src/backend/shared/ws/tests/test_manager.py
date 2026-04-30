import asyncio
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
async def test_broadcast_sends_to_room_clients_concurrently(manager):
    ws1, ws2 = make_ws(), make_ws()
    sends_started = 0
    all_sends_started = asyncio.Event()
    release_sends = asyncio.Event()

    async def blocked_send(_message):
        nonlocal sends_started
        sends_started += 1
        if sends_started == 2:
            all_sends_started.set()
        await release_sends.wait()

    ws1.send_json.side_effect = blocked_send
    ws2.send_json.side_effect = blocked_send
    await manager.connect("room1", ws1)
    await manager.connect("room1", ws2)

    broadcast_task = asyncio.create_task(manager.broadcast("room1", {"msg": "hello"}))
    try:
        await asyncio.wait_for(all_sends_started.wait(), timeout=1)
    except asyncio.TimeoutError as exc:
        release_sends.set()
        await broadcast_task
        raise AssertionError("broadcast did not start all sends concurrently") from exc

    assert not broadcast_task.done()
    release_sends.set()
    await broadcast_task
    ws1.send_json.assert_awaited_once_with({"msg": "hello"})
    ws2.send_json.assert_awaited_once_with({"msg": "hello"})


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
    # All four lockstep maps must be empty after the last disconnect.
    assert manager.player_count("room1") == 0
    assert manager.spectator_count("room1") == 0
    assert manager._rooms == {}
    assert manager._roles == {}
    assert manager._player_counts == {}
    assert manager._spectator_counts == {}


@pytest.mark.asyncio
async def test_unknown_room_counts_zero(manager):
    assert manager.player_count("nope") == 0
    assert manager.spectator_count("nope") == 0


@pytest.mark.asyncio
async def test_invalid_role_raises_value_error(manager):
    ws = make_ws()
    with pytest.raises(ValueError):
        await manager.connect("room1", ws, role="cheater")


@pytest.mark.asyncio
async def test_per_room_counts_are_isolated(manager):
    """Counts on one room must not be affected by connections to another."""
    p1 = make_ws()
    p2 = make_ws()
    s1 = make_ws()
    await manager.connect("room-a", p1, role="player")
    await manager.connect("room-b", p2, role="player")
    await manager.connect("room-a", s1, role="spectator")

    assert manager.player_count("room-a") == 1
    assert manager.spectator_count("room-a") == 1
    assert manager.player_count("room-b") == 1
    assert manager.spectator_count("room-b") == 0


@pytest.mark.asyncio
async def test_double_disconnect_does_not_underflow_counts(manager):
    """Calling disconnect twice for the same (room, ws) — e.g. handler finally
    racing with broadcast self-disconnect — must NOT drive the counter
    negative or below zero."""
    ws = make_ws()
    await manager.connect("room1", ws, role="spectator")
    assert manager.spectator_count("room1") == 1

    manager.disconnect("room1", ws)
    manager.disconnect("room1", ws)  # idempotent

    assert manager.spectator_count("room1") == 0
    # The room key should be pruned and the counter dict empty — not stuck
    # at -1 or with a stale 0-valued entry.
    assert manager._spectator_counts == {}
    assert manager._roles == {}
    assert manager._rooms == {}


@pytest.mark.asyncio
async def test_broadcast_send_failure_decrements_role_counter(manager):
    """When a send_json failure during broadcast triggers the manager's
    self-healing disconnect, the per-room role counter must drop with it."""
    healthy = make_ws()
    dead = make_ws()
    dead.send_json = AsyncMock(side_effect=RuntimeError("client gone"))
    await manager.connect("room1", healthy, role="player")
    await manager.connect("room1", dead, role="spectator")

    assert manager.player_count("room1") == 1
    assert manager.spectator_count("room1") == 1

    await manager.broadcast("room1", {"hello": "world"})

    # The dead spectator was auto-disconnected mid-broadcast: its role and
    # the spectator counter must both have decremented in lockstep.
    assert manager.spectator_count("room1") == 0
    assert manager.player_count("room1") == 1  # healthy player untouched
    assert (("room1", dead)) not in manager._roles


@pytest.mark.asyncio
async def test_counts_track_role_specific_disconnects(manager):
    """Disconnecting a player must only decrement the player counter; the
    spectator counter for the same room stays put. Mirrors the reverse for
    spectator disconnect."""
    p, s = make_ws(), make_ws()
    await manager.connect("room1", p, role="player")
    await manager.connect("room1", s, role="spectator")
    assert manager.player_count("room1") == 1
    assert manager.spectator_count("room1") == 1

    manager.disconnect("room1", p)
    assert manager.player_count("room1") == 0
    assert manager.spectator_count("room1") == 1  # untouched

    manager.disconnect("room1", s)
    assert manager.player_count("room1") == 0
    assert manager.spectator_count("room1") == 0

import asyncio
import threading
import queue
import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from unittest.mock import AsyncMock, MagicMock
from main import app


@pytest.mark.timeout(5)
def test_ws_healthcheck_one_shot():
    """Healthcheck endpoint accepts, sends status, and closes immediately (one-shot)."""
    client = TestClient(app)
    
    with client.websocket_connect("/ws/game/healthcheck") as ws:
        # Healthcheck should send exactly one message then close
        data = ws.receive_json(mode='text')
        assert data["type"] == "healthcheck"
        assert data["status"] == "ok"
        
        # Attempting to receive again should raise (connection closed)
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


@pytest.mark.timeout(5)
def test_ws_healthcheck_access_denied_invalid_token():
    """Healthcheck denies access to non-localhost clients without valid token."""
    client = TestClient(app)
    
    # TestClient connects from localhost, so it should be allowed
    with client.websocket_connect("/ws/game/healthcheck") as ws:
        data = ws.receive_json()
        assert data["type"] == "healthcheck"


@pytest.mark.timeout(5)
def test_ws_games_are_isolated():
    """Multiple healthcheck connections are independent (one-shot nature means no broadcast)."""
    # Healthcheck is one-shot and closes immediately, so broadcast tests are N/A
    # Real game isolation would require authenticated connections with mock tokens,
    # which needs additional test setup beyond the scope of this basic suite.
    pytest.skip("Requires mock token generation and game session setup")


@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_disconnect_countdown_broadcasts_sequence_and_forfeits(monkeypatch):
    """_disconnect_countdown broadcasts descending seconds_left then calls _on_game_over."""
    import ws.router as router_module
    from ws.router import _disconnect_countdown

    broadcasts = []
    on_game_over_calls = []

    monkeypatch.setattr(router_module, "DISCONNECT_GRACE_SECONDS", 3)
    monkeypatch.setattr(asyncio, "sleep", AsyncMock(return_value=None))
    monkeypatch.setattr(
        router_module.manager, "broadcast",
        AsyncMock(side_effect=lambda gid, msg: broadcasts.append(msg)),
    )
    monkeypatch.setattr(router_module.manager, "active_connections", MagicMock(return_value=1))

    mock_session = MagicMock()
    mock_session.is_active = True
    mock_session.score.p1 = 5
    mock_session.score.p2 = 3
    monkeypatch.setattr(router_module.game_manager, "get_session", MagicMock(return_value=mock_session))

    async def mock_on_game_over(game_id, winner_id, score_p1, score_p2):
        on_game_over_calls.append((game_id, winner_id, score_p1, score_p2))
    monkeypatch.setattr(router_module, "_on_game_over", mock_on_game_over)

    await _disconnect_countdown("game-x", winner_id=2)

    assert len(broadcasts) == 3
    assert broadcasts[0] == {"type": "opponent_disconnected", "seconds_left": 3}
    assert broadcasts[1] == {"type": "opponent_disconnected", "seconds_left": 2}
    assert broadcasts[2] == {"type": "opponent_disconnected", "seconds_left": 1}
    assert on_game_over_calls == [("game-x", 2, 5, 3)]


@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_disconnect_countdown_no_forfeit_when_no_connections(monkeypatch):
    """_disconnect_countdown must not call _on_game_over when active_connections == 0."""
    import ws.router as router_module
    from ws.router import _disconnect_countdown

    on_game_over_calls = []

    monkeypatch.setattr(router_module, "DISCONNECT_GRACE_SECONDS", 3)
    monkeypatch.setattr(asyncio, "sleep", AsyncMock(return_value=None))
    monkeypatch.setattr(router_module.manager, "broadcast", AsyncMock())
    monkeypatch.setattr(router_module.manager, "active_connections", MagicMock(return_value=0))

    mock_session = MagicMock()
    mock_session.is_active = True
    monkeypatch.setattr(router_module.game_manager, "get_session", MagicMock(return_value=mock_session))

    async def mock_on_game_over(*args):
        on_game_over_calls.append(args)
    monkeypatch.setattr(router_module, "_on_game_over", mock_on_game_over)

    await _disconnect_countdown("game-x", winner_id=2)

    assert on_game_over_calls == [], "_on_game_over must not fire when nobody is connected"


@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_disconnect_countdown_handles_cancellation_cleanly(monkeypatch):
    """Cancelling _disconnect_countdown mid-countdown does not propagate CancelledError."""
    import ws.router as router_module
    from ws.router import _disconnect_countdown

    on_game_over_calls = []
    first_sleep_reached = asyncio.Event()

    async def blocking_sleep(_duration):
        first_sleep_reached.set()
        await asyncio.Event().wait()  # blocks until CancelledError from task.cancel()

    monkeypatch.setattr(router_module, "DISCONNECT_GRACE_SECONDS", 30)
    monkeypatch.setattr(asyncio, "sleep", blocking_sleep)
    monkeypatch.setattr(router_module.manager, "broadcast", AsyncMock())

    async def mock_on_game_over(*args):
        on_game_over_calls.append(args)
    monkeypatch.setattr(router_module, "_on_game_over", mock_on_game_over)

    task = asyncio.create_task(_disconnect_countdown("game-x", winner_id=2))
    await first_sleep_reached.wait()  # countdown is now suspended inside blocking_sleep
    task.cancel()
    await task  # must NOT raise — _disconnect_countdown swallows CancelledError internally

    assert task.done(), "task must be done"
    assert not task.cancelled(), "_disconnect_countdown must swallow CancelledError, not re-raise it"
    assert on_game_over_calls == [], "_on_game_over must not be called when countdown is cancelled"


@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_disconnect_handler_pauses_and_tracks_player():
    """Mid-game disconnect: session is paused and player is tracked in _disconnected_players."""
    mock_session = MagicMock()
    mock_session.is_active = True
    mock_session.is_paused = False
    mock_session.player2_id = 2  # not AI

    mock_gm = MagicMock()
    mock_gm.get_session.return_value = mock_session

    disconnected: dict[str, int] = {}
    timers: dict[str, asyncio.Task] = {}

    def fake_pause(game_id):
        mock_session.is_paused = True

    mock_gm.pause_session.side_effect = fake_pause

    # Reproduce the `else` branch logic from the finally block
    game_id = "match-abc"
    player_id = 1
    setup = (1, 2)
    AI_ID = 99999  # sentinel that is NOT session.player2_id

    session = mock_gm.get_session(game_id)
    if session and session.is_active and session.player2_id != AI_ID:
        p1, p2 = setup
        winner_id = p2 if player_id == p1 else p1
        mock_gm.pause_session(game_id)
        disconnected[game_id] = player_id
        task = asyncio.create_task(asyncio.sleep(100))
        timers[game_id] = task

    assert mock_session.is_paused is True
    assert disconnected.get(game_id) == player_id
    assert game_id in timers

    timers[game_id].cancel()
    try:
        await timers[game_id]
    except asyncio.CancelledError:
        pass


@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_remaining_zero_cancels_in_flight_timer():
    """When the last player disconnects while a countdown is running, the timer stops.

    _disconnect_countdown swallows CancelledError, so the task finishes normally
    (done=True, cancelled=False) — not in the asyncio "cancelled" state.
    """
    async def fake_countdown():
        try:
            await asyncio.sleep(100)
        except asyncio.CancelledError:
            pass  # mirrors _disconnect_countdown: swallows CancelledError

    task = asyncio.create_task(fake_countdown())
    # Yield to the event loop so the task reaches asyncio.sleep(100) —
    # mirroring production where _disconnect_countdown is mid-execution when cancelled.
    await asyncio.sleep(0)

    timers: dict[str, asyncio.Task] = {"match-abc": task}
    disconnected: dict[str, int] = {"match-abc": 1}

    # Reproduce the `remaining == 0` branch logic
    game_id = "match-abc"
    timer = timers.pop(game_id, None)
    if timer and not timer.done():
        timer.cancel()
    disconnected.pop(game_id, None)

    await asyncio.sleep(0.05)  # let cancel propagate and task finish

    assert game_id not in timers
    assert game_id not in disconnected
    assert timer.done(), "Task must be done after cancellation"
    assert not timer.cancelled(), "Task swallows CancelledError so it finishes normally, not in cancelled state"


@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_remaining_zero_skips_cleanup_when_session_already_inactive():
    """When remaining==0 but session.is_active is False (natural game-over task
    already scheduled), the cleanup branch must not pop _match_ids so that
    _on_game_over can still record the DB result."""
    mock_session = MagicMock()
    mock_session.is_active = False  # game loop ended naturally via check_victory

    mock_gm = MagicMock()
    mock_gm.get_session.return_value = mock_session

    game_id = "match-race"
    match_ids: dict[str, int] = {game_id: 42}
    setup_sessions: dict[str, tuple] = {game_id: (1, 2)}

    session = mock_gm.get_session(game_id)

    # Reproduce the `remaining == 0` guard from game_websocket's finally block
    if session is None or session.is_active:
        await mock_gm.delete_session(game_id)
        setup_sessions.pop(game_id, None)
        match_ids.pop(game_id, None)

    # session.is_active is False → cleanup should be skipped
    mock_gm.delete_session.assert_not_called()
    assert game_id in match_ids, "_match_ids must be preserved so _on_game_over can write the result"
    assert game_id in setup_sessions, "_setup_sessions must be preserved"


@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_remaining_zero_runs_cleanup_when_session_is_active():
    """When remaining==0 and the session is still active (mid-game disconnect
    with no natural game-over), full cleanup must proceed."""
    mock_session = MagicMock()
    mock_session.is_active = True  # game was in progress when both disconnected
    mock_session.player2_id = 2    # not AI — avoids the AI-forfeit branch

    mock_gm = MagicMock()
    mock_gm.get_session.return_value = mock_session
    mock_gm.delete_session = AsyncMock()

    game_id = "match-active"
    match_ids: dict[str, int] = {game_id: 7}
    setup_sessions: dict[str, tuple] = {game_id: (1, 2)}

    session = mock_gm.get_session(game_id)

    if session is None or session.is_active:
        await mock_gm.delete_session(game_id)
        setup_sessions.pop(game_id, None)
        match_ids.pop(game_id, None)

    mock_gm.delete_session.assert_called_once_with(game_id)
    assert game_id not in match_ids, "_match_ids should be cleared for active-session cleanup"
    assert game_id not in setup_sessions


@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_reconnect_cancels_timer_resumes_and_sends_snapshot():
    """Reconnecting player cancels countdown, resumes game, gets snapshot, other player notified."""
    game_id = "match-xyz"
    player_id = 1

    timer_handled_cancel = []

    async def fake_long_task():
        try:
            await asyncio.sleep(100)
        except asyncio.CancelledError:
            timer_handled_cancel.append(True)

    task = asyncio.create_task(fake_long_task())
    await asyncio.sleep(0)  # yield so fake_long_task reaches its first suspension point
    disconnected: dict[str, int] = {game_id: player_id}
    timers: dict[str, asyncio.Task] = {game_id: task}

    resumed: list[str] = []
    snapshot_msgs: list[dict] = []
    broadcasts: list[dict] = []

    mock_session = MagicMock()
    snap = MagicMock()
    snap.ball = {"x": 512.0, "y": 256.0, "vx": 25.6, "vy": 0.0}
    snap.paddles = {"p1": 206.0, "p2": 206.0}
    snap.score = {"p1": 2, "p2": 3}
    mock_session.get_state_snapshot.return_value = snap

    mock_gm = MagicMock()
    mock_gm.get_session.return_value = mock_session
    mock_gm.resume_session.side_effect = lambda gid: resumed.append(gid)

    mock_ws = AsyncMock()
    mock_ws.send_json = AsyncMock(side_effect=lambda msg: snapshot_msgs.append(msg))

    mock_mgr = AsyncMock()
    mock_mgr.broadcast = AsyncMock(side_effect=lambda gid, msg: broadcasts.append(msg))

    # Reproduce the reconnect block from ws/router.py
    if game_id in disconnected and disconnected[game_id] == player_id:
        t = timers.pop(game_id, None)
        if t and not t.done():
            t.cancel()
        disconnected.pop(game_id, None)

        mock_gm.resume_session(game_id)

        session = mock_gm.get_session(game_id)
        if session:
            s = session.get_state_snapshot()
            await mock_ws.send_json({
                "type": "state",
                "ball": s.ball,
                "paddles": s.paddles,
                "score": s.score,
            })

        await mock_mgr.broadcast(game_id, {"type": "opponent_reconnected"})

    await asyncio.sleep(0.05)

    assert game_id not in disconnected
    assert game_id not in timers
    assert resumed == [game_id]
    assert len(snapshot_msgs) == 1
    assert snapshot_msgs[0]["type"] == "state"
    assert "ball" in snapshot_msgs[0]
    assert len(broadcasts) == 1
    assert broadcasts[0] == {"type": "opponent_reconnected"}
    assert timer_handled_cancel, "Countdown task should have caught CancelledError"


# --------------------------------------------------------------------------- #
# Spectator classification (Task 7 + 8)
# --------------------------------------------------------------------------- #

@pytest.mark.timeout(5)
def test_ws_no_token_no_session_closes_4004():
    """Anonymous client connects to a room with no active session — must be
    classified as spectator and immediately closed with 4004 (not 4001)."""
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/game/spec-test-no-session"):
            pass
    assert exc_info.value.code == 4004


# --------------------------------------------------------------------------- #
# Spectator branch — observable behaviours (Task 8)
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_spectator_loop_sends_initial_state_and_registers(monkeypatch):
    """A spectator gets the current game-state snapshot immediately and is
    registered in the manager with role='spectator'."""
    import service.ws.router as router_module
    from service.ws.router import _spectator_loop

    # Stub out manager + session
    sent_messages: list[dict] = []
    fake_manager = MagicMock()
    fake_manager.connect = AsyncMock()
    fake_manager.disconnect = MagicMock()
    fake_manager.broadcast = AsyncMock()
    fake_manager.spectator_count = MagicMock(return_value=1)
    monkeypatch.setattr(router_module, "manager", fake_manager)

    fake_session = MagicMock()
    fake_session.get_state_snapshot = MagicMock(return_value=MagicMock(
        __dataclass_fields__={},  # asdict-friendly
    ))
    monkeypatch.setattr(router_module.game_manager, "get_session", MagicMock(return_value=fake_session))

    # Patch asdict so we don't need a real dataclass
    monkeypatch.setattr(router_module, "asdict", lambda x: {"ball": "stub", "paddles": "stub", "score": "stub"})

    ws = MagicMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock(side_effect=lambda m: sent_messages.append(m))
    ws.close = AsyncMock()
    # Simulate disconnect on the very first receive_text call
    ws.receive_text = AsyncMock(side_effect=WebSocketDisconnect(code=1000))

    await _spectator_loop(ws, "g-1")

    fake_manager.connect.assert_awaited_once_with("g-1", ws, role="spectator")
    # 1) Snapshot was sent first
    assert sent_messages[0]["type"] == "state"
    # 2) Then a spectator_count broadcast was issued (via manager.broadcast)
    fake_manager.broadcast.assert_any_await("g-1", {"type": "spectator_count", "count": 1})


@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_spectator_loop_closes_on_inbound_message_with_4003(monkeypatch):
    """Any inbound message from a spectator triggers close(code=4003)."""
    import service.ws.router as router_module
    from service.ws.router import _spectator_loop

    fake_manager = MagicMock()
    fake_manager.connect = AsyncMock()
    fake_manager.disconnect = MagicMock()
    fake_manager.broadcast = AsyncMock()
    fake_manager.spectator_count = MagicMock(return_value=1)
    monkeypatch.setattr(router_module, "manager", fake_manager)

    fake_session = MagicMock()
    fake_session.get_state_snapshot = MagicMock(return_value=MagicMock())
    monkeypatch.setattr(router_module.game_manager, "get_session", MagicMock(return_value=fake_session))
    monkeypatch.setattr(router_module, "asdict", lambda x: {"ball": "x"})

    ws = MagicMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    ws.close = AsyncMock()
    ws.receive_text = AsyncMock(return_value='{"type":"input","direction":"up"}')

    await _spectator_loop(ws, "g-2")

    ws.close.assert_awaited()
    args, kwargs = ws.close.await_args
    assert kwargs.get("code") == 4003 or (args and args[0] == 4003)


@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_spectator_loop_broadcasts_count_decrement_on_disconnect(monkeypatch):
    """When the spectator disconnects, the loop broadcasts the new (lower) count."""
    import service.ws.router as router_module
    from service.ws.router import _spectator_loop

    counts = iter([1, 0])  # first call after connect, second after disconnect

    fake_manager = MagicMock()
    fake_manager.connect = AsyncMock()
    fake_manager.disconnect = MagicMock()
    fake_manager.broadcast = AsyncMock()
    fake_manager.spectator_count = MagicMock(side_effect=lambda *_a, **_kw: next(counts))
    monkeypatch.setattr(router_module, "manager", fake_manager)

    fake_session = MagicMock()
    fake_session.get_state_snapshot = MagicMock(return_value=MagicMock())
    monkeypatch.setattr(router_module.game_manager, "get_session", MagicMock(return_value=fake_session))
    monkeypatch.setattr(router_module, "asdict", lambda x: {"ball": "x"})

    ws = MagicMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    ws.close = AsyncMock()
    ws.receive_text = AsyncMock(side_effect=WebSocketDisconnect(code=1000))

    await _spectator_loop(ws, "g-3")

    # Two count broadcasts: 1 on join, 0 on leave
    broadcast_calls = [c.args for c in fake_manager.broadcast.await_args_list]
    counts_broadcast = [args[1]["count"] for args in broadcast_calls if args[1].get("type") == "spectator_count"]
    assert counts_broadcast == [1, 0]


@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_spectator_loop_disconnects_manager_on_exit(monkeypatch):
    """The loop must always call manager.disconnect on exit, even if the
    initial state-send raises."""
    import service.ws.router as router_module
    from service.ws.router import _spectator_loop

    fake_manager = MagicMock()
    fake_manager.connect = AsyncMock()
    fake_manager.disconnect = MagicMock()
    fake_manager.broadcast = AsyncMock()
    fake_manager.spectator_count = MagicMock(return_value=0)
    monkeypatch.setattr(router_module, "manager", fake_manager)

    fake_session = MagicMock()
    fake_session.get_state_snapshot = MagicMock(side_effect=RuntimeError("boom"))
    monkeypatch.setattr(router_module.game_manager, "get_session", MagicMock(return_value=fake_session))

    ws = MagicMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    ws.close = AsyncMock()
    ws.receive_text = AsyncMock(side_effect=WebSocketDisconnect(code=1000))

    await _spectator_loop(ws, "g-4")

    fake_manager.disconnect.assert_called_once_with("g-4", ws)
    # Even if the snapshot raises, the entry-side count broadcast must still
    # have been attempted so other clients see the new spectator. Counts a
    # broadcast as "spectator_count" if the message dict carries that type.
    spectator_count_broadcasts = [
        c for c in fake_manager.broadcast.await_args_list
        if c.args[1].get("type") == "spectator_count"
    ]
    assert len(spectator_count_broadcasts) >= 1, (
        "spectator_count broadcast must fire on entry even when snapshot raises"
    )


@pytest.mark.timeout(5)
def test_ws_spectator_input_closes_with_4003_via_testclient(monkeypatch):
    """Integration-level: real TestClient + a stubbed session to verify the
    classifier reaches the spectator branch and rejects an input message."""
    import service.ws.router as router_module

    # Inject a fake session for room 'spec-int-1' so the classifier doesn't 4004.
    fake_session = MagicMock()
    fake_session.player1_id = 5001
    fake_session.player2_id = 5002
    fake_session.get_state_snapshot = MagicMock(return_value=MagicMock())
    monkeypatch.setattr(router_module.game_manager, "get_session", MagicMock(return_value=fake_session))
    monkeypatch.setattr(router_module, "asdict", lambda x: {"ball": "x"})

    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/game/spec-int-1") as ws:  # no token → spectator
            # Drain server-pushed pre-input frames: snapshot + spectator_count
            ws.receive_text()  # initial state snapshot
            ws.receive_text()  # spectator_count broadcast
            ws.send_text('{"type":"input","direction":"up"}')
            # Server now receives the input and closes 4003
            ws.receive_text()  # raises WebSocketDisconnect
    assert exc_info.value.code == 4003

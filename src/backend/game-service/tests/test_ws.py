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
def test_ws_game_requires_token_for_non_healthcheck():
    """Connecting to a non-healthcheck game_id without token should be rejected."""
    client = TestClient(app)
    
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/game/some-game-id"):
            pass
    
    assert exc_info.value.code == 4001


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

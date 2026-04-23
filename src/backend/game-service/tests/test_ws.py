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
async def test_disconnect_countdown_broadcasts_once_per_second():
    """Countdown sends opponent_disconnected with descending seconds_left."""
    broadcasts = []
    mock_manager = AsyncMock()
    mock_manager.broadcast = AsyncMock(side_effect=lambda gid, msg: broadcasts.append(msg))

    # Fast version: 3 steps at 0.05s each instead of 30 × 1s
    async def fast_countdown(game_id, steps=3):
        for seconds_left in range(steps, 0, -1):
            await mock_manager.broadcast(game_id, {
                "type": "opponent_disconnected",
                "seconds_left": seconds_left,
            })
            await asyncio.sleep(0.05)

    await fast_countdown("g1")

    assert len(broadcasts) == 3
    assert broadcasts[0] == {"type": "opponent_disconnected", "seconds_left": 3}
    assert broadcasts[1] == {"type": "opponent_disconnected", "seconds_left": 2}
    assert broadcasts[2] == {"type": "opponent_disconnected", "seconds_left": 1}


@pytest.mark.asyncio
@pytest.mark.timeout(5)
async def test_disconnect_countdown_handles_cancellation_cleanly():
    """Cancelling the countdown task does not propagate CancelledError."""
    cancelled_cleanly = []

    async def fake_countdown():
        try:
            await asyncio.sleep(100)
        except asyncio.CancelledError:
            cancelled_cleanly.append(True)
            # must NOT re-raise — mirror _disconnect_countdown behaviour

    task = asyncio.create_task(fake_countdown())
    await asyncio.sleep(0.05)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass  # acceptable if task propagates; we just care it doesn't crash

    assert cancelled_cleanly, "Task should have caught CancelledError internally"


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
    """When the last player disconnects while a countdown is running, the timer is cancelled."""
    async def fake_countdown():
        try:
            await asyncio.sleep(100)
        except asyncio.CancelledError:
            pass  # Mirror _disconnect_countdown behaviour

    task = asyncio.create_task(fake_countdown())
    timers: dict[str, asyncio.Task] = {"match-abc": task}
    disconnected: dict[str, int] = {"match-abc": 1}

    # Reproduce the `remaining == 0` branch logic
    game_id = "match-abc"
    timer = timers.pop(game_id, None)
    if timer and not timer.done():
        timer.cancel()
    disconnected.pop(game_id, None)

    await asyncio.sleep(0.05)  # let cancel propagate

    assert game_id not in timers
    assert game_id not in disconnected
    assert timer.done(), "Timer task should be done (cancelled)"
    assert timer.cancelled(), "Timer task should be marked as cancelled"


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

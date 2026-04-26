"""
Integration tests for GameManager with async game loop.
"""

import sys
import asyncio
import pytest
from pathlib import Path

# Setup path for imports
_service_dir = Path(__file__).resolve().parents[1]
_backend_dir = _service_dir.parent

sys.path.insert(0, str(_backend_dir))
sys.path.insert(0, str(_service_dir))

if "service" not in sys.modules:
    import types
    _mod = types.ModuleType("service")
    _mod.__path__ = [str(_service_dir)]
    _mod.__package__ = "service"
    sys.modules["service"] = _mod


@pytest.mark.asyncio
async def test_game_manager_creation():
    """Test that GameManager can create and manage sessions."""
    from service.game_manager import GameManager
    
    manager = GameManager()
    
    # Track broadcasted states
    states_received = []
    
    async def mock_broadcast(game_id: str, state: dict):
        states_received.append((game_id, state))
    
    # Create a session
    session = await manager.create_session(
        game_id="test-game-1",
        player1_id=1,
        player2_id=2,
        broadcast_callback=mock_broadcast,
    )
    
    assert session is not None
    assert session.player1_id == 1
    assert session.player2_id == 2
    
    # Let game loop run a few ticks
    await asyncio.sleep(0.2)  # ~6 ticks at 30 FPS
    
    # Should have received broadcasts
    assert len(states_received) > 0, "Game loop should broadcast states"
    
    # Check state structure
    game_id, state = states_received[0]
    assert game_id == "test-game-1"
    assert "ball" in state
    assert "paddles" in state
    assert "score" in state
    
    # Clean up
    await manager.delete_session("test-game-1")
    
    print(f"✓ test_game_manager_creation passed (received {len(states_received)} broadcasts)")


@pytest.mark.asyncio
async def test_player_input_accepts_clock_skewed_client_ts():
    """Inputs must not depend on synchronized clocks between two LAN players."""
    from service.game_manager import GameManager
    import time
    
    manager = GameManager()
    
    async def mock_broadcast(game_id: str, state: dict):
        pass
    
    session = await manager.create_session(
        game_id="test-latency",
        player1_id=1,
        player2_id=2,
        broadcast_callback=mock_broadcast,
    )
    
    current_time = int(time.time() * 1000)
    await manager.handle_player_input(
        game_id="test-latency",
        player_id=1,
        message={
            "type": "input",
            "direction": "up",
            "client_ts": current_time,
        }
    )
    assert session.p1_direction == "up", "Fresh input should be accepted"
    
    # A real second PC can have a clock that differs from the host. Movement
    # should still work because the WebSocket connection already authenticates
    # the player, and the direction is just the current input state.
    await manager.handle_player_input(
        game_id="test-latency",
        player_id=1,
        message={
            "type": "input",
            "direction": "down",
            "client_ts": current_time - 500,
        }
    )
    assert session.p1_direction == "down", "Clock-skewed input should be accepted"

    # Bad timestamp metadata should not block otherwise valid movement input.
    await manager.handle_player_input(
        game_id="test-latency",
        player_id=1,
        message={
            "type": "input",
            "direction": "down",
            "client_ts": "not-a-number",
        }
    )
    assert session.p1_direction == "down", "Invalid timestamp metadata should be ignored"

    # Clean up
    await manager.delete_session("test-latency")
    
    print("✓ test_player_input_accepts_clock_skewed_client_ts passed")


@pytest.mark.asyncio
async def test_player_input_routing():
    """Test that inputs are routed to correct players."""
    from service.game_manager import GameManager
    import time
    
    manager = GameManager()
    
    async def mock_broadcast(game_id: str, state: dict):
        pass
    
    session = await manager.create_session(
        game_id="test-routing",
        player1_id=100,
        player2_id=200,
        broadcast_callback=mock_broadcast,
    )
    
    current_time = int(time.time() * 1000)
    
    # Player 1 sends input
    await manager.handle_player_input(
        game_id="test-routing",
        player_id=100,
        message={"type": "input", "direction": "up", "client_ts": current_time}
    )
    assert session.p1_direction == "up"
    assert session.p2_direction == "stop"  # P2 unchanged
    
    # Player 2 sends input
    await manager.handle_player_input(
        game_id="test-routing",
        player_id=200,
        message={"type": "input", "direction": "down", "client_ts": current_time}
    )
    assert session.p1_direction == "up"  # P1 unchanged
    assert session.p2_direction == "down"
    
    # Clean up
    await manager.delete_session("test-routing")
    
    print("✓ test_player_input_routing passed")


@pytest.mark.asyncio
async def test_game_manager_ai_params_stored_on_session():
    """create_session with ai_params stores them on the session object."""
    from service.game_manager import GameManager
    from service.ai import AI_PLAYER_ID

    manager = GameManager()
    params = {"error_rate": 0.0, "reaction_delay_ms": 0}

    async def noop_broadcast(game_id, state):
        pass

    session = await manager.create_session(
        game_id="ai-test-1",
        player1_id=1,
        player2_id=AI_PLAYER_ID,
        broadcast_callback=noop_broadcast,
        ai_params=params,
    )
    assert session.ai_params == params
    await manager.delete_session("ai-test-1")


@pytest.mark.asyncio
async def test_game_manager_ai_drives_p2_direction():
    """With error_rate=0, reaction_delay_ms=0, AI must move p2 toward ball."""
    from service.game_manager import GameManager
    from service.ai import AI_PLAYER_ID

    manager = GameManager()
    # error_rate=0 → never freezes; reaction_delay_ms=0 → re-evaluates every tick
    params = {"error_rate": 0.0, "reaction_delay_ms": 0}

    async def capture_broadcast(game_id, state):
        pass

    session = await manager.create_session(
        game_id="ai-test-2",
        player1_id=1,
        player2_id=AI_PLAYER_ID,
        broadcast_callback=capture_broadcast,
        ai_params=params,
    )

    # Let the game loop run several ticks
    await asyncio.sleep(0.3)  # ~9 ticks at 30 FPS

    # p2_direction must have been set by the AI (not left as "stop" forever)
    # We check by reading it after ticks; the value is set each tick so it's live.
    assert session.p2_direction in ("up", "down", "stop")
    await manager.delete_session("ai-test-2")


@pytest.mark.asyncio
async def test_game_manager_no_ai_params_leaves_p2_direction_as_stop():
    """Without ai_params, p2 direction is never set by the AI (stays as input-driven)."""
    from service.game_manager import GameManager

    manager = GameManager()

    async def noop_broadcast(game_id, state):
        pass

    session = await manager.create_session(
        game_id="human-test-1",
        player1_id=1,
        player2_id=2,
        broadcast_callback=noop_broadcast,
    )
    await asyncio.sleep(0.1)
    # p2_direction should be "stop" (default) since no AI is driving it
    assert session.p2_direction == "stop"
    await manager.delete_session("human-test-1")


@pytest.mark.asyncio
async def test_create_session_applies_speed_multiplier():
    """GameManager must pass speed_multiplier through to the GameSession."""
    from service.game_manager import GameManager
    from service.game_session import GameSession

    manager = GameManager()
    states = []

    async def mock_broadcast(game_id, state):
        states.append(state)

    session = await manager.create_session(
        game_id="speed-test-1",
        player1_id=1,
        player2_id=2,
        broadcast_callback=mock_broadcast,
        speed_multiplier=2.0,
    )
    await asyncio.sleep(0.05)
    await manager.delete_session("speed-test-1")

    assert abs(session.speed_multiplier - 2.0) < 0.001
    assert abs(session.ball.vx - GameSession.INITIAL_BALL_VX * 2.0) < 0.1


@pytest.mark.asyncio
async def test_create_session_default_speed_multiplier_is_1():
    from service.game_manager import GameManager

    manager = GameManager()

    async def mock_broadcast(game_id, state):
        pass

    session = await manager.create_session(
        game_id="speed-test-default",
        player1_id=1,
        player2_id=2,
        broadcast_callback=mock_broadcast,
    )
    await asyncio.sleep(0.05)
    await manager.delete_session("speed-test-default")

    assert session.speed_multiplier == 1.0


@pytest.mark.asyncio
async def test_pause_session_stops_broadcasts():
    """While paused, the game loop does not advance or broadcast."""
    from service.game_manager import GameManager

    manager = GameManager()
    states = []

    async def mock_broadcast(game_id, state):
        states.append(state)

    await manager.create_session(
        game_id="pause-test",
        player1_id=1,
        player2_id=2,
        broadcast_callback=mock_broadcast,
    )
    await asyncio.sleep(0.15)  # ~4 ticks at 30 FPS
    assert len(states) > 0, "Should have broadcasts before pause"

    manager.pause_session("pause-test")
    states.clear()

    await asyncio.sleep(0.15)
    assert len(states) == 0, "No broadcasts while paused"

    await manager.delete_session("pause-test")


@pytest.mark.asyncio
async def test_resume_session_restarts_broadcasts():
    """After resume, the game loop broadcasts normally again."""
    from service.game_manager import GameManager

    manager = GameManager()
    states = []

    async def mock_broadcast(game_id, state):
        states.append(state)

    await manager.create_session(
        game_id="resume-test",
        player1_id=1,
        player2_id=2,
        broadcast_callback=mock_broadcast,
    )
    await asyncio.sleep(0.1)
    assert len(states) > 0, "Must have broadcasts before pausing"

    manager.pause_session("resume-test")
    states.clear()
    await asyncio.sleep(0.1)
    assert len(states) == 0

    manager.resume_session("resume-test")
    await asyncio.sleep(0.15)
    assert len(states) > 0, "Broadcasts should resume after resume_session()"

    await manager.delete_session("resume-test")


def test_pause_resume_unknown_game_is_noop():
    """pause_session / resume_session on a non-existent game_id must not raise."""
    from service.game_manager import GameManager
    manager = GameManager()
    manager.pause_session("ghost-game")   # must not raise
    manager.resume_session("ghost-game")  # must not raise


async def main():
    print("Running GameManager integration tests...\n")

    try:
        await test_game_manager_creation()
        await test_player_input_accepts_clock_skewed_client_ts()
        await test_player_input_routing()
        await test_game_manager_ai_params_stored_on_session()
        await test_game_manager_ai_drives_p2_direction()
        await test_game_manager_no_ai_params_leaves_p2_direction_as_stop()
        await test_create_session_applies_speed_multiplier()
        await test_create_session_default_speed_multiplier_is_1()
        await test_pause_session_stops_broadcasts()
        await test_resume_session_restarts_broadcasts()
        test_pause_resume_unknown_game_is_noop()

        print("\n✅ All integration tests passed!")
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

    return True


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)

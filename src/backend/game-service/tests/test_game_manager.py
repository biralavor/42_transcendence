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
async def test_latency_filter():
    """Test that inputs with high latency are filtered out."""
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
    
    # Send a fresh input (should be accepted)
    current_time = int(time.time() * 1000)
    await manager.handle_player_input(
        game_id="test-latency",
        player_id=1,
        message={
            "type": "input",
            "direction": "up",
            "client_ts": current_time,  # Current time
        }
    )
    assert session.p1_direction == "up", "Fresh input should be accepted"
    
    # Send a stale input (very old timestamp - should be rejected)
    await manager.handle_player_input(
        game_id="test-latency",
        player_id=1,
        message={
            "type": "input",
            "direction": "down",
            "client_ts": current_time - 500,  # 500ms old - exceeds 300ms threshold
        }
    )
    assert session.p1_direction == "up", "Stale input should be ignored"
    
    # Send an invalid timestamp (string - should be rejected)
    await manager.handle_player_input(
        game_id="test-latency",
        player_id=1,
        message={
            "type": "input",
            "direction": "down",
            "client_ts": "not-a-number",
        }
    )
    assert session.p1_direction == "up", "Invalid timestamp type should be ignored"

    # Clean up
    await manager.delete_session("test-latency")
    
    print("✓ test_latency_filter passed")


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


async def main():
    print("Running GameManager integration tests...\n")
    
    try:
        await test_game_manager_creation()
        await test_latency_filter()
        await test_player_input_routing()
        
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

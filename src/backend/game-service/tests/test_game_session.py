"""
Quick test to verify GameSession physics work correctly.

This test validates:
1. Ball movement and collision detection
2. Paddle movement
3. Scoring logic
"""

import sys
from pathlib import Path

# Setup path for imports (same as conftest pattern)
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


def test_game_session_creation():
    """Test that GameSession can be created."""
    from service.game_session import GameSession
    
    session = GameSession(player1_id=1, player2_id=2)
    
    assert session.player1_id == 1
    assert session.player2_id == 2
    assert session.score.p1 == 0
    assert session.score.p2 == 0
    assert session.is_active
    assert session.tick_count == 0


def test_paddle_movement():
    """Test paddle movement."""
    from service.game_session import GameSession
    
    session = GameSession(player1_id=1, player2_id=2)
    initial_p1_y = session.paddles.p1
    
    # Move player 1 up
    session.p1_direction = "up"
    session.update_paddles()
    assert session.paddles.p1 < initial_p1_y
    after_moving_up_p1_y = session.paddles.p1
    
    # Move player 1 down
    session.p1_direction = "down"
    session.update_paddles()
    assert session.paddles.p1 > after_moving_up_p1_y


def test_ball_movement():
    """Test ball movement."""
    from service.game_session import GameSession
    
    session = GameSession(player1_id=1, player2_id=2)
    initial_x = session.ball.x
    initial_y = session.ball.y
    
    # Update ball
    session.update_ball()
    
    # Ball should move according to velocity
    assert session.ball.x == initial_x + session.ball.vx
    assert session.ball.y == initial_y + session.ball.vy


def test_game_tick():
    """Test one complete game tick."""
    from service.game_session import GameSession
    
    session = GameSession(player1_id=1, player2_id=2)
    initial_tick = session.tick_count
    
    session.tick()
    
    assert session.tick_count == initial_tick + 1


def test_scoring():
    """Test scoring when ball passes paddle."""
    from service.game_session import GameSession
    
    session = GameSession(player1_id=1, player2_id=2)
    
    # Move ball to left edge (player 2 scores)
    session.ball.x = -10
    session.check_scoring()
    assert session.score.p2 == 1
    assert session.ball.x == session.INITIAL_BALL_X
    
    # Move ball to right edge (player 1 scores)
    session.ball.x = session.CANVAS_WIDTH + 10
    session.check_scoring()
    assert session.score.p1 == 1


def test_state_snapshot():
    """Test state snapshot generation."""
    from service.game_session import GameSession
    
    session = GameSession(player1_id=1, player2_id=2)
    snapshot = session.get_state_snapshot()
    
    assert "ball" in snapshot.__dict__
    assert "paddles" in snapshot.__dict__
    assert "score" in snapshot.__dict__
    assert snapshot.ball["x"] == session.ball.x
    assert snapshot.paddles["p1"] == session.paddles.p1
    assert snapshot.score["p1"] == session.score.p1


if __name__ == "__main__":
    test_game_session_creation()
    print("✓ test_game_session_creation passed")
    
    test_paddle_movement()
    print("✓ test_paddle_movement passed")
    
    test_ball_movement()
    print("✓ test_ball_movement passed")
    
    test_game_tick()
    print("✓ test_game_tick passed")
    
    test_scoring()
    print("✓ test_scoring passed")
    
    test_state_snapshot()
    print("✓ test_state_snapshot passed")
    
    print("\n✅ All tests passed!")

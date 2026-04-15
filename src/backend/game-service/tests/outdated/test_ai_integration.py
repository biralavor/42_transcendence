import asyncio
import pytest
import time
from unittest.mock import patch, AsyncMock, MagicMock
from starlette.testclient import TestClient
from main import app
from service.ai import AI_PLAYER_ID, DIFFICULTY_PARAMS
from service.game_manager import game_manager
from service.game_session import GameSession

@pytest.fixture
def client():
    # Mock database for start_ai_game
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.fetchone.return_value = [1]
    mock_session.execute.return_value = mock_result
    
    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__.return_value = mock_session
    
    with patch("service.ws.router.AsyncSessionLocal", mock_factory):
        yield TestClient(app)

@pytest.mark.asyncio
async def test_ai_game_loop_integration():
    """Verify AI paddle actually moves during a game session."""
    # Create an AI game with hard difficulty (low error, low delay)
    params = DIFFICULTY_PARAMS["hard"]
    
    # We'll use a direct game_manager call to have control over the session
    game_id = "test-ai-int"
    player_id = 1
    
    async def noop_broadcast(gid, state):
        pass

    session = await game_manager.create_session(
        game_id=game_id,
        player1_id=player_id,
        player2_id=AI_PLAYER_ID,
        broadcast_callback=noop_broadcast,
        ai_params=params
    )
    
    try:
        # Set ball moving towards AI (p2)
        session.ball.x = 100
        session.ball.y = 100
        session.ball.vx = 5
        session.ball.vy = 2
        
        # Initial paddle position (center)
        initial_p2_y = session.paddles.p2
        
        # Let it run for a few ticks
        # At 30 FPS, 0.2s is ~6 ticks
        await asyncio.sleep(0.2)
        
        # AI should have started moving the paddle
        # With ball at (100,100) and v=(5,2), it's moving down
        # predicted intercept will be > 100
        assert session.p2_direction != "stop"
        assert session.paddles.p2 != initial_p2_y
        
    finally:
        await game_manager.delete_session(game_id)

@pytest.mark.asyncio
async def test_ai_difficulty_application():
    """Verify different difficulties result in different session params."""
    from service.ws.router import start_ai_game
    from service.schemas import AiGameRequest
    
    # Mock game_manager.create_session
    with patch("service.ws.router.game_manager.create_session", new_callable=AsyncMock) as mock_create:
        # Mock DB
        mock_db = AsyncMock()
        mock_match = MagicMock()
        mock_match.id = 123
        with patch("service.ws.router.AsyncSessionLocal", return_value=MagicMock(__aenter__=AsyncMock(return_value=mock_db))):
            with patch("service.ws.router.create_match", return_value=mock_match):
                
                # Test Easy
                await start_ai_game(AiGameRequest(player_id=1, difficulty="easy"))
                args, kwargs = mock_create.call_args
                assert kwargs["ai_params"] == DIFFICULTY_PARAMS["easy"]
                
                # Test Hard
                await start_ai_game(AiGameRequest(player_id=1, difficulty="hard"))
                args, kwargs = mock_create.call_args
                assert kwargs["ai_params"] == DIFFICULTY_PARAMS["hard"]

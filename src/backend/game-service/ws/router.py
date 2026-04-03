# Note: sys.path is set by main.py (Docker) or test file (host) — not repeated here.
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Security, status
from fastapi.exceptions import WebSocketException
import json

from shared.ws.manager import ConnectionManager
from shared.database import AsyncSessionLocal
from service.auth import get_current_user_id
from service.persistence import create_match, finish_match
from service.game_manager import game_manager
from sqlalchemy.exc import SQLAlchemyError

router = APIRouter()
manager = ConnectionManager()

# Maps game_id (str) → (player1_id, player2_id) for sessions being set up
_setup_sessions: dict[str, tuple[int, int]] = {}


async def _broadcast_state(game_id: str, state_snapshot: dict) -> None:
    """Broadcast game state to both clients in a session.
    
    Args:
        game_id: Unique game identifier
        state_snapshot: GameStateSnapshot serialized to dict with:
                       {ball: {...}, paddles: {...}, score: {...}}
    """
    msg = {
        "type": "state",
        **state_snapshot  # Flatten snapshot: ball, paddles, score at top level
    }
    await manager.broadcast(game_id, msg)


@router.websocket("/ws/game/{game_id}")
async def game_websocket(websocket: WebSocket, game_id: str) -> None:
    """
    WebSocket handler for in-game communication during a Pong match.
    
    Protocol:
    - Client → Server: {"type": "input", "direction": "up"|"down"|"stop", "client_ts": <ms>}
    - Server → Client: {"type": "state", "ball": {...}, "paddles": {...}, "score": {...}}
    
    The game loop runs independently in game_manager and broadcasts state
    to all connected clients each tick. This handler only processes inputs.
    """
    # Accept the connection
    await manager.connect(game_id, websocket)
    
    # Track which player this connection belongs to
    player_id: int | None = None
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            if not isinstance(data, dict):
                continue
            
            event_type = data.get("type")
            
            # Handle game_start: initialize game session
            if event_type == "game_start":
                player1_id = data.get("player1_id")
                player2_id = data.get("player2_id")
                
                if not isinstance(player1_id, int) or not isinstance(player2_id, int):
                    continue
                
                # Check if this is a new game or joining an existing setup
                if game_id not in _setup_sessions:
                    # This is the first player to connect
                    _setup_sessions[game_id] = (player1_id, player2_id)
                
                # Once both players are ready or we have the info, create the session
                p1, p2 = _setup_sessions[game_id]
                
                # Start the authoritative game loop if not already started
                if not game_manager.get_session(game_id):
                    try:
                        await game_manager.create_session(
                            game_id,
                            p1,
                            p2,
                            broadcast_callback=_broadcast_state,
                        )
                        # Create database match record
                        try:
                            async with AsyncSessionLocal() as db:
                                match = await create_match(db, p1, p2)
                                # Store for later reference when game ends
                                if not hasattr(websocket, "_match_id"):
                                    websocket._match_id = match.id
                        except SQLAlchemyError:
                            pass  # best-effort
                    except ValueError:
                        # Game already exists, that's fine
                        pass
                
                # Store which player this connection is
                if player_id is None:
                    player_id = player1_id if len(manager.active_connections(game_id)) == 1 else player2_id
            
            # Handle player input (with latency filtering)
            elif event_type == "input":
                # Get the session
                session = game_manager.get_session(game_id)
                if session:
                    # Identify this player if we haven't already
                    if player_id is None:
                        # Infer from current connections
                        if manager.active_connections(game_id) == 1:
                            player_id = session.player1_id
                        elif manager.active_connections(game_id) == 2:
                            player_id = session.player2_id
                    
                    # Process input (latency filtering happens in game_manager)
                    if player_id:
                        await game_manager.handle_player_input(game_id, player_id, data)
            
            # Handle game_end: finish the match and clean up
            elif event_type == "game_end":
                winner_id = data.get("winner_id")
                score_p1 = data.get("score_p1", 0)
                score_p2 = data.get("score_p2", 0)
                
                session = game_manager.get_session(game_id)
                if session and isinstance(winner_id, int):
                    # Update database
                    try:
                        async with AsyncSessionLocal() as db:
                            if hasattr(websocket, "_match_id"):
                                await finish_match(
                                    db,
                                    websocket._match_id,
                                    winner_id,
                                    score_p1,
                                    score_p2
                                )
                    except SQLAlchemyError:
                        pass  # best-effort
                    finally:
                        # Clean up game session
                        await game_manager.delete_session(game_id)
                        _setup_sessions.pop(game_id, None)
    
    except WebSocketDisconnect:
        # Client disconnected
        pass
    
    finally:
        # Clean up on disconnect
        manager.disconnect(game_id, websocket)
        
        # If this was the last player, end the game
        if manager.active_connections(game_id) == 0:
            await game_manager.delete_session(game_id)
            _setup_sessions.pop(game_id, None)

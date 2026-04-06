# Note: sys.path is set by main.py (Docker) or test file (host) — not repeated here.
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import jwt
from sqlalchemy import text

from shared.config.settings import settings
from shared.ws.manager import ConnectionManager
from shared.database import AsyncSessionLocal
from service.persistence import create_match, finish_match
from service.game_manager import game_manager
from sqlalchemy.exc import SQLAlchemyError

router = APIRouter()
manager = ConnectionManager()

# Maps game_id (str) → (player1_id, player2_id) for sessions being set up
_setup_sessions: dict[str, tuple[int, int]] = {}
# Maps game_id (str) → match_id (int) for database updates
_match_ids: dict[str, int] = {}


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


async def _on_game_over(game_id: str, winner_id: int, score_p1: int, score_p2: int) -> None:
    """Server-driven callback when a match naturally ends."""
    try:
        async with AsyncSessionLocal() as db:
            match_id = _match_ids.get(game_id)
            if match_id is not None:
                await finish_match(
                    db,
                    match_id,
                    winner_id,
                    score_p1,
                    score_p2
                )
    except SQLAlchemyError:
        pass  # best-effort
    finally:
        # Clean up memory
        await game_manager.delete_session(game_id)
        _setup_sessions.pop(game_id, None)
        _match_ids.pop(game_id, None)
        
        # Broadcast the game over event authoritatively
        await manager.broadcast(game_id, {
            "type": "game_over",
            "winner_id": winner_id,
            "score_p1": score_p1,
            "score_p2": score_p2
        })


@router.websocket("/ws/game/{game_id}")
async def game_websocket(websocket: WebSocket, game_id: str, token: str | None = None) -> None:
    """
    WebSocket handler for in-game communication during a Pong match.
    
    Protocol:
    - Client → Server: {"type": "input", "direction": "up"|"down"|"stop", "client_ts": <ms>}
    - Server → Client: {"type": "state", "ball": {...}, "paddles": {...}, "score": {...}}
    
    The game loop runs independently in game_manager and broadcasts state
    to all connected clients each tick. This handler only processes inputs.
    """
    # Allow healthcheck script to connect without auth
    if game_id == "healthcheck":
        await manager.connect(game_id, websocket)
        return

    if not token:
        await websocket.close(code=4001)
        return

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        credential_id = payload.get("credential_id")
        if credential_id is None:
            await websocket.close(code=4001)
            return
            
        # Resolve credential_id -> user.id (Hybrid Pattern Fast Path)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                text("SELECT id FROM users WHERE credential_id = :cid"),
                {"cid": credential_id}
            )
            row = result.fetchone()
            if not row:
                await websocket.close(code=4001)
                return
            player_id = row[0]
    except Exception:
        await websocket.close(code=4001)
        return

    # Accept the connection
    await manager.connect(game_id, websocket)
    
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
                
                # Verify the authenticated user is part of this game
                if player_id not in (player1_id, player2_id):
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
                            on_game_over_callback=_on_game_over,
                        )
                        # Create database match record
                        try:
                            async with AsyncSessionLocal() as db:
                                match = await create_match(db, p1, p2)
                                # Store for later reference when game ends
                                _match_ids[game_id] = match.id
                        except SQLAlchemyError:
                            pass  # best-effort
                    except ValueError:
                        # Game already exists, that's fine
                        pass
            
            # Handle player input (with latency filtering)
            elif event_type == "input":
                # Get the session
                session = game_manager.get_session(game_id)
                if session:
                    # Process input using verified DB player_id
                    await game_manager.handle_player_input(game_id, player_id, data)
            
            # Pass-through other events (e.g., player_ready, player_unready, cancel_waiting_room)
            else:
                await manager.broadcast(game_id, data)
    
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
            _match_ids.pop(game_id, None)

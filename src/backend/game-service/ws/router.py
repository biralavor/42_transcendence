# Note: sys.path is set by main.py (Docker) or test file (host) — not repeated here.
import asyncio
from uuid import uuid4
from dataclasses import asdict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from jose import jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from shared.config.settings import settings
from shared.ws.manager import ConnectionManager
from shared.database import AsyncSessionLocal, get_db
from shared.logging import ws_logger
from service.persistence import create_match, finish_match
from service.game_manager import game_manager
from service.ai import AI_PLAYER_ID, DIFFICULTY_PARAMS
from service.auth import get_current_user_id
from service.schemas import AiGameRequest, AiGameResponse
from sqlalchemy.exc import SQLAlchemyError

router = APIRouter()
manager = ConnectionManager()

# Maps game_id (str) → (player1_id, player2_id) for sessions being set up
_setup_sessions: dict[str, tuple[int, int]] = {}
# Maps game_id (str) → match_id (int) for database updates
_match_ids: dict[str, int] = {}
# Maps game_id (str) → {player_id: ready_bool} for waiting-room ready tracking
_player_ready: dict[str, dict[int, bool]] = {}
# Maps game_id → player_id who disconnected mid-game (waiting to reconnect or time out)
_disconnected_players: dict[str, int] = {}
# Maps game_id → asyncio Task running the disconnect countdown
_disconnect_timers: dict[str, asyncio.Task] = {}


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
                if winner_id == AI_PLAYER_ID:
                    # AI has no users row in production, so award_xp would raise
                    # a FK violation and rollback the whole transaction, leaving
                    # the match stuck 'ongoing'. Update the row directly instead.
                    await db.execute(
                        text(
                            "UPDATE matches "
                            "SET status = 'finished', "
                            "    winner_id = :winner_id, "
                            "    score_p1 = :score_p1, "
                            "    score_p2 = :score_p2, "
                            "    finished_at = NOW() "
                            "WHERE id = :match_id"
                        ),
                        {
                            "match_id": match_id,
                            "winner_id": winner_id,
                            "score_p1": score_p1,
                            "score_p2": score_p2,
                        },
                    )
                    await db.commit()
                else:
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


# Colocated with the WS router (rather than service/router.py) because it
# seeds _match_ids / _setup_sessions and wires _on_game_over / _broadcast_state,
# all of which live here and are consumed by the WS handler below.


async def _disconnect_countdown(game_id: str, winner_id: int) -> None:
    """Broadcast a countdown and award forfeit win if the player doesn't reconnect."""
    try:
        for seconds_left in range(30, 0, -1):
            await manager.broadcast(game_id, {
                "type": "opponent_disconnected",
                "seconds_left": seconds_left,
            })
            await asyncio.sleep(1.0)

        # Timeout expired: award forfeit win to the still-connected player
        session = game_manager.get_session(game_id)
        if session and session.is_active:
            await _on_game_over(game_id, winner_id, session.score.p1, session.score.p2)
    except asyncio.CancelledError:
        pass  # Reconnect cancelled the timer — normal path, do nothing
    finally:
        # Clean up whether we timed out, were cancelled, or errored
        _disconnected_players.pop(game_id, None)
        _disconnect_timers.pop(game_id, None)


@router.post("/ai", status_code=201, response_model=AiGameResponse)
async def start_ai_game(
    body: AiGameRequest,
    player_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> AiGameResponse:
    """Start an AI game session.

    Creates a match record (player2 = AI_PLAYER_ID), reads the player's
    game_preferences to get their ball_speed_multiplier, starts the authoritative
    game loop with imperfection parameters for the chosen difficulty, and
    returns a game_id the client can use to connect via WS /ws/game/{game_id}.
    """
    ai_params = DIFFICULTY_PARAMS[body.difficulty]
    game_id = f"ai-{uuid4().hex[:12]}"

    # Read ball_speed_multiplier from the player's game_preferences.
    # Defaults to 1.0 if the user has no preferences row or the column is NULL.
    try:
        result = await db.execute(
            text("SELECT game_preferences FROM users WHERE id = :uid"),
            {"uid": player_id},
        )
        row = result.fetchone()
        prefs = row[0] if row and row[0] else {}
        speed_multiplier: float = float(prefs.get("ball_speed_multiplier", 1.0))
        speed_multiplier = max(0.5, min(2.0, speed_multiplier))  # clamp to valid range
    except (SQLAlchemyError, ValueError, TypeError, AttributeError) as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(
            "Failed to load game_preferences for player %s, using default: %s",
            player_id, e,
        )
        speed_multiplier = 1.0

    try:
        match = await create_match(db, player_id, AI_PLAYER_ID)
        _match_ids[game_id] = match.id
    except SQLAlchemyError:
        raise HTTPException(status_code=500, detail="Failed to create match record")

    try:
        await game_manager.create_session(
            game_id=game_id,
            player1_id=player_id,
            player2_id=AI_PLAYER_ID,
            broadcast_callback=_broadcast_state,
            on_game_over_callback=_on_game_over,
            ai_params=ai_params,
            speed_multiplier=speed_multiplier,
        )
    except ValueError:
        # game_id collision (astronomically unlikely with uuid4, but guard it)
        _match_ids.pop(game_id, None)
        raise HTTPException(status_code=500, detail="Game session collision")

    return AiGameResponse(game_id=game_id)


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
    # Healthcheck endpoint: restricted, one-shot, no relay
    if game_id == "healthcheck":
        # Restrict to localhost or internal Docker network for health checks
        # Accept connections from localhost, Docker internal network (172.x.x.x), TestClient, and healthcheck_token
        client_host = websocket.client.host if websocket.client else ""
        healthcheck_token = token  # Reuse token param for healthcheck auth
        # TestClient uses "testclient" as host, treat it as local; also allow empty string (testing)
        is_local = (
            not client_host 
            or client_host in ("127.0.0.1", "localhost", "::1", "testclient")
            or client_host.startswith("172.")
        )
        is_authorized = is_local or (healthcheck_token == settings.HEALTHCHECK_TOKEN if hasattr(settings, 'HEALTHCHECK_TOKEN') else False)
        
        if not is_authorized:
            await websocket.close(code=4003, reason="Healthcheck access denied")
            return
        
        try:
            await websocket.accept()
            # Send one "ok" response and close — don't relay or broadcast
            await websocket.send_json({"type": "healthcheck", "status": "ok"})
        except Exception:
            pass
        finally:
            try:
                await websocket.close()
            except Exception:
                pass
        return

    if not token:
        await websocket.close(code=4001)
        return

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
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
    
    # Log connection
    import logging
    logger = logging.getLogger(__name__)
    active_in_room = manager.active_connections(game_id)
    logger.info(
        f"[CONNECTION] Player {player_id} connected to room {game_id}. "
        f"Now {active_in_room} player(s) in room."
    )
    
    ws_logger.connection(
        game_id=game_id,
        player_id=player_id,
        state='open',
        metadata={'token_valid': token is not None, 'active_connections': active_in_room}
    )
    
    try:
        while True:
            # Start flow timing
            flow_start = ws_logger.flow_start(game_id, 'receive_and_process')
            
            # Receive message from client
            data = await websocket.receive_json()
            
            # Log incoming payload
            ws_logger.receive(game_id, player_id, data)
            
            if not isinstance(data, dict):
                continue
            
            event_type = data.get("type")
            
            # Handle player_ready: track ready state and broadcast game_start when both ready
            if event_type == "player_ready":
                if game_id not in _player_ready:
                    _player_ready[game_id] = {}
                _player_ready[game_id][player_id] = True
                
                # Broadcast player_ready to all connected clients
                await manager.broadcast(game_id, data)
                ws_logger.ready(game_id, player_id, data)
                
                # Check if both players are ready
                if game_id in _setup_sessions:
                    p1, p2 = _setup_sessions[game_id]
                    ready_states = _player_ready.get(game_id, {})
                    if ready_states.get(p1) and ready_states.get(p2):
                        # Both ready: broadcast game_start to initiate game
                        await manager.broadcast(game_id, {
                            "type": "game_start",
                            "player1_id": p1,
                            "player2_id": p2,
                        })
                        ws_logger.session_state(game_id, {
                            'p1_id': p1,
                            'p2_id': p2,
                            'status': 'both_players_ready'
                        })
            
            # Handle player_unready: update ready state and broadcast
            elif event_type == "player_unready":
                if game_id not in _player_ready:
                    _player_ready[game_id] = {}
                _player_ready[game_id][player_id] = False
                
                # Broadcast player_unready to all connected clients
                await manager.broadcast(game_id, data)
                ws_logger.uiUpdate(game_id, {'player_unready': player_id})
            
            # Handle game_start: initialize game session
            if event_type == "game_start":
                ws_logger.ready(game_id, player_id, data)
                
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
                    ws_logger.session_state(game_id, {
                        'p1_id': player1_id,
                        'p2_id': player2_id,
                        'status': 'setup_initiated'
                    })
                
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
                        ws_logger.session_state(game_id, {
                            'p1_id': p1,
                            'p2_id': p2,
                            'status': 'session_created'
                        })
                        
                        # Create database match record
                        try:
                            async with AsyncSessionLocal() as db:
                                match = await create_match(db, p1, p2)
                                # Store for later reference when game ends
                                _match_ids[game_id] = match.id
                                ws_logger.latency(f'game_start_to_session_created_{game_id}', flow_start)
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
                # Log incoming data details for debugging
                incoming_event_type = data.get("type", "unknown")
                incoming_user_id = data.get("user_id", data.get("player_id"))
                active_connections = manager.active_connections(game_id)
                
                # Log the incoming message and room state
                import logging
                logger = logging.getLogger(__name__)
                logger.info(
                    f"[BROADCAST] {incoming_event_type} from player {incoming_user_id} "
                    f"to room {game_id} with {active_connections} active connections"
                )
                
                # Log broadcast
                ws_logger.broadcast(
                    game_id=game_id,
                    payload=data,
                    client_count=active_connections
                )
                
                # Broadcast to all connected clients in this room
                try:
                    await manager.broadcast(game_id, data)
                    logger.info(f"[BROADCAST] Successfully sent {incoming_event_type} to {active_connections} clients")
                except Exception as e:
                    logger.error(f"[BROADCAST] Error broadcasting {incoming_event_type}: {e}")
                
                ws_logger.flow_end(game_id, 'receive_and_broadcast', flow_start)
    
    except WebSocketDisconnect:
        # Log connection close
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[DISCONNECT] Player {player_id} disconnected from room {game_id}")
        
        ws_logger.connection(
            game_id=game_id,
            player_id=player_id,
            state='close',
            metadata={'reason': 'disconnect'}
        )
        # Client disconnected
        pass
    
    finally:
        # Clean up on disconnect
        manager.disconnect(game_id, websocket)
        
        import logging
        logger = logging.getLogger(__name__)
        remaining = manager.active_connections(game_id)
        logger.info(f"[CLEANUP] Player {player_id} removed from room {game_id}. Remaining: {remaining}")
        
        # If this was the last player, end the game
        if remaining == 0:
            logger.info(f"[CLEANUP] Room {game_id} is empty, cleaning up game session")

            # If this is an AI game whose match wasn't already finalized by
            # the natural game-over callback, record a forfeit with the
            # current score snapshot and AI as the winner. We update the
            # matches row directly instead of calling finish_match, because
            # finish_match awards XP to the winner via an FK-bound user_xp
            # row — and AI_PLAYER_ID has no users row, so that path would
            # rollback the whole transaction.
            session = game_manager.get_session(game_id)
            match_id = _match_ids.get(game_id)
            # session.is_active is flipped to False synchronously when the
            # game loop detects victory (game_manager.py), before _on_game_over
            # is scheduled. Skipping when inactive prevents the forfeit write
            # from racing with — and overwriting — the natural game-over commit.
            if (
                match_id is not None
                and session is not None
                and session.player2_id == AI_PLAYER_ID
                and session.is_active
            ):
                try:
                    async with AsyncSessionLocal() as db:
                        await db.execute(
                            text(
                                "UPDATE matches "
                                "SET status = 'finished', "
                                "    winner_id = :winner_id, "
                                "    score_p1 = :score_p1, "
                                "    score_p2 = :score_p2, "
                                "    finished_at = NOW() "
                                "WHERE id = :match_id"
                            ),
                            {
                                "match_id": match_id,
                                "winner_id": AI_PLAYER_ID,
                                "score_p1": session.score.p1,
                                "score_p2": session.score.p2,
                            },
                        )
                        await db.commit()
                except SQLAlchemyError:
                    pass  # best-effort

            await game_manager.delete_session(game_id)
            _setup_sessions.pop(game_id, None)
            _match_ids.pop(game_id, None)
            _player_ready.pop(game_id, None)

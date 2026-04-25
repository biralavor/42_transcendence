# Note: sys.path is set by main.py (Docker) or test file (host) — not repeated here.
import asyncio
import re
import time
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
from service.persistence import (
    create_match,
    finish_match,
    get_tournament_with_participants,
    record_tournament_match_timeout_result,
)
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
# Maps game_id → player_id who disconnected mid-game (waiting to reconnect or time out)
_disconnected_players: dict[str, int] = {}
# Maps game_id → asyncio Task running the disconnect countdown
_disconnect_timers: dict[str, asyncio.Task] = {}

DISCONNECT_GRACE_SECONDS = 30

_waiting_room_ready: dict[str, set[int]] = {}
_waiting_room_players: dict[str, tuple[int, int]] = {}
_tournament_ready: dict[tuple[int, int], set[int]] = {}
_tournament_waiting_rooms: dict[tuple[int, int], str] = {}
_waiting_room_tournament_context: dict[str, tuple[int, int, int]] = {}
_waiting_room_timeout_tasks: dict[str, asyncio.Task] = {}
_waiting_room_timeout_deadline: dict[str, float] = {}
_tournament_ready_timeout_tasks: dict[tuple[int, int], asyncio.Task] = {}

READY_TIMEOUT_SECONDS = 90
_INVITE_ROOM_ID_RE = re.compile(r"^invite-(\d+)-(\d+)-")


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


def _cancel_task(task: asyncio.Task | None) -> None:
    if task is None or task.done():
        return
    if task is asyncio.current_task():
        return
    task.cancel()


def _cancel_waiting_room_timeout(game_id: str) -> None:
    task = _waiting_room_timeout_tasks.pop(game_id, None)
    _cancel_task(task)
    _waiting_room_timeout_deadline.pop(game_id, None)


def _remove_tournament_ready_state(ready_key: tuple[int, int]) -> None:
    _tournament_ready.pop(ready_key, None)
    _tournament_waiting_rooms.pop(ready_key, None)


def _cancel_tournament_ready_timeout(ready_key: tuple[int, int]) -> None:
    task = _tournament_ready_timeout_tasks.pop(ready_key, None)
    _cancel_task(task)


def _parse_invite_room_players(game_id: str) -> tuple[int, int] | None:
    match = _INVITE_ROOM_ID_RE.match(game_id)
    if not match:
        return None
    return int(match.group(1)), int(match.group(2))


def _ensure_waiting_room_players(game_id: str) -> tuple[int, int] | None:
    players = _waiting_room_players.get(game_id) or _setup_sessions.get(game_id)
    if players is not None:
        return players

    parsed = _parse_invite_room_players(game_id)
    if parsed is not None:
        _waiting_room_players[game_id] = parsed
        return parsed

    return None


def _is_waiting_room_timeout_resolved(game_id: str) -> bool:
    players = _ensure_waiting_room_players(game_id)
    if players is None:
        return False
    ready_set = _waiting_room_ready.get(game_id, set())
    return players[0] in ready_set and players[1] in ready_set


async def _finalize_regular_match_timeout(
    game_id: str,
    player1_id: int,
    player2_id: int,
    ready_set: set[int],
) -> dict:
    ready_players = {pid for pid in ready_set if pid in (player1_id, player2_id)}
    winner_id: int | None = None
    if len(ready_players) == 1:
        winner_id = next(iter(ready_players))

    match_id = _match_ids.get(game_id)

    try:
        async with AsyncSessionLocal() as db:
            if match_id is None:
                created = await create_match(db, player1_id, player2_id)
                match_id = created.id
                _match_ids[game_id] = match_id

            if winner_id is None:
                await db.execute(
                    text(
                        "UPDATE matches "
                        "SET status = 'finished', "
                        "    winner_id = NULL, "
                        "    score_p1 = 0, "
                        "    score_p2 = 0, "
                        "    finished_at = NOW() "
                        "WHERE id = :match_id"
                    ),
                    {"match_id": match_id},
                )
                await db.commit()
            else:
                score_p1, score_p2 = (
                    (1, 0) if winner_id == player1_id else (0, 1)
                )
                await finish_match(
                    db,
                    match_id=match_id,
                    winner_id=winner_id,
                    score_p1=score_p1,
                    score_p2=score_p2,
                )
    except SQLAlchemyError:
        return {
            "winner_id": winner_id,
            "match_id": match_id,
            "tournament_complete": False,
            "tournament_id": None,
            "newly_assigned": [],
        }

    return {
        "winner_id": winner_id,
        "match_id": match_id,
        "tournament_complete": False,
        "tournament_id": None,
        "newly_assigned": [],
    }


async def _handle_waiting_room_timeout(game_id: str) -> None:
    try:
        await asyncio.sleep(READY_TIMEOUT_SECONDS)
    except asyncio.CancelledError:
        return

    if _is_waiting_room_timeout_resolved(game_id):
        _waiting_room_timeout_tasks.pop(game_id, None)
        return

    players = _ensure_waiting_room_players(game_id)
    if players is None:
        _waiting_room_timeout_tasks.pop(game_id, None)
        return

    player1_id, player2_id = players
    ready_set = set(_waiting_room_ready.get(game_id, set()))
    tournament_ctx = _waiting_room_tournament_context.get(game_id)

    payload: dict = {
        "type": "ready_timeout",
        "room_id": game_id,
        "timeout_seconds": READY_TIMEOUT_SECONDS,
        "timeout_deadline": _waiting_room_timeout_deadline.get(game_id),
        "player1_id": player1_id,
        "player2_id": player2_id,
        "winner_id": None,
        "match_id": _match_ids.get(game_id),
    }

    if tournament_ctx is not None:
        tournament_id, tournament_match_id, tournament_match_row_id = tournament_ctx
        ready_players = {pid for pid in ready_set if pid in (player1_id, player2_id)}
        timeout_winner: int | None = None
        if len(ready_players) == 1:
            timeout_winner = next(iter(ready_players))

        tournament_complete = False
        newly_assigned: list = []
        all_matches: list = []
        try:
            async with AsyncSessionLocal() as db:
                try:
                    _, tournament_complete, newly_assigned = await record_tournament_match_timeout_result(
                        db=db,
                        tournament_id=tournament_id,
                        tournament_match_id=tournament_match_row_id,
                        winner_id=timeout_winner,
                    )
                except Exception:
                    await db.rollback()
                    tournament_complete = False
                    newly_assigned = []

                tournament_data = await get_tournament_with_participants(db, tournament_id)
                if tournament_data is not None:
                    _, _, all_matches = tournament_data
        except SQLAlchemyError:
            pass

        sync_tournament_ready_timeouts(tournament_id, all_matches)

        payload.update(
            {
                "tournament_id": tournament_id,
                "tournament_match_id": tournament_match_row_id,
                "winner_id": timeout_winner,
                "match_id": tournament_match_id,
                "tournament_complete": tournament_complete,
            },
        )

        tournament_room = f"tournament_{tournament_id}"
        await manager.broadcast(tournament_room, payload | {"type": "match_ready_timeout"})
        await manager.broadcast(
            tournament_room,
            {"type": "tournament_updated", "tournament_id": tournament_id},
        )
        if tournament_complete:
            await manager.broadcast(
                tournament_room,
                {"type": "tournament_complete", "tournament_id": tournament_id},
            )
    else:
        regular_payload = await _finalize_regular_match_timeout(
            game_id=game_id,
            player1_id=player1_id,
            player2_id=player2_id,
            ready_set=ready_set,
        )
        payload.update(regular_payload)

    await manager.broadcast(game_id, payload)
    await manager.broadcast(
        game_id,
        {
            "type": "game_cancelled",
            "room_id": game_id,
            "reason": "ready_timeout",
            "winner_id": payload.get("winner_id"),
            "timeout_seconds": READY_TIMEOUT_SECONDS,
            "tournament_id": payload.get("tournament_id"),
        },
    )

    _setup_sessions.pop(game_id, None)
    _cleanup_waiting_room(game_id)
    _waiting_room_timeout_tasks.pop(game_id, None)


def _schedule_waiting_room_timeout(game_id: str) -> None:
    if _is_waiting_room_timeout_resolved(game_id):
        _cancel_waiting_room_timeout(game_id)
        return

    players = _ensure_waiting_room_players(game_id)
    if players is None:
        return

    existing = _waiting_room_timeout_tasks.get(game_id)
    if existing is not None and not existing.done():
        return

    _waiting_room_timeout_deadline[game_id] = time.time() + READY_TIMEOUT_SECONDS

    _waiting_room_timeout_tasks[game_id] = asyncio.create_task(
        _handle_waiting_room_timeout(game_id)
    )


async def _handle_tournament_ready_timeout(
    tournament_id: int,
    tournament_match_id: int,
) -> None:
    ready_key = (tournament_id, tournament_match_id)
    try:
        await asyncio.sleep(READY_TIMEOUT_SECONDS)
    except asyncio.CancelledError:
        return

    ready_set = set(_tournament_ready.get(ready_key, set()))
    timeout_winner: int | None = None
    match_row = None

    try:
        async with AsyncSessionLocal() as db:
            tournament_data = await get_tournament_with_participants(db, tournament_id)
            if tournament_data is None:
                _remove_tournament_ready_state(ready_key)
                _tournament_ready_timeout_tasks.pop(ready_key, None)
                return

            _, _, matches = tournament_data
            match_row = next((m for m in matches if int(m.id) == tournament_match_id), None)
            if match_row is None or match_row.status != "in_progress":
                _remove_tournament_ready_state(ready_key)
                _tournament_ready_timeout_tasks.pop(ready_key, None)
                return

            players = {match_row.player1_id, match_row.player2_id}
            valid_ready_players = {pid for pid in ready_set if pid in players}
            if len(valid_ready_players) == 1:
                timeout_winner = next(iter(valid_ready_players))

            try:
                _, tournament_complete, _ = await record_tournament_match_timeout_result(
                    db=db,
                    tournament_id=tournament_id,
                    tournament_match_id=tournament_match_id,
                    winner_id=timeout_winner,
                )
            except Exception:
                await db.rollback()
                tournament_complete = False

            refreshed = await get_tournament_with_participants(db, tournament_id)
            refreshed_matches = refreshed[2] if refreshed is not None else []
    except SQLAlchemyError:
        _remove_tournament_ready_state(ready_key)
        _tournament_ready_timeout_tasks.pop(ready_key, None)
        return

    sync_tournament_ready_timeouts(tournament_id, refreshed_matches)

    room_id = f"tournament_{tournament_id}"
    await manager.broadcast(
        room_id,
        {
            "type": "match_ready_timeout",
            "tournament_id": tournament_id,
            "match_id": tournament_match_id,
            "winner_id": timeout_winner,
            "timeout_seconds": READY_TIMEOUT_SECONDS,
        },
    )
    await manager.broadcast(
        room_id,
        {"type": "tournament_updated", "tournament_id": tournament_id},
    )
    if tournament_complete:
        await manager.broadcast(
            room_id,
            {"type": "tournament_complete", "tournament_id": tournament_id},
        )

    _remove_tournament_ready_state(ready_key)
    _tournament_ready_timeout_tasks.pop(ready_key, None)


def _schedule_tournament_ready_timeout(tournament_id: int, tournament_match_id: int) -> None:
    ready_key = (tournament_id, tournament_match_id)
    existing = _tournament_ready_timeout_tasks.get(ready_key)
    if existing is not None and not existing.done():
        return

    _tournament_ready_timeout_tasks[ready_key] = asyncio.create_task(
        _handle_tournament_ready_timeout(
            tournament_id=tournament_id,
            tournament_match_id=tournament_match_id,
        ),
    )


def sync_tournament_ready_timeouts(tournament_id: int, matches: list) -> None:
    active_keys: set[tuple[int, int]] = set()
    for match in matches:
        if getattr(match, "status", None) != "in_progress":
            continue
        match_id = getattr(match, "id", None)
        if match_id is None:
            continue
        key = (tournament_id, int(match_id))
        active_keys.add(key)
        _schedule_tournament_ready_timeout(tournament_id, int(match_id))

    for key in list(_tournament_ready_timeout_tasks.keys()):
        if key[0] != tournament_id:
            continue
        if key in active_keys:
            continue
        _cancel_tournament_ready_timeout(key)
        _remove_tournament_ready_state(key)


def _cleanup_waiting_room(game_id: str) -> None:
    _cancel_waiting_room_timeout(game_id)
    _waiting_room_ready.pop(game_id, None)
    _waiting_room_players.pop(game_id, None)
    _waiting_room_tournament_context.pop(game_id, None)


async def _ensure_game_session(
    game_id: str,
    player1_id: int,
    player2_id: int,
    existing_match_id: int | None = None,
) -> None:
    _setup_sessions[game_id] = (player1_id, player2_id)

    if existing_match_id is not None and game_id not in _match_ids:
        _match_ids[game_id] = existing_match_id

    if game_manager.get_session(game_id):
        return

    try:
        await game_manager.create_session(
            game_id,
            player1_id,
            player2_id,
            broadcast_callback=_broadcast_state,
            on_game_over_callback=_on_game_over,
        )
        ws_logger.session_state(
            game_id,
            {
                "p1_id": player1_id,
                "p2_id": player2_id,
                "status": "session_created",
            },
        )
    except ValueError:
        return

    if existing_match_id is not None:
        return

    try:
        async with AsyncSessionLocal() as db:
            match = await create_match(db, player1_id, player2_id)
            _match_ids[game_id] = match.id
    except SQLAlchemyError:
        pass  # best-effort


def _infer_waiting_room_players(
    game_id: str,
    payload: dict,
    ready_set: set[int],
) -> tuple[int | None, int | None]:
    stored_players = _waiting_room_players.get(game_id) or _setup_sessions.get(game_id)
    if stored_players is not None:
        return stored_players

    player1_id = payload.get("player1_id")
    player2_id = payload.get("player2_id")
    if isinstance(player1_id, int) and isinstance(player2_id, int):
        _waiting_room_players[game_id] = (player1_id, player2_id)
        return player1_id, player2_id

    if len(ready_set) == 2:
        inferred = tuple(sorted(ready_set))
        _waiting_room_players[game_id] = inferred
        return inferred

    return None, None


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
        # Cancel any in-flight disconnect countdown and await its completion so the
        # countdown coroutine fully exits before we proceed with cleanup.
        # Guard: _on_game_over may be called *from* the countdown task itself
        # (via _disconnect_countdown → _on_game_over), so skip cancel/await when
        # _disc_timer is the current task to avoid a circular await deadlock.
        _disc_timer = _disconnect_timers.pop(game_id, None)
        if _disc_timer and not _disc_timer.done() and _disc_timer is not asyncio.current_task():
            _disc_timer.cancel()
            try:
                await asyncio.shield(_disc_timer)
            except (asyncio.CancelledError, Exception):
                pass
        _disconnected_players.pop(game_id, None)

        # Clean up memory
        await game_manager.delete_session(game_id)
        _setup_sessions.pop(game_id, None)
        _match_ids.pop(game_id, None)
        _cleanup_waiting_room(game_id)

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
        for seconds_left in range(DISCONNECT_GRACE_SECONDS, 0, -1):
            await manager.broadcast(game_id, {
                "type": "opponent_disconnected",
                "seconds_left": seconds_left,
            })
            await asyncio.sleep(1.0)

        # Timeout expired: award forfeit win to the still-connected player.
        # Guard against the race where both players disconnect near the end of the
        # countdown — active_connections(game_id) == 0 means nobody is present.
        session = game_manager.get_session(game_id)
        if session and session.is_active and manager.active_connections(game_id) > 0:
            try:
                await _on_game_over(game_id, winner_id, session.score.p1, session.score.p2)
            except Exception:
                import logging
                logging.getLogger(__name__).exception(
                    "[DISCONNECT_COUNTDOWN] _on_game_over failed for %s", game_id
                )
    except asyncio.CancelledError:
        pass  # Reconnect cancelled the timer — normal path, do nothing
    finally:
        # Clean up whether we timed out, were cancelled, or errored.
        # The reconnect path in game_websocket may have already popped these keys —
        # .pop(..., None) is idempotent so double-pop is safe. This finally block
        # must not do anything beyond these two pops to avoid undoing reconnect state.
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
        is_authorized = is_local or (
            healthcheck_token == settings.HEALTHCHECK_TOKEN
            if hasattr(settings, "HEALTHCHECK_TOKEN")
            else False
        )
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
    _ensure_waiting_room_players(game_id)
    _schedule_waiting_room_timeout(game_id)

    waiting_players = _ensure_waiting_room_players(game_id)
    status_payload: dict = {
        "type": "waiting_room_status",
        "room_id": game_id,
        "ready_users": list(_waiting_room_ready.get(game_id, set())),
        "timeout_seconds": READY_TIMEOUT_SECONDS,
        "timeout_deadline": _waiting_room_timeout_deadline.get(game_id),
        "match_id": _match_ids.get(game_id),
    }
    if waiting_players is not None:
        status_payload["player1_id"] = waiting_players[0]
        status_payload["player2_id"] = waiting_players[1]

    await websocket.send_json(status_payload)
    
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

    # Reconnect detection: player rejoining during the disconnect grace window
    if game_id in _disconnected_players and _disconnected_players[game_id] == player_id:
        timer = _disconnect_timers.pop(game_id, None)
        if timer and not timer.done():
            timer.cancel()
            try:
                await asyncio.shield(timer)
            except (asyncio.CancelledError, Exception):
                pass
        _disconnected_players.pop(game_id, None)

        game_manager.resume_session(game_id)

        session = game_manager.get_session(game_id)
        if session:
            snapshot = session.get_state_snapshot()
            await websocket.send_json({
                "type": "state",
                **asdict(snapshot),
            })

        # Broadcast to all (including the reconnecting player). Both players
        # benefit: the reconnecting player can show "connection restored" and
        # the surviving player can hide the countdown UI.
        await manager.broadcast(game_id, {"type": "opponent_reconnected"})

        logger.info(
            f"[RECONNECT] Player {player_id} reconnected to {game_id}. "
            "Countdown cancelled, game resumed."
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
                event_user_id = data.get("user_id")
                if event_user_id != player_id:
                    continue

                ready_set = _waiting_room_ready.setdefault(game_id, set())
                ready_set.add(player_id)

                player1_id, player2_id = _infer_waiting_room_players(game_id, data, ready_set)
                if player1_id is not None and player2_id is not None:
                    _schedule_waiting_room_timeout(game_id)

                ready_payload = {
                    "type": "player_ready",
                    "room_id": game_id,
                    "user_id": player_id,
                }
                if player1_id is not None and player2_id is not None:
                    ready_payload["player1_id"] = player1_id
                    ready_payload["player2_id"] = player2_id

                await manager.broadcast(game_id, ready_payload)
                ws_logger.ready(game_id, player_id, ready_payload)

                both_ready = (
                    player1_id is not None
                    and player2_id is not None
                    and player1_id in ready_set
                    and player2_id in ready_set
                )

                if both_ready:
                    _cancel_waiting_room_timeout(game_id)
                    existing_match_id = data.get("match_id")
                    if not isinstance(existing_match_id, int):
                        existing_match_id = _match_ids.get(game_id)

                    await _ensure_game_session(
                        game_id,
                        player1_id,
                        player2_id,
                        existing_match_id=existing_match_id,
                    )

                    await manager.broadcast(
                        game_id,
                        {
                            "type": "game_start",
                            "room_id": game_id,
                            "player1_id": player1_id,
                            "player2_id": player2_id,
                            "match_id": _match_ids.get(game_id),
                        },
                    )
                    ws_logger.session_state(
                        game_id,
                        {
                            "p1_id": player1_id,
                            "p2_id": player2_id,
                            "status": "both_players_ready",
                        },
                    )

            # Handle player_unready: update ready state and broadcast
            elif event_type == "player_unready":
                event_user_id = data.get("user_id")
                if event_user_id != player_id:
                    continue

                ready_set = _waiting_room_ready.setdefault(game_id, set())
                ready_set.discard(player_id)

                if not ready_set:
                    _waiting_room_ready.pop(game_id, None)

                await manager.broadcast(
                    game_id,
                    {
                        "type": "player_unready",
                        "room_id": game_id,
                        "user_id": player_id,
                    },
                )

            elif event_type == "cancel_waiting_room":
                event_user_id = data.get("user_id")
                if event_user_id != player_id:
                    continue

                _cleanup_waiting_room(game_id)
                await manager.broadcast(
                    game_id,
                    {
                        "type": "cancel_waiting_room",
                        "room_id": game_id,
                        "user_id": player_id,
                    },
                )

            # Handle game_start: initialize game session
            elif event_type == "game_start":
                ws_logger.ready(game_id, player_id, data)

                player1_id = data.get("player1_id")
                player2_id = data.get("player2_id")

                if not isinstance(player1_id, int) or not isinstance(player2_id, int):
                    player1_id, player2_id = _setup_sessions.get(game_id) or _waiting_room_players.get(game_id) or (None, None)

                if not isinstance(player1_id, int) or not isinstance(player2_id, int):
                    continue

                _waiting_room_players[game_id] = (player1_id, player2_id)
                _schedule_waiting_room_timeout(game_id)

                # Verify the authenticated user is part of this game
                if player_id not in (player1_id, player2_id):
                    continue

                existing_match_id = data.get("match_id")
                if not isinstance(existing_match_id, int):
                    existing_match_id = _match_ids.get(game_id)

                await _ensure_game_session(
                    game_id,
                    player1_id,
                    player2_id,
                    existing_match_id=existing_match_id,
                )
                ws_logger.latency(f"game_start_to_session_created_{game_id}", flow_start)

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
        manager.disconnect(game_id, websocket)

        import logging
        logger = logging.getLogger(__name__)
        remaining = manager.active_connections(game_id)
        logger.info(
            f"[CLEANUP] Player {player_id} removed from room {game_id}. "
            f"Remaining: {remaining}"
        )

        if remaining == 0:
            # Last player gone — cancel any pending countdown, then full cleanup
            timer = _disconnect_timers.pop(game_id, None)
            if timer and not timer.done():
                timer.cancel()
                try:
                    await asyncio.shield(timer)
                except (asyncio.CancelledError, Exception):
                    pass
            _disconnected_players.pop(game_id, None)

            # AI forfeit: if the human left an AI game before natural game-over
            session = game_manager.get_session(game_id)
            match_id = _match_ids.get(game_id)
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
                    pass

            # Guard against the race where natural victory fires _on_game_over
            # via create_task while both players are simultaneously disconnecting.
            # If the session is already inactive, _on_game_over owns the DB write
            # and cleanup — skip here to avoid clearing _match_ids before it runs.
            if session is None or session.is_active:
                await game_manager.delete_session(game_id)
                _setup_sessions.pop(game_id, None)
                _match_ids.pop(game_id, None)
                _cleanup_waiting_room(game_id)

        else:
            # One player still connected — pause and start countdown for remote games only
            session = game_manager.get_session(game_id)
            if session and session.is_active and session.player2_id != AI_PLAYER_ID:
                setup = _setup_sessions.get(game_id)
                if setup:
                    p1, p2 = setup
                    if player_id not in (p1, p2):
                        pass  # intruder — not a game participant, skip countdown
                    else:
                        winner_id = p2 if player_id == p1 else p1
                        game_manager.pause_session(game_id)
                        _disconnected_players[game_id] = player_id
                        timer = asyncio.create_task(
                            _disconnect_countdown(game_id, winner_id)
                        )
                        _disconnect_timers[game_id] = timer
                        logger.info(
                            f"[DISCONNECT] Player {player_id} left {game_id}. "
                            f"{DISCONNECT_GRACE_SECONDS}s countdown started. Forfeit winner if timeout: {winner_id}"
                        )


def _clear_tournament_ready_for_user(tournament_id: int, user_id: int) -> list[int]:
    affected_match_ids: set[int] = set()
    empty_keys: list[tuple[int, int]] = []

    for key, ready_set in list(_tournament_ready.items()):
        if key[0] != tournament_id:
            continue

        if user_id not in ready_set:
            continue

        ready_set.discard(user_id)
        affected_match_ids.add(key[1])
        if not ready_set:
            empty_keys.append(key)

    for key in empty_keys:
        _tournament_ready.pop(key, None)
        _tournament_waiting_rooms.pop(key, None)

    return list(affected_match_ids)


@router.websocket("/ws/tournament/{tournament_id}")
async def tournament_websocket(
    websocket: WebSocket,
    tournament_id: int,
    token: str | None = None,
) -> None:
    current_matches = []

    if not token:
        await websocket.close(code=4001)
        return

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
        credential_id = payload.get("credential_id")
        if credential_id is None:
            await websocket.close(code=4001)
            return

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                text("SELECT id FROM users WHERE credential_id = :cid"),
                {"cid": credential_id},
            )
            row = result.fetchone()
            if not row:
                await websocket.close(code=4001)
                return

            player_id = row[0]

            tournament_data = await get_tournament_with_participants(db, tournament_id)
            if tournament_data is None:
                await websocket.close(code=4004)
                return

            _, participants, current_matches = tournament_data
            participant_ids = {p.user_id for p in participants}
            if player_id not in participant_ids:
                await websocket.close(code=4003)
                return

    except Exception:
        await websocket.close(code=4001)
        return

    room_id = f"tournament_{tournament_id}"
    await manager.connect(room_id, websocket)
    sync_tournament_ready_timeouts(tournament_id, current_matches)

    try:
        await websocket.send_json(
            {
                "type": "tournament_connected",
                "tournament_id": tournament_id,
                "user_id": player_id,
            },
        )

        while True:
            data = await websocket.receive_json()
            if not isinstance(data, dict):
                continue

            event_type = data.get("type")
            match_id = data.get("match_id")

            if event_type == "ready" and isinstance(match_id, int):
                async with AsyncSessionLocal() as db:
                    tournament_data = await get_tournament_with_participants(db, tournament_id)
                    if tournament_data is None:
                        continue

                    _, _, matches = tournament_data
                    tournament_match = next(
                        (m for m in matches if int(m.id) == int(match_id)),
                        None,
                    )

                if tournament_match is None:
                    continue

                if tournament_match.status != "in_progress" or tournament_match.match_id is None:
                    continue

                if player_id not in (tournament_match.player1_id, tournament_match.player2_id):
                    continue

                ready_key = (tournament_id, int(tournament_match.id))
                _schedule_tournament_ready_timeout(tournament_id, int(tournament_match.id))
                ready_set = _tournament_ready.setdefault(ready_key, set())
                ready_set.add(player_id)

                await manager.broadcast(
                    room_id,
                    {
                        "type": "match_player_ready",
                        "tournament_id": tournament_id,
                        "match_id": int(tournament_match.id),
                        "user_id": player_id,
                    },
                )

                both_ready = (
                    tournament_match.player1_id in ready_set
                    and tournament_match.player2_id in ready_set
                )

                if both_ready:
                    game_room_id = _tournament_waiting_rooms.get(ready_key)
                    if not game_room_id:
                        game_room_id = f"tournament-{tournament_id}-match-{tournament_match.match_id}"
                        _tournament_waiting_rooms[ready_key] = game_room_id

                    _cancel_tournament_ready_timeout(ready_key)
                    _remove_tournament_ready_state(ready_key)

                    _waiting_room_players[game_room_id] = (
                        int(tournament_match.player1_id),
                        int(tournament_match.player2_id),
                    )
                    _match_ids[game_room_id] = int(tournament_match.match_id)
                    _waiting_room_tournament_context[game_room_id] = (
                        tournament_id,
                        int(tournament_match.match_id),
                        int(tournament_match.id),
                    )
                    _schedule_waiting_room_timeout(game_room_id)

                    await manager.broadcast(
                        room_id,
                        {
                            "type": "match_start",
                            "tournament_id": tournament_id,
                            "tournament_match_id": int(tournament_match.id),
                            "match_id": int(tournament_match.match_id),
                            "game_room_id": game_room_id,
                            "player1_id": int(tournament_match.player1_id),
                            "player2_id": int(tournament_match.player2_id),
                        },
                    )

            elif event_type == "unready" and isinstance(match_id, int):
                ready_key = (tournament_id, int(match_id))
                ready_set = _tournament_ready.setdefault(ready_key, set())
                ready_set.discard(player_id)

                if not ready_set:
                    _tournament_ready.pop(ready_key, None)
                    _tournament_waiting_rooms.pop(ready_key, None)

                await manager.broadcast(
                    room_id,
                    {
                        "type": "match_player_unready",
                        "tournament_id": tournament_id,
                        "match_id": int(match_id),
                        "user_id": player_id,
                    },
                )

    except WebSocketDisconnect:
        pass

    finally:
        cleared_match_ids = _clear_tournament_ready_for_user(tournament_id, player_id)
        for match_id in cleared_match_ids:
            await manager.broadcast(
                room_id,
                {
                    "type": "match_player_unready",
                    "tournament_id": tournament_id,
                    "match_id": int(match_id),
                    "user_id": player_id,
                },
            )
        manager.disconnect(room_id, websocket)

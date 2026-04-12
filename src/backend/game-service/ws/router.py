# Note: sys.path is set by main.py (Docker) or test file (host) — not repeated here.
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import jwt
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from shared.config.settings import settings
from shared.ws.manager import ConnectionManager
from shared.database import AsyncSessionLocal
from service.persistence import create_match, finish_match, get_tournament_with_participants
from service.game_manager import game_manager

router = APIRouter()
manager = ConnectionManager()

# Maps game_id (str) → (player1_id, player2_id) for sessions being set up
_setup_sessions: dict[str, tuple[int, int]] = {}
# Maps game_id (str) → match_id (int) for database updates
_match_ids: dict[str, int] = {}

_waiting_room_ready: dict[str, set[int]] = {}
_waiting_room_players: dict[str, tuple[int, int]] = {}
_tournament_ready: dict[tuple[int, int], set[int]] = {}
_tournament_waiting_rooms: dict[tuple[int, int], str] = {}


async def _broadcast_state(game_id: str, state_snapshot: dict) -> None:
    """Broadcast game state to both clients in a session.

    Args:
        game_id: Unique game identifier
        state_snapshot: GameStateSnapshot serialized to dict with:
                       {ball: {...}, paddles: {...}, score: {...}}
    """
    msg = {
        "type": "state",
        **state_snapshot,  # Flatten snapshot: ball, paddles, score at top level
    }
    await manager.broadcast(game_id, msg)


def _cleanup_waiting_room(game_id: str) -> None:
    _waiting_room_ready.pop(game_id, None)
    _waiting_room_players.pop(game_id, None)


async def _ensure_game_session(
    game_id: str,
    player1_id: int,
    player2_id: int,
    existing_match_id: int | None = None,
) -> None:
    _setup_sessions[game_id] = (player1_id, player2_id)

    if game_manager.get_session(game_id):
        if existing_match_id is not None and game_id not in _match_ids:
            _match_ids[game_id] = existing_match_id
        return

    try:
        await game_manager.create_session(
            game_id,
            player1_id,
            player2_id,
            broadcast_callback=_broadcast_state,
            on_game_over_callback=_on_game_over,
        )

        if existing_match_id is not None:
            _match_ids[game_id] = existing_match_id
            return

        async with AsyncSessionLocal() as db:
            match = await create_match(db, player1_id, player2_id)
            _match_ids[game_id] = match.id

    except ValueError:
        # Session already exists
        if existing_match_id is not None and game_id not in _match_ids:
            _match_ids[game_id] = existing_match_id


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
                    score_p2,
                )
    except SQLAlchemyError:
        pass  # best-effort
    finally:
        # Clean up memory
        await game_manager.delete_session(game_id)
        _setup_sessions.pop(game_id, None)
        _match_ids.pop(game_id, None)
        _cleanup_waiting_room(game_id)

        # Broadcast the game over event authoritatively
        await manager.broadcast(
            game_id,
            {
                "type": "game_over",
                "winner_id": winner_id,
                "score_p1": score_p1,
                "score_p2": score_p2,
            },
        )


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
        # Accept connections from localhost, Docker internal network (172.x.x.x), and healthcheck_token
        client_host = websocket.client.host if websocket.client else ""
        healthcheck_token = token  # Reuse token param for healthcheck auth
        is_local = client_host in ("127.0.0.1", "localhost", "::1") or client_host.startswith("172.")
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
                {"cid": credential_id},
            )
            row = result.fetchone()
            if not row:
                await websocket.close(code=4001)
                return
            player_id = row[0]
    except Exception:
        await websocket.close(code=4001)
        return

    await manager.connect(game_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()

            if not isinstance(data, dict):
                continue

            event_type = data.get("type")

            if event_type == "player_ready":
                event_user_id = data.get("user_id")
                player1_id = data.get("player1_id")
                player2_id = data.get("player2_id")
                existing_match_id = data.get("match_id")

                if event_user_id != player_id:
                    continue

                if not isinstance(player1_id, int) or not isinstance(player2_id, int):
                    continue

                if player_id not in (player1_id, player2_id):
                    continue

                if not isinstance(existing_match_id, int):
                    existing_match_id = None

                stored_players = _waiting_room_players.get(game_id)
                if stored_players is None:
                    _waiting_room_players[game_id] = (player1_id, player2_id)
                else:
                    player1_id, player2_id = stored_players

                ready_set = _waiting_room_ready.setdefault(game_id, set())
                ready_set.add(player_id)

                await manager.broadcast(
                    game_id,
                    {
                        "type": "player_ready",
                        "room_id": game_id,
                        "user_id": player_id,
                        "player1_id": player1_id,
                        "player2_id": player2_id,
                    },
                )

                if len(ready_set) == 2:
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

            elif event_type == "game_start":
                player1_id = data.get("player1_id")
                player2_id = data.get("player2_id")
                existing_match_id = data.get("match_id")

                if not isinstance(player1_id, int) or not isinstance(player2_id, int):
                    continue

                if player_id not in (player1_id, player2_id):
                    continue

                if not isinstance(existing_match_id, int):
                    existing_match_id = None

                await _ensure_game_session(
                    game_id,
                    player1_id,
                    player2_id,
                    existing_match_id=existing_match_id,
                )

            elif event_type == "input":
                session = game_manager.get_session(game_id)
                if session:
                    await game_manager.handle_player_input(game_id, player_id, data)

            else:
                await manager.broadcast(game_id, data)

    except WebSocketDisconnect:
        pass

    finally:
        manager.disconnect(game_id, websocket)

        if manager.active_connections(game_id) == 0:
            _cleanup_waiting_room(game_id)

            if not game_manager.get_session(game_id):
                _setup_sessions.pop(game_id, None)
                _match_ids.pop(game_id, None)


def _clear_tournament_ready_for_user(tournament_id: int, user_id: int) -> None:
    empty_keys: list[tuple[int, int]] = []

    for key, ready_set in _tournament_ready.items():
        if key[0] != tournament_id:
            continue

        ready_set.discard(user_id)
        if not ready_set:
            empty_keys.append(key)

    for key in empty_keys:
        _tournament_ready.pop(key, None)
        _tournament_waiting_rooms.pop(key, None)


@router.websocket("/ws/tournament/{tournament_id}")
async def tournament_websocket(
    websocket: WebSocket,
    tournament_id: int,
    token: str | None = None,
) -> None:
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

            _, participants, _ = tournament_data
            participant_ids = {p.user_id for p in participants}

            if player_id not in participant_ids:
                await websocket.close(code=4003)
                return

    except Exception:
        await websocket.close(code=4001)
        return

    room_id = f"tournament_{tournament_id}"
    await manager.connect(room_id, websocket)

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

                if tournament_match.status != "in_progress":
                    continue

                if tournament_match.match_id is None:
                    continue

                if player_id not in (
                    tournament_match.player1_id,
                    tournament_match.player2_id,
                ):
                    continue

                ready_key = (tournament_id, int(tournament_match.id))
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
                        game_room_id = (
                            f"tournament-{tournament_id}-match-{tournament_match.match_id}"
                        )
                        _tournament_waiting_rooms[ready_key] = game_room_id

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
        _clear_tournament_ready_for_user(tournament_id, player_id)
        manager.disconnect(room_id, websocket)
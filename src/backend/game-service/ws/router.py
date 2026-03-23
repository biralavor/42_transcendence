# Note: sys.path is set by main.py (Docker) or test file (host) — not repeated here.
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
#from sqlalchemy.exc import SQLAlchemyError
from shared.ws.manager import ConnectionManager
#from shared.database import AsyncSessionLocal
#from service.persistence import create_match, finish_match

router = APIRouter()
manager = ConnectionManager()

# Maps game_id (str) → match DB id (int) for active games.
#_active_matches: dict[str, int] = {}


@router.websocket("/ws/game/{game_id}")
async def game_websocket(websocket: WebSocket, game_id: str) -> None:
    await manager.connect(game_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            # event_type = data.get("type") if isinstance(data, dict) else None

            # if event_type == "game_start":
            #     p1 = data.get("player1_id")
            #     p2 = data.get("player2_id")
            #     if isinstance(p1, int) and isinstance(p2, int):
            #         try:
            #             async with AsyncSessionLocal() as db:
            #                 match = await create_match(db, p1, p2)
            #                 _active_matches[game_id] = match.id
            #         except SQLAlchemyError:
            #             pass  # best-effort — broadcast continues regardless

            # elif event_type == "game_end":
            #     match_id = _active_matches.get(game_id)
            #     winner_id = data.get("winner_id")
            #     score_p1 = data.get("score_p1", 0)
            #     score_p2 = data.get("score_p2", 0)
            #     if match_id is not None and isinstance(winner_id, int):
            #         try:
            #             async with AsyncSessionLocal() as db:
            #                 await finish_match(db, match_id, winner_id, score_p1, score_p2)
            #         except SQLAlchemyError:
            #             pass  # best-effort
            #         finally:
            #             _active_matches.pop(game_id, None)

            await manager.broadcast(game_id, data)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(game_id, websocket)

# Note: sys.path is set by main.py (Docker) or test file (host) — not repeated here.
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from shared.ws.manager import ConnectionManager

router = APIRouter()
manager = ConnectionManager()


@router.websocket("/ws/game/{game_id}")
async def game_websocket(websocket: WebSocket, game_id: str) -> None:
    await manager.connect(game_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(game_id, data)
    except WebSocketDisconnect:
        manager.disconnect(game_id, websocket)

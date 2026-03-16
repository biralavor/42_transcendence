# Note: sys.path is set by main.py (Docker) or test file (host) — not repeated here.
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from shared.ws.manager import ConnectionManager
from shared.database import AsyncSessionLocal
from service.persistence import get_or_create_room, save_message, get_room_history

router = APIRouter()
manager = ConnectionManager()


@router.websocket("/ws/chat/{room_slug}")
async def chat_websocket(websocket: WebSocket, room_slug: str) -> None:
    await manager.connect(room_slug, websocket)
    async with AsyncSessionLocal() as db:
        room = await get_or_create_room(db, room_slug)
        history = await get_room_history(db, room.id)
        for msg in history:
            await websocket.send_json({"content": msg.content, "sender": msg.sender_name})
        try:
            while True:
                data = await websocket.receive_json()
                await save_message(db, room.id, data["sender"], data["content"])
                await manager.broadcast(room_slug, data)
        except WebSocketDisconnect:
            pass
        finally:
            manager.disconnect(room_slug, websocket)

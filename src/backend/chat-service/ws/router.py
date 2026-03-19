# Note: sys.path is set by main.py (Docker) or test file (host) — not repeated here.
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.exc import SQLAlchemyError
from shared.ws.manager import ConnectionManager
from shared.database import AsyncSessionLocal
from service.persistence import get_or_create_room, save_message, get_room_history

router = APIRouter()
manager = ConnectionManager()

SENDER_MAX_LEN = 50


def _validate(data: object) -> str | None:
    """Return an error string if data is invalid, else None."""
    if not isinstance(data, dict):
        return "expected a JSON object"
    if not isinstance(data.get("sender"), str) or not isinstance(data.get("content"), str):
        return "missing or non-string 'sender' / 'content'"
    if len(data["sender"]) > SENDER_MAX_LEN:
        return f"'sender' exceeds {SENDER_MAX_LEN} characters"
    if not data["content"].strip():
        return "'content' must not be empty"
    return None


@router.websocket("/ws/chat/{room_slug}")
async def chat_websocket(websocket: WebSocket, room_slug: str) -> None:
    await manager.connect(room_slug, websocket)
    try:
        async with AsyncSessionLocal() as db:
            room = await get_or_create_room(db, room_slug)
            history = await get_room_history(db, room.id)
            for msg in history:
                await websocket.send_json({"content": msg.content, "sender": msg.sender_name})
            while True:
                data = await websocket.receive_json()
                error = _validate(data)
                if error:
                    await websocket.send_json({"error": error})
                    continue
                try:
                    await save_message(db, room.id, data["sender"], data["content"])
                except SQLAlchemyError:
                    await websocket.send_json({"error": "failed to save message"})
                    continue
                await manager.broadcast(room_slug, data)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(room_slug, websocket)

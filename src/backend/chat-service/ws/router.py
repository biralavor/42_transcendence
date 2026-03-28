# Note: sys.path is set by main.py (Docker) or test file (host) — not repeated here.
import re
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.exc import SQLAlchemyError
from shared.ws.manager import ConnectionManager
from shared.database import AsyncSessionLocal
from service.persistence import get_or_create_room, save_message, get_room_history, is_blocked

router = APIRouter()
manager = ConnectionManager()

SENDER_MAX_LEN = 50
_DM_RE = re.compile(r"^DM-(\d+)-(\d+)$")


def _parse_dm_participants(room_slug: str) -> tuple[int, int] | None:
    """Return (lo_id, hi_id) if room_slug is a DM room, else None."""
    match = _DM_RE.match(room_slug)
    if match is None:
        return None
    return int(match.group(1)), int(match.group(2))


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


async def _sender_is_blocked(
    dm_participants: tuple[int, int] | None,
    sender_uid: int | None,
) -> bool:
    """Return True if the recipient has blocked the sender in a DM room.

    Only applies when the room is a DM (dm_participants is not None) and the
    sender included their user_id in the message payload. Returns False for
    public/group rooms and for messages without a user_id field.
    """
    if dm_participants is None or not isinstance(sender_uid, int):
        return False
    lo, hi = dm_participants
    if sender_uid not in (lo, hi):
        return True  # not a participant — treat as blocked / drop silently
    recipient_uid = hi if sender_uid == lo else lo
    async with AsyncSessionLocal() as check_db:
        return await is_blocked(check_db, blocker_id=recipient_uid, blocked_id=sender_uid)


@router.websocket("/ws/chat/{room_slug}")
async def chat_websocket(websocket: WebSocket, room_slug: str) -> None:
    dm_participants = _parse_dm_participants(room_slug)
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

                if await _sender_is_blocked(dm_participants, data.get("user_id")):
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

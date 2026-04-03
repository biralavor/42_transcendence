# Note: sys.path is set by main.py (Docker) or test file (host) — not repeated here.
import re
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import jwt
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from shared.ws.manager import ConnectionManager
from shared.database import AsyncSessionLocal
from shared.config.settings import settings
from service.persistence import get_or_create_room, save_message, get_room_history, is_blocked

router = APIRouter()
manager = ConnectionManager()
# Per-user notification connections, keyed by str(uid)
notifications_manager = ConnectionManager()

_ALGORITHM = "HS256"
SENDER_MAX_LEN = 50
_DM_RE = re.compile(r"^DM-(\d+)-(\d+)$")


def _uid_from_token(token: str) -> int | None:
    """Decode JWT and return the credential_id claim, or None if invalid/missing."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[_ALGORITHM])
        credential_id = payload.get("credential_id")
        return int(credential_id) if credential_id is not None else None
    except Exception:
        return None


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
    db: AsyncSession,
) -> bool:
    """Return True if the recipient has blocked the sender in a DM room.

    Only applies when the room is a DM (dm_participants is not None) and
    sender_uid is the connection-bound identity decoded from the JWT at connect
    time. Returns False for public/group rooms.
    """
    if dm_participants is None or not isinstance(sender_uid, int):
        return False
    lo, hi = dm_participants
    if sender_uid not in (lo, hi):
        return True  # not a participant — treat as blocked / drop silently
    recipient_uid = hi if sender_uid == lo else lo
    return await is_blocked(db, blocker_id=recipient_uid, blocked_id=sender_uid)


@router.websocket("/ws/chat/{room_slug}")
async def chat_websocket(websocket: WebSocket, room_slug: str, token: str = "") -> None:
    dm_participants = _parse_dm_participants(room_slug)

    # DM rooms require a verified identity — decode once at connect, bind for the session
    sender_uid: int | None = None
    sender_username: str | None = None
    if dm_participants is not None:
        credential_id = _uid_from_token(token)
        if credential_id is None:
            await websocket.close(code=4001)
            return
        
        # Look up the actual user.id and username from credential_id
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                text("SELECT id, username FROM users WHERE credential_id = :cid"),
                {"cid": credential_id},
            )
            row = result.first()
            if row:
                sender_uid = row[0]
                sender_username = row[1]
            else:
                sender_uid = None
        
        if sender_uid is None:
            await websocket.close(code=4001)
            return
        if sender_uid not in dm_participants:
            await websocket.close(code=4003)
            return

    await manager.connect(room_slug, websocket)
    try:
        async with AsyncSessionLocal() as db:
            room = await get_or_create_room(db, room_slug)
            history = await get_room_history(db, room.id)
            for msg in history:
                await websocket.send_json({"content": msg.content, "sender": msg.sender_name})

            while True:
                data = await websocket.receive_json()

                # Typing event — broadcast only, never persisted
                if isinstance(data, dict) and data.get("type") == "typing":
                    sender = data.get("sender")
                    # For DMs, use verified sender_username; for public rooms, trust client
                    typing_sender = sender_username if dm_participants is not None else sender
                    if isinstance(typing_sender, str) and 0 < len(typing_sender) <= SENDER_MAX_LEN:
                        if not await _sender_is_blocked(dm_participants, sender_uid, db):
                            await manager.broadcast(
                                room_slug,
                                {"type": "typing", "sender": typing_sender, "sender_uid": sender_uid},
                            )
                    continue

                error = _validate(data)
                if error:
                    await websocket.send_json({"error": error})
                    continue

                if await _sender_is_blocked(dm_participants, sender_uid, db):
                    continue

                # For DMs, use verified sender_username; for public rooms, trust client sender
                message_sender = sender_username if dm_participants is not None else data["sender"]
                
                try:
                    await save_message(db, room.id, message_sender, data["content"])
                except SQLAlchemyError:
                    await websocket.send_json({"error": "failed to save message"})
                    continue

                # For DMs, broadcast with verified sender; for public rooms, use client data
                if dm_participants is not None:
                    broadcast_data = {
                        "content": data["content"],
                        "sender": message_sender,
                    }
                else:
                    broadcast_data = data
                
                await manager.broadcast(room_slug, broadcast_data)

                # Notify the DM recipient if they have a notifications socket open
                if dm_participants is not None and isinstance(sender_uid, int):
                    lo, hi = dm_participants
                    recipient_uid = hi if sender_uid == lo else lo
                    await notifications_manager.broadcast(str(recipient_uid), {
                        "type": "new_dm",
                        "from_user_id": sender_uid,
                        "room_slug": room_slug,
                        "preview": data["content"][:80],
                    })
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(room_slug, websocket)


@router.websocket("/ws/notifications")
async def notifications_websocket(websocket: WebSocket, token: str = "") -> None:
    credential_id = _uid_from_token(token)
    if credential_id is None:
        await websocket.accept()
        await websocket.close(code=4001)
        return

    # Look up the actual user.id from credential_id
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text("SELECT id FROM users WHERE credential_id = :cid"),
            {"cid": credential_id},
        )
        row = result.first()
        uid = row[0] if row else None
    
    if uid is None:
        await websocket.accept()
        await websocket.close(code=4001)
        return

    user_key = str(uid)
    await notifications_manager.connect(user_key, websocket)
    try:
        while True:
            # Keep-alive: discard any client messages; server only pushes
            msg = await websocket.receive()
            if msg.get("type") == "websocket.disconnect":
                break
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        notifications_manager.disconnect(user_key, websocket)

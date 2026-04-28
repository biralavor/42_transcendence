# Note: sys.path is set by main.py (Docker) or test file (host) — not repeated here.
import re
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import jwt
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from shared.ws.manager import ConnectionManager
from shared.database import AsyncSessionLocal
from shared.config.settings import settings
from service.persistence import get_or_create_room, save_message, get_room_history, is_blocked
from service.ws.event_registry import chat_notification_event_registry

router = APIRouter()
manager = ConnectionManager()
# Per-user notification connections, keyed by str(uid)
# Inject chat_notification_event_registry signal callback (dependency injection pattern)
notifications_manager = ConnectionManager(signal_callback=chat_notification_event_registry.signal_event)

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
    # Healthcheck endpoint: restricted, one-shot, no relay
    if room_slug == "healthcheck":
        # Restrict to localhost or internal Docker network for health checks
        # Accept connections from localhost, Docker internal network (172.x.x.x), and healthcheck_token
        client_host = websocket.client.host if websocket.client else ""
        is_local = client_host in ("127.0.0.1", "localhost", "::1") or client_host.startswith("172.")
        is_authorized = is_local or (token == settings.HEALTHCHECK_TOKEN if hasattr(settings, 'HEALTHCHECK_TOKEN') else False)
        
        if not is_authorized:
            await websocket.close(code=4003, reason="Healthcheck access denied")
            return
        
        try:
            await websocket.accept()
            # Send one "ok" response and close — don't accept client messages
            await websocket.send_json({"type": "healthcheck", "status": "ok"})
        except Exception:
            pass
        finally:
            try:
                await websocket.close()
            except Exception:
                pass
        return

    dm_participants = _parse_dm_participants(room_slug)

    # Best-effort identity resolution: decode token at connect time for ALL room
    # types so persisted messages can carry users.id (drives the per-user activity
    # dashboard). DM rooms still enforce that resolution succeeded; public rooms
    # tolerate anonymous senders by leaving sender_uid as None.
    sender_uid: int | None = None
    sender_username: str | None = None
    if token:
        credential_id = _uid_from_token(token)
        if credential_id is not None:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    text("SELECT id, username FROM users WHERE credential_id = :cid"),
                    {"cid": credential_id},
                )
                row = result.first()
                if row:
                    sender_uid = row[0]
                    sender_username = row[1]

    if dm_participants is not None:
        if sender_uid is None:
            await websocket.close(code=4001)
            return
        if sender_uid not in dm_participants:
            await websocket.close(code=4003)
            return

    await manager.connect(room_slug, websocket)
    
    # Get room info and history once on connect (outside loop)
    try:
        async with AsyncSessionLocal() as db:
            room = await get_or_create_room(db, room_slug)
            history = await get_room_history(db, room.id)
            room_id = room.id
    except Exception:
        await websocket.close(code=4002)
        return
    
    # Send history to client
    for msg in history:
        await websocket.send_json({"content": msg.content, "sender": msg.sender_name})
    
    # Main message loop - acquire DB connection only when needed
    try:
        while True:
            data = await websocket.receive_json()

            # Typing event — broadcast only, never persisted
            if isinstance(data, dict) and data.get("type") == "typing":
                sender = data.get("sender")
                # For DMs, use verified sender_username; for public rooms, trust client
                typing_sender = sender_username if dm_participants is not None else sender
                if isinstance(typing_sender, str) and 0 < len(typing_sender) <= SENDER_MAX_LEN:
                    async with AsyncSessionLocal() as db:
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

            async with AsyncSessionLocal() as db:
                if await _sender_is_blocked(dm_participants, sender_uid, db):
                    continue

                # For DMs, use verified sender_username; for public rooms, trust client sender
                message_sender = sender_username if dm_participants is not None else data["sender"]
                
                try:
                    await save_message(
                        db, room_id, message_sender, data["content"], user_id=sender_uid
                    )
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
                        "from_username": message_sender,
                        "room_slug": room_slug,
                        "preview": data["content"][:80],
                    })
                    # broadcast() now signals the registry via injected callback (event-driven delivery)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(room_slug, websocket)


@router.websocket("/ws/notifications")
async def notifications_websocket(websocket: WebSocket, token: str = "") -> None:
    logger = logging.getLogger(__name__)
    
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
        # Event-driven notification delivery with instant disconnect detection.
        # Race two tasks: (1) wait for notification event, (2) detect client disconnect
        # Whichever completes first wins—notifications fire instantly, disconnects are caught immediately.
        while True:
            event = await chat_notification_event_registry.get_or_create_event(user_key)
            
            # Create concurrent tasks for notification and disconnect detection
            notify_task = asyncio.create_task(event.wait())
            disconnect_task = asyncio.create_task(websocket.receive_text())
            
            try:
                # Race: first to complete wins
                # - If notification fires: notify_task completes, we clear and loop
                # - If client disconnects: disconnect_task raises WebSocketDisconnect
                # - If neither: timeout after 10s (fail-safe for stuck clients)
                done, pending = await asyncio.wait(
                    [notify_task, disconnect_task],
                    timeout=10.0,
                    return_when=asyncio.FIRST_COMPLETED
                )
                
                # Cancel pending tasks to avoid resource leaks
                for task in pending:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
                
                # Check which task completed
                if disconnect_task in done:
                    # Client sent data or disconnected (listen-only, so this is unexpected)
                    # If disconnect: receive_text() raised WebSocketDisconnect (caught below)
                    # If data: log warning and break (client shouldn't send on listen-only channel)
                    try:
                        data = disconnect_task.result()
                        logger.warning("Client sent data on listen-only channel: %s", data)
                    except WebSocketDisconnect:
                        # Expected disconnect path
                        pass
                    break
                
                # Notification received! Clear event and loop for next notification
                if notify_task in done:
                    await chat_notification_event_registry.clear_event(user_key)
                # else: timeout (fail-safe), loop continues
                    
            except WebSocketDisconnect:
                # Clean disconnect signal
                break
            
    except asyncio.CancelledError:
        logger.debug(f"WS /ws/notifications cancelled for user {uid}")
        raise
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception(f"WS /ws/notifications unexpected error for user {uid}: {e}")
    finally:
        notifications_manager.disconnect(user_key, websocket)
        # Clean up chat notification event registry entry when last connection for user is gone
        # Prevents unbounded growth of registry dict over time (one entry per user ever connected)
        if notifications_manager.active_connections(user_key) == 0:
            await chat_notification_event_registry.cleanup_event(user_key)

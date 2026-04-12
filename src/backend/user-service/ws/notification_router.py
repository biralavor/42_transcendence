# src/backend/user-service/ws/notification_router.py
import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.ws.manager import ConnectionManager
from service.service import get_me
from service.ws.event_registry import notification_event_registry

logger = logging.getLogger(__name__)

router = APIRouter()
notification_manager = ConnectionManager()

SessionDep = Annotated[AsyncSession, Depends(get_db)]


@router.websocket("/ws/notifications/{user_id}")
async def notification_endpoint(
    websocket: WebSocket,
    user_id: int,
    session: SessionDep,
    token: str = "",
) -> None:
    """
    Per-user notification channel (listen-only).

    Only the authenticated user may connect to their own channel:
    the token must decode to a user whose id matches the {user_id} path param.

    Server is the sole writer — clients cannot inject messages.
    Delivery is via POST /game-invites which calls notification_manager.broadcast().

    Close codes:
      4001 – missing/invalid token or get_me() failure
      4003 – authenticated user does not own this channel (me.id != user_id)
    """
    if not token:
        await websocket.close(code=4001)
        return

    try:
        me = await get_me(token, session)
    except Exception as exc:
        logger.warning("WS /notifications auth failed: %s", exc)
        await websocket.close(code=4001)
        return

    if me.id != user_id:
        await websocket.close(code=4003)
        return
    
    # Close session after authentication (don't hold it for connection lifetime)
    await session.close()

    room = str(user_id)
    await notification_manager.connect(room, websocket)
    try:
        # Event-driven notification delivery with instant disconnect detection.
        # Race two tasks: (1) wait for notification event, (2) detect client disconnect
        # Whichever completes first wins—notifications fire instantly, disconnects are caught immediately.
        while True:
            event = await notification_event_registry.get_or_create_event(room)
            
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
                    await notification_event_registry.clear_event(room)
                # else: timeout (fail-safe), loop continues
                    
            except WebSocketDisconnect:
                # Clean disconnect signal
                break
    except WebSocketDisconnect:
        pass
    except asyncio.CancelledError:
        logger.debug("WS /notifications cancelled for user %d", user_id)
        await notification_event_registry.cleanup_event(room)
        raise
    except Exception:
        logger.exception("WS /notifications unexpected error for user %d", user_id)
    finally:
        notification_manager.disconnect(room, websocket)

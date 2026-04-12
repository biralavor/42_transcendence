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
        # Event-driven notification delivery
        # Handler waits for event signal from broadcast(), allowing instant wakeup (not 1s polling)
        while True:
            event = await notification_event_registry.get_or_create_event(room)
            try:
                # Wait for event or timeout (both are cancellable via asyncio semantics)
                # Timeout ensures we check for disconnection every N seconds
                await asyncio.wait_for(event.wait(), timeout=10.0)
            except asyncio.TimeoutError:
                # Timeout is harmless—just means no notifications for 10s, loop continues
                continue
            # Event fired! Data was broadcasted, now clear event and re-register for next notification
            await notification_event_registry.clear_event(room)
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

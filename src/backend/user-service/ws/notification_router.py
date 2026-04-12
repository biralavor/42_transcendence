# src/backend/user-service/ws/notification_router.py
import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.ws.manager import ConnectionManager
from service.service import get_me

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

    room = str(user_id)
    await notification_manager.connect(room, websocket)
    try:
        # Keep connection open indefinitely (server-push only, no client frames expected)
        # Use sleep loop that can be cancelled when client disconnects
        while True:
            await asyncio.sleep(1)  # Check every second, but allow cancellation
    except WebSocketDisconnect:
        pass
    except asyncio.CancelledError:
        logger.debug("WS /notifications cancelled for user %d", user_id)
    except Exception:
        logger.exception("WS /notifications unexpected error for user %d", user_id)
    finally:
        notification_manager.disconnect(room, websocket)

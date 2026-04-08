# src/backend/user-service/ws/notification_router.py
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
    Per-user notification channel.

    Protocol:
    - Any authenticated user may connect to /ws/notifications/{user_id}.
    - Messages received on the socket are broadcast to ALL sockets currently
      connected to the same user_id channel (relay pattern).
    - Persistent listeners connect and keep the socket open.
    - Senders open a transient connection, write a JSON payload, then close.

    Supported event types (by convention, not enforced server-side):
      game_invite          – {type, from_user_id, from_username, from_avatar_url,
                               to_user_id, to_username, room_id, expires_at}
      game_invite_response – {type, status: accepted|declined, room_id,
                               from_user_id, from_username, from_avatar_url, to_user_id}
      game_invite_timeout  – {type, room_id, from_user_id, to_user_id}
    """
    if not token:
        await websocket.close(code=4001)
        return

    try:
        await get_me(token, session)
    except Exception as exc:
        logger.warning("WS /notifications auth failed: %s", exc)
        await websocket.close(code=4001)
        return

    room = str(user_id)
    await notification_manager.connect(room, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await notification_manager.broadcast(room, data)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WS /notifications unexpected error for user %d", user_id)
    finally:
        notification_manager.disconnect(room, websocket)

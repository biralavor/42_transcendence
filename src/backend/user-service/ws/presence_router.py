# src/backend/user-service/ws/presence_router.py
import logging
from typing import Annotated

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from shared.database import get_db
from shared.ws.presence import presence_manager
from service.models.user import User
from service.service import get_me
from service.friends import get_friends

logger = logging.getLogger(__name__)

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_db)]


async def set_user_status(user_id: int, status: str, session: AsyncSession) -> None:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if user is not None:
        user.status = status
        await session.commit()


@router.websocket("/ws/presence")
async def presence_endpoint(websocket: WebSocket, session: SessionDep, token: str = ""):
    # Authenticate via query param (browsers cannot set WS headers)
    if not token:
        await websocket.close(code=4001)
        return

    try:
        me = await get_me(token, session)
    except Exception as exc:
        logger.warning("WS /presence auth failed: %s", exc)
        await websocket.close(code=4001)
        return

    user_id = me.id

    already_online = presence_manager.is_online(user_id)
    await presence_manager.connect(user_id, websocket)
    try:
        if not already_online:
            friends = await get_friends(user_id, session)
            for friend in friends:
                if presence_manager.is_online(friend.id):
                    await presence_manager.broadcast_to(
                        friend.id,
                        {"type": "presence", "user_id": user_id, "status": "online"},
                    )

            await set_user_status(user_id, "online", session)

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WS /presence unexpected error for user %d", user_id)
    finally:
        presence_manager.disconnect(user_id, websocket)
        if not presence_manager.is_online(user_id):
            try:
                friends = await get_friends(user_id, session)
                for friend in friends:
                    if presence_manager.is_online(friend.id):
                        await presence_manager.broadcast_to(
                            friend.id,
                            {"type": "presence", "user_id": user_id, "status": "offline"},
                        )
                await set_user_status(user_id, "offline", session)
            except Exception:
                logger.exception("WS /presence cleanup error for user %d", user_id)

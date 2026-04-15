# src/backend/user-service/ws/presence_router.py
import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from shared.database import get_db
from shared.ws.presence import presence_manager
from service.models.user import User
from service.service import get_me
from service.friends import get_friends
from service.ws.event_registry import presence_event_registry

logger = logging.getLogger(__name__)

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_db)]


async def set_user_status(user_id: int, status: str, session: AsyncSession) -> None:
    await session.execute(update(User).where(User.id == user_id).values(status=status))
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
    
    # Close session after authentication (don't hold it for connection lifetime)
    await session.close()

    already_online = presence_manager.is_online(user_id)
    await presence_manager.connect(user_id, websocket)
    try:
        if not already_online:
            # Create new session for DB operations
            from shared.database import AsyncSessionLocal
            async with AsyncSessionLocal() as db_session:
                friends = await get_friends(user_id, db_session)
                for friend in friends:
                    if presence_manager.is_online(friend.id):
                        await presence_manager.broadcast_to(
                            friend.id,
                            {"type": "presence", "user_id": user_id, "status": "online"},
                        )

                await set_user_status(user_id, "online", db_session)

        while True:
            # Event-driven presence delivery with instant disconnect detection.
            # Race two tasks: (1) wait for presence event, (2) detect client disconnect
            # Whichever completes first wins—presence updates are instant, disconnects are caught immediately.
            room_key = str(user_id)
            event = await presence_event_registry.get_or_create_event(room_key)
            
            # Create concurrent tasks for presence event and disconnect detection
            event_task = asyncio.create_task(event.wait())
            disconnect_task = asyncio.create_task(websocket.receive_text())
            
            try:
                # Race: first to complete wins
                # - If presence event fires: event_task completes, we clear and loop
                # - If client disconnects: disconnect_task raises WebSocketDisconnect
                # - If neither: timeout after 10s (fail-safe for stuck clients)
                done, pending = await asyncio.wait(
                    [event_task, disconnect_task],
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
                
                # Presence event received! Clear event and loop for next update
                if event_task in done:
                    await presence_event_registry.clear_event(room_key)
                # else: timeout (fail-safe), loop continues
                    
            except WebSocketDisconnect:
                # Clean disconnect signal
                break
    except WebSocketDisconnect:
        pass
    except asyncio.CancelledError:
        logger.debug("WS /presence cancelled for user %d", user_id)
        raise
    except Exception:
        logger.exception("WS /presence unexpected error for user %d", user_id)
    finally:
        presence_manager.disconnect(user_id, websocket)
        if not presence_manager.is_online(user_id):
            try:
                # Create new session for cleanup DB operations
                from shared.database import AsyncSessionLocal
                async with AsyncSessionLocal() as db_session:
                    friends = await get_friends(user_id, db_session)
                    for friend in friends:
                        if presence_manager.is_online(friend.id):
                            await presence_manager.broadcast_to(
                                friend.id,
                                {"type": "presence", "user_id": user_id, "status": "offline"},
                            )
                    await set_user_status(user_id, "offline", db_session)
            except Exception:
                logger.exception("WS /presence cleanup error for user %d", user_id)
            finally:
                # Clean up presence event registry entry when user goes fully offline
                # Prevents unbounded growth of registry dict over time (one entry per user ever connected)
                await presence_event_registry.cleanup_event(str(user_id))

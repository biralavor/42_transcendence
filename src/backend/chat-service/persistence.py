import asyncio
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from service.models.chat_room import ChatRoom
from service.models.message import Message


async def get_or_create_room(db: AsyncSession, room_slug: str) -> ChatRoom:
    result = await db.execute(select(ChatRoom).where(ChatRoom.room_name == room_slug))
    room = result.scalars().first()
    if room is None:
        room = ChatRoom(room_name=room_slug)
        db.add(room)
        try:
            await db.commit()
            await db.refresh(room)
        except IntegrityError:
            await db.rollback()
            # Another concurrent session already inserted the row; fetch it.
            # Retry up to 3 times with a short backoff in case the committing
            # transaction hasn't become visible yet.
            for attempt in range(3):
                result2 = await db.execute(
                    select(ChatRoom).where(ChatRoom.room_name == room_slug)
                )
                room = result2.scalars().first()
                if room is not None:
                    break
                await asyncio.sleep(0.05 * (attempt + 1))
            else:
                raise RuntimeError(
                    f"Room '{room_slug}' not found after concurrent insert"
                )
    return room


async def save_message(
    db: AsyncSession, room_pk: int, sender_name: str, content: str
) -> Message:
    msg = Message(room_id=room_pk, user_id=None, sender_name=sender_name, content=content)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def get_room_history(
    db: AsyncSession, room_pk: int, limit: int = 50
) -> list[Message]:
    # Fetch newest `limit` rows DESC, then reverse to deliver oldest-first to caller.
    result = await db.execute(
        select(Message)
        .where(Message.room_id == room_pk)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return list(reversed(rows))

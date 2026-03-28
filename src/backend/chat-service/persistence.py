import asyncio
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from service.models.block import Block
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


async def get_or_create_dm_room(db: AsyncSession, user_a_id: int, user_b_id: int) -> ChatRoom:
    """Return (or create) the private DM room for two users.

    Room name is always DM-{min_id}-{max_id} regardless of argument order.
    """
    lo, hi = sorted((user_a_id, user_b_id))
    slug = f"DM-{lo}-{hi}"
    result = await db.execute(select(ChatRoom).where(ChatRoom.room_name == slug))
    room = result.scalars().first()
    if room is None:
        room = ChatRoom(room_name=slug, room_type="dm")
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
                    select(ChatRoom).where(ChatRoom.room_name == slug)
                )
                room = result2.scalars().first()
                if room is not None:
                    break
                await asyncio.sleep(0.05 * (attempt + 1))
            else:
                raise RuntimeError(
                    f"DM room '{slug}' not found after concurrent insert"
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


async def block_user(db: AsyncSession, blocker_id: int, blocked_id: int) -> None:
    """Block blocked_id from blocker's perspective. Idempotent."""
    result = await db.execute(
        select(Block).where(Block.blocker_id == blocker_id, Block.blocked_id == blocked_id)
    )
    if result.scalars().first() is not None:
        return
    db.add(Block(blocker_id=blocker_id, blocked_id=blocked_id))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()  # concurrent insert — already blocked


async def unblock_user(db: AsyncSession, blocker_id: int, blocked_id: int) -> None:
    """Remove a block. Raises 404 if no block exists."""
    result = await db.execute(
        select(Block).where(Block.blocker_id == blocker_id, Block.blocked_id == blocked_id)
    )
    row = result.scalars().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Block not found")
    db.delete(row)
    await db.commit()


async def get_blocked_ids(db: AsyncSession, user_id: int) -> set[int]:
    """Return the set of user IDs blocked by user_id."""
    result = await db.execute(
        select(Block.blocked_id).where(Block.blocker_id == user_id)
    )
    return set(result.scalars().all())


async def is_blocked(db: AsyncSession, blocker_id: int, blocked_id: int) -> bool:
    """Return True if blocker_id has blocked blocked_id."""
    result = await db.execute(
        select(Block).where(Block.blocker_id == blocker_id, Block.blocked_id == blocked_id)
    )
    return result.scalars().first() is not None

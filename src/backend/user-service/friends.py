# src/backend/user-service/friends.py
from fastapi import HTTPException
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from service.models.friendship import Friendship
from service.models.user import User


async def get_friends(user_id: int, session: AsyncSession) -> list[User]:
    """Returns User objects for all accepted friends of user_id."""
    result = await session.execute(
        select(Friendship).where(
            or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
            Friendship.status == "accepted",
        )
    )
    friendships = result.scalars().all()
    friend_ids = [
        f.addressee_id if f.requester_id == user_id else f.requester_id
        for f in friendships
    ]
    if not friend_ids:
        return []
    result = await session.execute(select(User).where(User.id.in_(friend_ids)))
    return result.scalars().all()


async def get_pending_requests(user_id: int, session: AsyncSession) -> list[dict]:
    """Returns pending requests where user_id is the addressee, enriched with requester username."""
    result = await session.execute(
        select(Friendship, User.username)
        .join(User, User.id == Friendship.requester_id)
        .where(
            Friendship.addressee_id == user_id,
            Friendship.status == "pending",
        )
    )
    rows = result.all()
    enriched = []
    for friendship, requester_username in rows:
        enriched.append({
            "id":                 friendship.id,
            "requester_id":       friendship.requester_id,
            "addressee_id":       friendship.addressee_id,
            "status":             friendship.status,
            "created_at":         friendship.created_at,
            "requester_username": requester_username,
        })
    return enriched


async def get_sent_requests(user_id: int, session: AsyncSession) -> list[dict]:
    """Returns pending requests where user_id is the requester, enriched with addressee username."""
    result = await session.execute(
        select(Friendship, User.username)
        .join(User, User.id == Friendship.addressee_id)
        .where(
            Friendship.requester_id == user_id,
            Friendship.status == "pending",
        )
    )
    rows = result.all()
    return [
        {
            "id":                friendship.id,
            "requester_id":      friendship.requester_id,
            "addressee_id":      friendship.addressee_id,
            "status":            friendship.status,
            "created_at":        friendship.created_at,
            "addressee_username": addressee_username,
        }
        for friendship, addressee_username in rows
    ]


async def send_friend_request(
    requester_id: int, addressee_id: int, session: AsyncSession
) -> Friendship:
    """Creates a pending friendship. Raises 409 if any relationship already exists."""
    if requester_id == addressee_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself as a friend")
    existing = await session.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == requester_id, Friendship.addressee_id == addressee_id),
                and_(Friendship.requester_id == addressee_id, Friendship.addressee_id == requester_id),
            )
        )
    )
    if existing.scalars().first() is not None:
        raise HTTPException(status_code=409, detail="Friend request already exists")
    friendship = Friendship(requester_id=requester_id, addressee_id=addressee_id, status="pending")
    session.add(friendship)
    await session.commit()
    await session.refresh(friendship)
    return friendship


async def accept_friend_request(
    addressee_id: int, requester_id: int, session: AsyncSession
) -> Friendship:
    """Marks a pending request as accepted. Raises 404 if not found."""
    result = await session.execute(
        select(Friendship).where(
            Friendship.requester_id == requester_id,
            Friendship.addressee_id == addressee_id,
            Friendship.status == "pending",
        )
    )
    friendship = result.scalars().first()
    if friendship is None:
        raise HTTPException(status_code=404, detail="Friend request not found")
    friendship.status = "accepted"
    await session.commit()
    await session.refresh(friendship)
    return friendship


async def decline_friend_request(
    addressee_id: int, requester_id: int, session: AsyncSession
) -> bool:
    """Deletes a pending request where addressee_id is the recipient. Returns False if not found."""
    result = await session.execute(
        select(Friendship).where(
            Friendship.requester_id == requester_id,
            Friendship.addressee_id == addressee_id,
            Friendship.status == "pending",
        )
    )
    friendship = result.scalars().first()
    if friendship is None:
        return False
    await session.delete(friendship)
    await session.commit()
    return True


async def delete_friendship(
    user_id: int, other_id: int, session: AsyncSession
) -> bool:
    """Removes a friendship in either direction. Returns False if not found."""
    result = await session.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == user_id, Friendship.addressee_id == other_id),
                and_(Friendship.requester_id == other_id, Friendship.addressee_id == user_id),
            )
        )
    )
    friendship = result.scalars().first()
    if friendship is None:
        return False
    await session.delete(friendship)
    await session.commit()
    return True


async def search_users(query: str, session: AsyncSession) -> list[User]:
    """Returns up to 10 users whose username contains query (case-insensitive)."""
    result = await session.execute(
        select(User).where(User.username.ilike(f"%{query}%")).limit(10)
    )
    return result.scalars().all()

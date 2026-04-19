# src/backend/user-service/friends.py
from fastapi import HTTPException
from sqlalchemy import select, or_, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from service.models.friendship import Friendship
from service.models.user import User
from service.schemas import SearchResponse
from service.persistence import reward_friendship_achievement_if_should

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
    """Creates a pending friendship. Raises 409 if any relationship already exists.
    
    Uses savepoint (nested transaction) for atomicity within the existing session transaction.
    """
    if requester_id == addressee_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself as a friend")
    
    async with session.begin_nested():
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
        await session.flush()
    
    return friendship


async def respond_to_friend_request(
    addressee_id: int, request_id: int, action: str, session: AsyncSession
) -> Friendship | None:
    """Accept or decline a pending friend request by its ID.

    Returns the updated Friendship for 'accept', None for 'decline'.
    Raises 404 if the request does not exist or does not belong to addressee_id.
    
    Uses savepoint (nested transaction) for atomicity within the existing session transaction.
    """
    if action not in ("accept", "decline"):
        raise HTTPException(status_code=400, detail=f"Invalid action: {action!r}")
    
    async with session.begin_nested():
        result = await session.execute(
            select(Friendship).where(
                Friendship.id == request_id,
                Friendship.addressee_id == addressee_id,
                Friendship.status == "pending",
            )
        )
        friendship = result.scalars().first()
        if friendship is None:
            raise HTTPException(status_code=404, detail="Friend request not found")
        
        if action == "accept":
            friendship.status = "accepted"
            await session.flush()
            await reward_friendship_achievement_if_should(
                friendship.requester_id, friendship.addressee_id, session
            )
        else:
            await session.delete(friendship)
    
    if action == "accept":
        return friendship
    return None


async def delete_friendship(
    user_id: int, other_id: int, session: AsyncSession
) -> bool:
    """Removes a friendship in either direction. Returns False if not found.
    
    Uses savepoint (nested transaction) for atomicity within the existing session transaction.
    """
    async with session.begin_nested():
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
    return True


async def search_users(query: str, session: AsyncSession) -> list[User]:
    """Returns up to 10 users whose username contains query (case-insensitive)."""
    result = await session.execute(
        select(User).where(User.username.ilike(f"%{query}%")).limit(10)
    )
    return result.scalars().all()

def search_users_order_by_str(sort_assoc: list[tuple[str, str]] | None) -> str | None:
    if sort_assoc is None:
        return None
    valid_columns = [
        'created_at'
    ]
    order_columns = []
    for (sort_key, order) in sort_assoc:
        norm_order = 'DESC' if order.upper() == 'DESC' else 'ASC'
        norm_key = sort_key.lower() if sort_key.lower() in valid_columns else None
        if norm_key is not None:
            order_columns.append(f"{norm_key} {norm_order}")
    result = ', '.join(order_columns) if len(order_columns) > 0 else None
    return result

async def search_users_paginated(
        query: str,
        limit: int,
        page: int,
        sort_assoc: list[tuple[str, str]] | None,
        session: AsyncSession
) -> SearchResponse:
    """
    Returns a paginated result of searching users.
    """
    default_order = """
username ILIKE CONCAT('%', CONCAT((:query)::text, '%')) DESC
, levenshtein(LOWER(username), LOWER((:query))::text, 1, 1, 1) ASC
    """
    query_order = search_users_order_by_str(sort_assoc)
    query_order = query_order if query_order is not None else default_order
    await session.execute(text("CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;"))
    offset = page * limit
    statement = text(f"""
WITH
all_users AS
(
    SELECT * FROM users
)
, filtered_users AS
(
    SELECT * FROM all_users
    WHERE username ILIKE CONCAT('%', CONCAT((:query)::text, '%'))
      OR levenshtein(LOWER(username), LOWER((:query))::text, 1, 1, 1) < 5
)
, user_count AS
(
    SELECT
        COUNT(id) AS total
    FROM filtered_users
)
, paged_users AS
(
    SELECT * FROM filtered_users
    ORDER BY {query_order}
    OFFSET (SELECT
               LEAST(:offset,
                     GREATEST(0, total - :limit))
            FROM user_count)
    LIMIT :limit
)
, page_stats AS
(
    SELECT
      (table user_count)
      AS total
      , LEAST(((:page)::int), (((table user_count) - 1) / :limit))
      AS page
      , (:limit)::int
      AS per_page
      , (((table user_count) - 1) / :limit)
      AS last_page
)
SELECT
    *
    , COALESCE((SELECT
                  jsonb_agg(jsonb_build_object(
                     'id' ,id
                     , 'username'  ,username
                     , 'display_name'  ,display_name
                     , 'avatar_url'  ,avatar_url
                     , 'status'  ,status
                     , 'created_at'  ,created_at
                  ) ORDER BY {query_order})
                FROM paged_users)
               , '[]'::jsonb)
    AS results
    FROM page_stats
    """)
    result = await session.execute(statement, {
        'query': query,
        'limit': limit,
        'page': page,
        'offset': offset
    })
    return SearchResponse.model_validate(dict(result.mappings().one()))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


async def reward_friendship_achievement_if_should(
    requester_id: int, addressee_id: int, session: AsyncSession
) -> None:
    """Compatibility hook for friendship acceptance.

    Achievement granting is currently disabled in this branch, but friends.py still
    calls this hook. Keep it as a no-op to preserve service startup and flow safety.
    """
    _ = (requester_id, addressee_id, session)
    return None


# check on friend request accepted?
async def friend_count(user_id: int, session: AsyncSession) -> int | None:
    statement = text("""
WITH requested AS
(
  SELECT
    requester_id
    ,count(addressee_id) FILTER(WHERE status = 'accepted')
    AS requests_accepted
  FROM friendships
  WHERE requester_id = :user_id
  GROUP BY requester_id
)
, accepted AS
(
  SELECT
     addressee_id
    ,count(requester_id) FILTER (WHERE status = 'accepted')
    AS accepted_requests
  FROM friendships
  WHERE addressee_id = :user_id
  GROUP BY addressee_id
)
SELECT
  COALESCE(requested.requests_accepted, 0)
  + COALESCE(accepted.accepted_requests, 0)
  AS friends
FROM requested
  FULL OUTER JOIN accepted ON requester_id = addressee_id
LIMIT 1
    """)
    result = await session.execute(
        statement, {'user_id': user_id}
    )
    result_scalar: int | None = result.scalar_one_or_none()
    return result_scalar
async def insert_user_achievement(
        user_id: int, achievement: dict[str,str], session: AsyncSession):
    """ caller should commit session"""

    statement = text("""
WITH
insert_achievement_if_not_exists AS
(
    INSERT INTO achievements (key, name, description, icon)
        VALUES (:a_key, :a_name, :a_desc, :a_icon)
    ON CONFLICT (key) DO NOTHING
    RETURNING id
)
, insertion_user_achievement AS
(

    INSERT INTO user_achievements (user_id, achievement_id)
        VALUES (:user_id, COALESCE((SELECT id FROM achievements WHERE key = :a_key),
                                   (table insert_achievement_if_not_exists)))
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id
)
, insertion_notification AS
(
    INSERT INTO notifications (user_id, type, message)
        VALUES (:user_id, 'user_achievement', :a_desc)
)
SELECT
    :user_id as user_id
    ,*
FROM achievements
    JOIN insertion_user_achievement on achievement_id = achievements.id
    """)
    result = await session.execute(
        statement, {'user_id': user_id, **achievement}
    )
    ret = result.mappings().one_or_none()
    return dict(ret) if ret is not None else None

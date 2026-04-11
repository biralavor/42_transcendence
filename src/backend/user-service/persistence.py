from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


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
  (requests_accepted + accepted_requests)
  AS friends
FROM requested
  INNER JOIN accepted ON requester_id = addressee_id
LIMIT 1
    """)
    result = await session.execute(
        statement, {'user_id': user_id}
    )
    result_scalar: int | None = result.scalar_one_or_none()
    return result_scalar


async def insert_user_achievement(
        user_id: int, achievement_id: int, session: AsyncSession):
    statement = text("""
WITH insertion_user_achievement AS
(
INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (:user_id, :achievement_id)
RETURNING achievement_id
)
SELECT
    :user_id as user_id
    ,*
FROM achievements
    JOIN insertion_user_achievement on achievement_id = achievements.id
    """)
    result = await session.execute(
        statement, {'user_id': user_id, 'achievement_id': achievement_id}
    )
    await session.commit()
    rows = result.mappings().all()
    if rows:
        return rows
    return None

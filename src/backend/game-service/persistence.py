from datetime import datetime, timezone  # timezone used to get UTC then strip tzinfo

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from service.models.match import Match


async def create_match(db: AsyncSession, player1_id: int, player2_id: int) -> Match:
    match = Match(
        player1_id=player1_id,
        player2_id=player2_id,
        status="ongoing",
        started_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(match)
    await db.commit()
    await db.refresh(match)
    return match


async def finish_match(
    db: AsyncSession, match_id: int, winner_id: int, score_p1: int, score_p2: int
) -> Match | None:
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if match is None:
        return None
    match.winner_id = winner_id
    match.score_p1 = score_p1
    match.score_p2 = score_p2
    match.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)
    match.status = "finished"
    await db.commit()
    await db.refresh(match)
    return match


async def get_match(db: AsyncSession, match_id: int) -> Match | None:
    result = await db.execute(select(Match).where(Match.id == match_id))
    return result.scalars().first()


async def get_user_stats(db: AsyncSession, user_id: int) -> dict:
    result = await db.execute(
        select(Match).where(
            or_(Match.player1_id == user_id, Match.player2_id == user_id),
            Match.status == "finished",
        )
    )
    matches = result.scalars().all()
    wins = sum(1 for m in matches if m.winner_id == user_id)
    goals_scored = sum(
        m.score_p1 if m.player1_id == user_id else m.score_p2 for m in matches
    )
    goals_conceded = sum(
        m.score_p2 if m.player1_id == user_id else m.score_p1 for m in matches
    )
    return {
        "user_id": user_id,
        "wins": wins,
        "losses": len(matches) - wins,
        "total_games": len(matches),
        "goals_scored": goals_scored,
        "goals_conceded": goals_conceded,
    }


async def get_user_matches(db: AsyncSession, user_id: int) -> list[Match]:
    result = await db.execute(
        select(Match)
        .where(or_(Match.player1_id == user_id, Match.player2_id == user_id))
        .order_by(Match.started_at.desc())
    )
    return list(result.scalars().all())


async def get_leaderboard(db: AsyncSession, limit: int = 20) -> list[dict]:
    result = await db.execute(
        select(Match).where(
            Match.status == "finished",
            Match.finished_at.is_not(None),
        )
    )
    matches = result.scalars().all()

    stats_by_user: dict[int, dict] = {}

    for match in matches:
        for user_id, goals_scored, goals_conceded, is_winner in (
            (match.player1_id, match.score_p1, match.score_p2, match.winner_id == match.player1_id),
            (match.player2_id, match.score_p2, match.score_p1, match.winner_id == match.player2_id),
        ):
            if user_id not in stats_by_user:
                stats_by_user[user_id] = {
                    "user_id": user_id,
                    "wins": 0,
                    "losses": 0,
                    "total_games": 0,
                    "goals_scored": 0,
                    "goals_conceded": 0,
                    "goal_difference": 0,
                    "points": 0,
                }

            row = stats_by_user[user_id]
            row["total_games"] += 1
            row["goals_scored"] += goals_scored
            row["goals_conceded"] += goals_conceded

            if is_winner:
                row["wins"] += 1
                row["points"] += 3
            else:
                row["losses"] += 1

    leaderboard = list(stats_by_user.values())
    for row in leaderboard:
        row["goal_difference"] = row["goals_scored"] - row["goals_conceded"]

    leaderboard.sort(
        key=lambda row: (
            -row["points"],
            -row["goal_difference"],
            -row["goals_scored"],
            row["user_id"],
        )
    )

    for rank, row in enumerate(leaderboard, start=1):
        row["rank"] = rank

    return leaderboard[:limit]

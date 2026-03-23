from datetime import datetime, timezone  # timezone used to get UTC then strip tzinfo

from sqlalchemy import case, func, or_, select, union_all
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
    finished_cond = (Match.status == "finished", Match.finished_at.is_not(None))

    # Build per-player-slot views of each finished match, then UNION ALL
    p1 = select(
        Match.player1_id.label("user_id"),
        Match.score_p1.label("goals_scored"),
        Match.score_p2.label("goals_conceded"),
        case((Match.winner_id == Match.player1_id, 1), else_=0).label("is_win"),
    ).where(*finished_cond)

    p2 = select(
        Match.player2_id.label("user_id"),
        Match.score_p2.label("goals_scored"),
        Match.score_p1.label("goals_conceded"),
        case((Match.winner_id == Match.player2_id, 1), else_=0).label("is_win"),
    ).where(*finished_cond)

    combined = union_all(p1, p2).subquery()

    # Aggregate per user, compute derived columns, push ordering + limit into DB
    agg = (
        select(
            combined.c.user_id,
            func.sum(combined.c.is_win).label("wins"),
            func.sum(1 - combined.c.is_win).label("losses"),
            func.count(combined.c.user_id).label("total_games"),
            func.sum(combined.c.goals_scored).label("goals_scored"),
            func.sum(combined.c.goals_conceded).label("goals_conceded"),
            (
                func.sum(combined.c.goals_scored) - func.sum(combined.c.goals_conceded)
            ).label("goal_difference"),
            (func.sum(combined.c.is_win) * 3).label("points"),
        )
        .group_by(combined.c.user_id)
        .subquery()
    )

    stmt = (
        select(agg)
        .order_by(
            agg.c.points.desc(),
            agg.c.goal_difference.desc(),
            agg.c.goals_scored.desc(),
            agg.c.user_id.asc(),
        )
        .limit(limit)
    )

    result = await db.execute(stmt)
    return [
        {**row, "rank": rank}
        for rank, row in enumerate(result.mappings().all(), start=1)
    ]

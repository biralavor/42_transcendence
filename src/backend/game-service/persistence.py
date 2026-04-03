from datetime import datetime, timezone

from sqlalchemy import or_, select, case, func, union_all
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from service.models.match import Match
from service.models.tournament import Tournament
from service.models.tournament_participant import TournamentParticipant


class TournamentNotFound(Exception):
    pass


class TournamentNotOpen(Exception):
    pass


class UserAlreadyRegistered(Exception):
    pass


class TournamentFull(Exception):
    pass


async def create_match(db: AsyncSession, player1_id: int, player2_id: int) -> Match:
    match = Match(
        player1_id=player1_id,
        player2_id=player2_id,
        status="ongoing",
        started_at=datetime.now(timezone.utc),
    )
    db.add(match)
    await db.commit()
    await db.refresh(match)
    return match


async def create_tournament(
    db: AsyncSession, name: str, creator_id: int, max_participants: int
) -> Tournament:
    tournament = Tournament(
        name=name,
        creator_id=creator_id,
        max_participants=max_participants,
        status="open",
    )
    db.add(tournament)
    await db.commit()
    await db.refresh(tournament)
    return tournament


async def get_tournament_with_participants(
    db: AsyncSession, tournament_id: int
) -> tuple[Tournament, list[TournamentParticipant]] | None:
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalars().first()
    if tournament is None:
        return None
    participants_result = await db.execute(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == tournament_id)
    )
    participants = list(participants_result.scalars().all())
    return tournament, participants


async def join_tournament(
    db: AsyncSession, tournament_id: int, user_id: int
) -> TournamentParticipant:
    # Lock the tournament row so concurrent requests cannot both pass the
    # capacity check before either one commits.
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id).with_for_update()
    )
    tournament = result.scalars().first()
    if tournament is None:
        raise TournamentNotFound()
    if tournament.status != "open":
        raise TournamentNotOpen()

    count_result = await db.execute(
        select(func.count())
        .select_from(TournamentParticipant)
        .where(TournamentParticipant.tournament_id == tournament_id)
    )
    if count_result.scalar() >= tournament.max_participants:
        raise TournamentFull()

    participant = TournamentParticipant(tournament_id=tournament_id, user_id=user_id)
    db.add(participant)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise UserAlreadyRegistered()
    await db.refresh(participant)
    return participant


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
    match.finished_at = datetime.now(timezone.utc)
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
    """
    Aggregate finished matches directly in the database to produce a ranked leaderboard.

    We build two subqueries (one for each player slot) that project the per‑match
    statistics we care about (goals scored, goals conceded, whether the user won).
    These are unioned into a single table, then aggregated by user.  Ordering and
    limiting are pushed into the database for efficiency.  Finally, we attach a
    one‑based rank to each result row.

    Args:
        db: Async database session.
        limit: Maximum number of leaderboard entries to return.

    Returns:
        A list of dicts, each containing user_id, wins, losses, total_games,
        goals_scored, goals_conceded, goal_difference, points and rank.
    """
    # Conditions to filter finished matches.  We name this tuple clearly so it's
    # obvious it's a set of SQLAlchemy expressions and not a result.
    finished_cond = (Match.status == "finished", Match.finished_at.is_not(None))

    # Build per‑player views of each finished match.  For player1 we take
    # score_p1 as goals_scored and score_p2 as goals_conceded.  We also compute
    # a flag (1 or 0) indicating whether this user won the match.
    p1 = select(
        Match.player1_id.label("user_id"),
        Match.score_p1.label("goals_scored"),
        Match.score_p2.label("goals_conceded"),
        case((Match.winner_id == Match.player1_id, 1), else_=0).label("is_win"),
    ).where(*finished_cond)

    # Mirror of the above for player2.
    p2 = select(
        Match.player2_id.label("user_id"),
        Match.score_p2.label("goals_scored"),
        Match.score_p1.label("goals_conceded"),
        case((Match.winner_id == Match.player2_id, 1), else_=0).label("is_win"),
    ).where(*finished_cond)

    # Combine both sets of per‑player records into one table.  union_all preserves
    # duplicates, which we want because each match contributes two rows (one per
    # player).
    combined = union_all(p1, p2).subquery()

    # Aggregate per user: count wins and losses, total games, sum goals scored
    # and conceded.  Compute goal_difference and points at the SQL level.
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

    # Apply ordering and limit.  The ordering matches the requirements: points
    # descending, then goal_difference, then goals_scored, and finally user_id
    # ascending as a deterministic tie‑breaker.
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
    # result.mappings() yields RowMapping objects which already behave like
    # dictionaries.  Build the response list and attach a 1‑based rank.
    return [
        {**row, "rank": rank}
        for rank, row in enumerate(result.mappings().all(), start=1)
    ]

import random
from datetime import datetime, timezone

from sqlalchemy import or_, select, case, func, union_all, table, column, String, Integer, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from service.models.match import Match
from service.models.tournament import Tournament
from service.models.tournament_match import TournamentMatch
from service.models.tournament_participant import TournamentParticipant


class TournamentNotFound(Exception):
    pass


class TournamentNotOpen(Exception):
    pass


class UserAlreadyRegistered(Exception):
    pass


class TournamentFull(Exception):
    pass


class NotTournamentCreator(Exception):
    pass


class TournamentNotEnoughParticipants(Exception):
    pass


class TournamentMatchNotFound(Exception):
    pass


class TournamentMatchAlreadyFinished(Exception):
    pass


class InvalidWinner(Exception):
    pass

class UserAlreadyInActiveTournament(Exception):
    pass

class TournamentCannotBeCancelled(Exception):
    pass


class TournamentNotParticipant(Exception):
    pass

class TournamentNotInProgress(Exception):
    pass

async def delete_tournament(
    db: AsyncSession,
    tournament_id: int,
    user_id: int,
) -> None:
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id).with_for_update()
    )
    tournament = result.scalars().first()

    if tournament is None:
        raise TournamentNotFound()

    if tournament.creator_id != user_id:
        raise NotTournamentCreator()

    if tournament.status != "open":
        raise TournamentCannotBeCancelled()

    await db.execute(
        delete(TournamentParticipant).where(
            TournamentParticipant.tournament_id == tournament_id
        )
    )
    await db.flush()

    await db.delete(tournament)
    await db.commit()

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

async def leave_tournament(
    db: AsyncSession,
    tournament_id: int,
    user_id: int,
) -> None:
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id).with_for_update()
    )
    tournament = result.scalars().first()

    if tournament is None:
        raise TournamentNotFound()

    if tournament.status != "open":
        raise TournamentNotOpen()

    participant_result = await db.execute(
        select(TournamentParticipant).where(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.user_id == user_id,
        )
    )
    participant = participant_result.scalars().first()

    if participant is None:
        raise TournamentNotParticipant()

    other_participants_result = await db.execute(
        select(TournamentParticipant)
        .where(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.user_id != user_id,
        )
        .order_by(TournamentParticipant.joined_at.asc())
    )
    other_participants = list(other_participants_result.scalars().all())

    await db.delete(participant)
    await db.flush()

    if tournament.creator_id == user_id:
        if other_participants:
            tournament.creator_id = other_participants[0].user_id
        else:
            await db.delete(tournament)

    await db.commit()

async def withdraw_tournament(
    db: AsyncSession,
    tournament_id: int,
    user_id: int,
) -> tuple[Tournament, bool]:
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id).with_for_update()
    )
    tournament = result.scalars().first()

    if tournament is None:
        raise TournamentNotFound()

    if tournament.status != "in_progress":
        raise TournamentNotInProgress()

    participant_result = await db.execute(
        select(TournamentParticipant).where(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.user_id == user_id,
        )
    )
    participant = participant_result.scalars().first()

    if participant is None:
        raise TournamentNotParticipant()

    affected_matches_result = await db.execute(
        select(TournamentMatch)
        .where(
            TournamentMatch.tournament_id == tournament_id,
            or_(
                TournamentMatch.player1_id == user_id,
                TournamentMatch.player2_id == user_id,
            ),
        )
        .order_by(TournamentMatch.position.asc(), TournamentMatch.id.asc())
    )
    affected_matches = list(affected_matches_result.scalars().all())

    for tournament_match in affected_matches:
        await _award_tournament_forfeit(db, tournament_match, user_id)

    other_participants_result = await db.execute(
        select(TournamentParticipant)
        .where(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.user_id != user_id,
        )
        .order_by(TournamentParticipant.joined_at.asc())
    )
    other_participants = list(other_participants_result.scalars().all())

    await db.delete(participant)
    await db.flush()

    if tournament.creator_id == user_id and other_participants:
        tournament.creator_id = other_participants[0].user_id

    await _assign_available_tournament_matches(db, tournament_id)

    all_matches_result = await db.execute(
        select(TournamentMatch).where(TournamentMatch.tournament_id == tournament_id)
    )
    all_matches = list(all_matches_result.scalars().all())

    tournament_complete = all(match.status == "finished" for match in all_matches)

    if tournament_complete:
        tournament.status = "complete"

    await db.commit()
    await db.refresh(tournament)
    return tournament, tournament_complete

async def create_tournament(
    db: AsyncSession, name: str, creator_id: int, max_participants: int
) -> Tournament:
    if await user_has_active_tournament(db, creator_id):
        raise UserAlreadyInActiveTournament()

    tournament = Tournament(
        name=name,
        creator_id=creator_id,
        max_participants=max_participants,
        status="open",
    )
    db.add(tournament)
    await db.flush()

    participant = TournamentParticipant(
        tournament_id=tournament.id,
        user_id=creator_id,
    )
    db.add(participant)

    await db.commit()
    await db.refresh(tournament)
    return tournament


async def get_tournament_with_participants(
    db: AsyncSession, tournament_id: int
) -> tuple[Tournament, list[TournamentParticipant], list[TournamentMatch]] | None:
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalars().first()
    if tournament is None:
        return None

    participants_result = await db.execute(
        select(TournamentParticipant).where(
            TournamentParticipant.tournament_id == tournament_id
        )
    )
    participants = list(participants_result.scalars().all())

    matches_result = await db.execute(
        select(TournamentMatch, Match.score_p1, Match.score_p2)
        .outerjoin(Match, Match.id == TournamentMatch.match_id)
        .where(TournamentMatch.tournament_id == tournament_id)
    )
    rows = matches_result.all()

    matches = []
    for tm, score_p1, score_p2 in rows:
        tm.score_p1 = score_p1 or 0
        tm.score_p2 = score_p2 or 0
        matches.append(tm)

    return tournament, participants, matches

async def list_tournaments(db: AsyncSession) -> list[Tournament]:
    result = await db.execute(
        select(Tournament).order_by(Tournament.created_at.desc())
    )
    return list(result.scalars().all())

async def user_has_active_tournament(
    db: AsyncSession,
    user_id: int,
    exclude_tournament_id: int | None = None,
) -> bool:
    stmt = (
        select(Tournament)
        .outerjoin(
            TournamentParticipant,
            TournamentParticipant.tournament_id == Tournament.id,
        )
        .where(
            Tournament.status.in_(["open", "in_progress"]),
            or_(
                Tournament.creator_id == user_id,
                TournamentParticipant.user_id == user_id,
            ),
        )
    )

    if exclude_tournament_id is not None:
        stmt = stmt.where(Tournament.id != exclude_tournament_id)

    result = await db.execute(stmt)
    return result.scalars().first() is not None

async def join_tournament(
    db: AsyncSession, tournament_id: int, user_id: int
) -> TournamentParticipant:
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id).with_for_update()
    )
    tournament = result.scalars().first()
    if tournament is None:
        raise TournamentNotFound()
    if tournament.status != "open":
        raise TournamentNotOpen()

    existing_result = await db.execute(
        select(TournamentParticipant).where(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.user_id == user_id,
        )
    )
    existing_participant = existing_result.scalars().first()
    if existing_participant is not None:
        raise UserAlreadyRegistered()

    if await user_has_active_tournament(db, user_id, exclude_tournament_id=tournament_id):
        raise UserAlreadyInActiveTournament()

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

def _build_round_robin_pairs(user_ids: list[int]) -> list[tuple[int, int]]:
    pairs: list[tuple[int, int]] = []

    for i in range(len(user_ids)):
        for j in range(i + 1, len(user_ids)):
            pairs.append((user_ids[i], user_ids[j]))

    return pairs


async def _assign_available_tournament_matches(
    db: AsyncSession,
    tournament_id: int,
) -> list[TournamentMatch]:
    result = await db.execute(
        select(TournamentMatch)
        .where(TournamentMatch.tournament_id == tournament_id)
        .order_by(TournamentMatch.position.asc(), TournamentMatch.id.asc())
    )
    tournament_matches = list(result.scalars().all())

    busy_player_ids: set[int] = set()
    for tm in tournament_matches:
        if tm.status == "in_progress":
            if tm.player1_id is not None:
                busy_player_ids.add(tm.player1_id)
            if tm.player2_id is not None:
                busy_player_ids.add(tm.player2_id)

    newly_assigned: list[TournamentMatch] = []

    for tm in tournament_matches:
        if tm.status != "pending":
            continue

        if tm.player1_id is None or tm.player2_id is None:
            continue

        if tm.player1_id in busy_player_ids or tm.player2_id in busy_player_ids:
            continue

        match = Match(
            player1_id=tm.player1_id,
            player2_id=tm.player2_id,
            status="ongoing",
            started_at=datetime.now(timezone.utc),
        )
        db.add(match)
        await db.flush()

        tm.match_id = match.id
        tm.status = "in_progress"

        busy_player_ids.add(tm.player1_id)
        busy_player_ids.add(tm.player2_id)
        newly_assigned.append(tm)

    return newly_assigned

async def _award_tournament_forfeit(
    db: AsyncSession,
    tournament_match: TournamentMatch,
    withdrawn_user_id: int,
) -> None:
    if tournament_match.status == "finished":
        return

    if tournament_match.player1_id == withdrawn_user_id:
        opponent_id = tournament_match.player2_id
    elif tournament_match.player2_id == withdrawn_user_id:
        opponent_id = tournament_match.player1_id
    else:
        return

    tournament_match.winner_id = opponent_id
    tournament_match.status = "finished"

    if tournament_match.match_id is None:
        return

    match_result = await db.execute(
        select(Match).where(Match.id == tournament_match.match_id)
    )
    match = match_result.scalars().first()
    if match is None:
        return

    match.winner_id = opponent_id
    if opponent_id == match.player1_id:
        match.score_p1 = 1
        match.score_p2 = 0
    else:
        match.score_p1 = 0
        match.score_p2 = 1

    match.status = "finished"
    match.finished_at = datetime.now(timezone.utc)

async def start_tournament(
    db: AsyncSession, tournament_id: int, user_id: int
) -> tuple[Tournament, list[TournamentMatch]]:
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id).with_for_update()
    )
    tournament = result.scalars().first()
    if tournament is None:
        raise TournamentNotFound()
    if tournament.status != "open":
        raise TournamentNotOpen()
    if tournament.creator_id != user_id:
        raise NotTournamentCreator()

    participants_result = await db.execute(
        select(TournamentParticipant).where(
            TournamentParticipant.tournament_id == tournament_id
        )
    )
    participants = list(participants_result.scalars().all())

    if len(participants) != tournament.max_participants:
        raise TournamentNotEnoughParticipants()

    user_ids = [p.user_id for p in participants]
    random.shuffle(user_ids)

    pairings = _build_round_robin_pairs(user_ids)

    tournament_matches: list[TournamentMatch] = []
    for position, (player1_id, player2_id) in enumerate(pairings):
        tm = TournamentMatch(
            tournament_id=tournament_id,
            match_id=None,
            round=1,
            position=position,
            player1_id=player1_id,
            player2_id=player2_id,
            winner_id=None,
            status="pending",
        )
        db.add(tm)
        tournament_matches.append(tm)

    tournament.status = "in_progress"
    await db.flush()

    await _assign_available_tournament_matches(db, tournament_id)

    await db.commit()

    refreshed_result = await db.execute(
        select(TournamentMatch)
        .where(TournamentMatch.tournament_id == tournament_id)
        .order_by(TournamentMatch.position.asc(), TournamentMatch.id.asc())
    )
    refreshed_matches = list(refreshed_result.scalars().all())

    await db.refresh(tournament)
    return tournament, refreshed_matches


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


async def record_tournament_match_result(
    db: AsyncSession,
    tournament_id: int,
    match_id: int,
    winner_id: int,
    score_p1: int = 0,
    score_p2: int = 0,
) -> tuple[Tournament, bool]:
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id).with_for_update()
    )
    tournament = result.scalars().first()
    if tournament is None:
        raise TournamentNotFound()

    tm_result = await db.execute(
        select(TournamentMatch).where(
            TournamentMatch.tournament_id == tournament_id,
            TournamentMatch.match_id == match_id,
        )
    )
    tm = tm_result.scalars().first()
    if tm is None:
        raise TournamentMatchNotFound()
    if tm.status == "finished":
        raise TournamentMatchAlreadyFinished()
    if winner_id not in (tm.player1_id, tm.player2_id):
        raise InvalidWinner()

    tm.winner_id = winner_id
    tm.status = "finished"

    match_result = await db.execute(select(Match).where(Match.id == match_id))
    match = match_result.scalars().first()
    if match is not None:
        match.winner_id = winner_id
        match.score_p1 = score_p1
        match.score_p2 = score_p2
        match.status = "finished"
        match.finished_at = datetime.now(timezone.utc)

    await _assign_available_tournament_matches(db, tournament_id)

    all_matches_result = await db.execute(
        select(TournamentMatch).where(TournamentMatch.tournament_id == tournament_id)
    )
    all_matches = list(all_matches_result.scalars().all())

    tournament_complete = all(
        tournament_match.status == "finished"
        for tournament_match in all_matches
    )

    if tournament_complete:
        tournament.status = "complete"

    await db.commit()
    await db.refresh(tournament)
    return tournament, tournament_complete


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
        A list of dicts, each containing user_id, username, wins, losses, total_games,
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

    # Define users table reference without importing the model (allows cross-service join)
    users = table('users', column('id', Integer), column('username', String))

    # Join aggregated stats with users table to include username.
    stmt = (
        select(
            agg.c.user_id,
            agg.c.wins,
            agg.c.losses,
            agg.c.total_games,
            agg.c.goals_scored,
            agg.c.goals_conceded,
            agg.c.goal_difference,
            agg.c.points,
            users.c.username,
        )
        .join(users, agg.c.user_id == users.c.id)
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

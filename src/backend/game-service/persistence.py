import random
from datetime import datetime, timezone

from sqlalchemy import (
    or_, select, case, func, union_all,
    table, column, String, Integer, text, delete
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from service.models.match import Match
from service.models.tournament import Tournament
from service.models.tournament_match import TournamentMatch
from service.models.tournament_participant import TournamentParticipant
from shared.util.order import get_order_by_str

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
) -> tuple[Tournament, bool, list[TournamentMatch]]:
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

    newly_assigned = await _assign_available_tournament_matches(db, tournament_id)

    all_matches_result = await db.execute(
        select(TournamentMatch).where(TournamentMatch.tournament_id == tournament_id)
    )
    all_matches = list(all_matches_result.scalars().all())

    tournament_complete = all(match.status == "finished" for match in all_matches)
    if tournament_complete:
        tournament.status = "complete"

    await db.commit()
    await db.refresh(tournament)
    return tournament, tournament_complete, newly_assigned

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
        select(TournamentMatch, Match.score_p1, Match.score_p2, Match.started_at)
        .outerjoin(Match, Match.id == TournamentMatch.match_id)
        .where(TournamentMatch.tournament_id == tournament_id)
    )
    rows = matches_result.all()

    matches = []
    for tm, score_p1, score_p2, started_at in rows:
        tm.score_p1 = score_p1 or 0
        tm.score_p2 = score_p2 or 0
        tm.started_at = started_at
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
        if tm.status != "in_progress":
            continue
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
    # AI player is represented by user_id = 0 (AI_PLAYER_ID sentinel).
    # Skip XP/achievement awarding for the AI on either side — it has no
    # row in the `users` table, so award_xp would violate the FK on user_xp.user_id.
    AI_PLAYER_ID = 0
    loser_id = match.player2_id if winner_id == match.player1_id else match.player1_id
    await db.flush()
    if winner_id != AI_PLAYER_ID:
        await award_xp(winner_id, 25, db)
    if loser_id != AI_PLAYER_ID:
        await award_xp(loser_id, 5, db)
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
    user_id: int | None = None,
) -> tuple[Tournament, bool, list[TournamentMatch]]:
    """Record the winner of a tournament match and advance the bracket.

    Returns (tournament, tournament_complete, newly_assigned).
    """
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
    if user_id is not None and user_id not in (tm.player1_id, tm.player2_id):
        raise TournamentNotParticipant()
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
    await db.flush()
    await award_xp(winner_id, 100, db)

    newly_assigned = await _assign_available_tournament_matches(db, tournament_id)

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
    return tournament, tournament_complete, newly_assigned


async def record_tournament_match_timeout_result(
    db: AsyncSession,
    tournament_id: int,
    tournament_match_id: int,
    winner_id: int | None,
) -> tuple[Tournament, bool, list[TournamentMatch]]:
    """
    Resolve a tournament match by ready-timeout.

    winner_id semantics:
    - int: winner by WO
    - None: no winner (both absent or no ready)
    """
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id).with_for_update()
    )
    tournament = result.scalars().first()
    if tournament is None:
        raise TournamentNotFound()

    tm_result = await db.execute(
        select(TournamentMatch).where(
            TournamentMatch.tournament_id == tournament_id,
            TournamentMatch.id == tournament_match_id,
        )
    )
    tm = tm_result.scalars().first()
    if tm is None:
        raise TournamentMatchNotFound()
    if tm.status == "finished":
        raise TournamentMatchAlreadyFinished()
    if winner_id is not None and winner_id not in (tm.player1_id, tm.player2_id):
        raise InvalidWinner()

    tm.winner_id = winner_id
    tm.status = "finished"

    if tm.match_id is not None:
        match_result = await db.execute(select(Match).where(Match.id == tm.match_id))
        match = match_result.scalars().first()
        if match is not None:
            match.winner_id = winner_id
            if winner_id is None:
                match.score_p1 = 0
                match.score_p2 = 0
            elif winner_id == tm.player1_id:
                match.score_p1 = 1
                match.score_p2 = 0
            else:
                match.score_p1 = 0
                match.score_p2 = 1
            match.status = "finished"
            match.finished_at = datetime.now(timezone.utc)

    await db.flush()

    if winner_id is not None:
        await award_xp(winner_id, 100, db)

    newly_assigned = await _assign_available_tournament_matches(db, tournament_id)

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
    return tournament, tournament_complete, newly_assigned


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


async def list_live_matches(db: AsyncSession) -> list[dict]:
    """Return all human-vs-human matches currently in 'ongoing' status,
    with both players' usernames + display names + avatars.

    AI matches (player_id = 0) are excluded — the AI is not a watchable player.
    Spectator counts are NOT included here; they are sourced live from the
    in-memory ConnectionManager by the route handler.
    """
    result = await db.execute(
        text(
            """
            SELECT
                m.id::text                                                      AS match_id,
                m.player1_id                                                    AS p1_id,
                u1.username                                                     AS p1_username,
                COALESCE(NULLIF(TRIM(u1.display_name), ''), u1.username)        AS p1_display_name,
                u1.avatar_url                                                   AS p1_avatar_url,
                m.player2_id                                                    AS p2_id,
                u2.username                                                     AS p2_username,
                COALESCE(NULLIF(TRIM(u2.display_name), ''), u2.username)        AS p2_display_name,
                u2.avatar_url                                                   AS p2_avatar_url,
                m.started_at                                                    AS started_at
            FROM matches m
            JOIN users u1 ON u1.id = m.player1_id
            JOIN users u2 ON u2.id = m.player2_id
            WHERE m.status = 'ongoing'
              AND m.player1_id <> 0
              AND m.player2_id <> 0
            ORDER BY m.started_at DESC
            """
        )
    )
    return [dict(row) for row in result.mappings()]


async def mark_match_finished_if_ongoing(
    db: AsyncSession,
    match_id: int,
    *,
    min_age_seconds: int = 30,
) -> bool:
    """Mark a single match as finished, idempotently and atomically, only if
    the row is older than ``min_age_seconds``.

    The age gate prevents a race where ``create_match`` (which commits the
    row as ``ongoing``) and the WS ``_bind_match`` call are separated by an
    ``await`` window. A ``/games/live`` poll arriving in that window would
    otherwise see the row unbound and prematurely finish a real game. The
    30-second default comfortably exceeds the typical create-to-bind gap
    (sub-100 ms) and matches the project's other "give players time"
    constants such as ``DISCONNECT_GRACE_SECONDS``.

    Leaves ``winner_id`` and scores untouched — the caller has no data to
    reconstruct them honestly.

    Returns True if the row was updated, False if the row was already
    finished, too young, or did not exist. Caller is responsible for
    committing.
    """
    # Use clock_timestamp() (real wall-clock) instead of NOW() (transaction
    # start). In SAVEPOINT-based test fixtures the outer transaction is
    # long-lived, so NOW() doesn't advance and the age gate would compare
    # against a stale anchor. clock_timestamp() always reflects real time
    # and behaves identically in production (where this helper runs in a
    # short-lived request transaction).
    result = await db.execute(
        text(
            """
            UPDATE matches
               SET status = 'finished',
                   finished_at = clock_timestamp()
             WHERE id = :match_id
               AND status = 'ongoing'
               AND started_at < clock_timestamp() - make_interval(secs => :min_age_seconds)
            """
        ),
        {"match_id": match_id, "min_age_seconds": min_age_seconds},
    )
    db.expire_all()
    return result.rowcount > 0


def leaderboard_order_by_str(sort_assoc: list[tuple[str, str]] | None) -> str | None:
    valid_columns = [
        'rank',
        'display_name',
        'user_id',
        'points',
        'total_games',
        'wins',
        'losses',
        'goals_scored',
        'goals_conceded',
        'goal_difference',
        'max_streak',
        'current_streak',
        'xp',
        'level',
    ]
    return get_order_by_str(sort_assoc, valid_columns)


async def get_leaderboard_paginated(
        db: AsyncSession,
        player_id: int | None = None,
        limit: int = 20,
        page: int = 0,
        sort_assoc: list[tuple[str, str]] | None = None
) -> dict | None:
    offset = page * limit
    default_sort_string = """
xp DESC,
points DESC,
goal_difference DESC,
goals_scored DESC,
user_id ASC
    """
    sort_string = leaderboard_order_by_str(sort_assoc)
    sort_string = sort_string if sort_string is not None else default_sort_string
    # `rank` is the OUTPUT of ROW_NUMBER; it can't be referenced inside its own
    # ORDER BY. When the user requests `order=rank:...`, fall back to the default
    # sort for the ROW_NUMBER computation. Result-list ordering still honors
    # `sort_string` (so `order=rank:desc` returns lowest-ranked rows first).
    row_number_sort = (
        default_sort_string if 'rank' in sort_string.lower() else sort_string
    )
    statement = text(f"""
WITH all_matches AS
(
    SELECT
        id AS match_id
        , player1_id
        , player2_id
        , winner_id
        , score_p1
        , score_p2
        , status
    FROM matches
    WHERE status IS NOT NULL AND status = 'finished'
    ORDER BY match_id ASC
)
, stats_away AS
(
    SELECT
        player2_id
        AS user_id
        , count(winner_id) FILTER(WHERE player2_id = winner_id)
        AS wins
        , count(winner_id) FILTER(WHERE player1_id = winner_id)
        AS losses
        , sum(score_p2)
        AS goals_scored
        , sum(score_p1)
        AS goals_conceded
    FROM all_matches
    GROUP BY player2_id
)
, stats_home AS
(
    SELECT
        player1_id
        AS user_id
        , count(winner_id) FILTER(WHERE player1_id = winner_id)
        AS wins
        , count(winner_id) FILTER(WHERE player2_id = winner_id)
        AS losses
        , sum(score_p1)
        AS goals_scored
        , sum(score_p2)
        AS goals_conceded
    FROM all_matches
    GROUP BY player1_id
)
, stats_all AS
(
    SELECT * FROM stats_away
    UNION ALL
    SELECT * FROM stats_home
)
, user_distinct AS
(
    SELECT
        DISTINCT user_id
        AS user_id
    FROM stats_all
)
, user_count AS
(
    SELECT
        count(*) AS ranked_users
    FROM user_distinct
)
, match_streaks AS
(
    SELECT
        u.user_id
        , m.match_id
        , m.winner_id

        , SUM(CASE WHEN m.winner_id = u.user_id
                   THEN 0
                   ELSE 1
              END
          ) OVER (
            PARTITION BY u.user_id
            ORDER BY m.match_id ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )
        AS streak_group
    FROM user_distinct u
    CROSS JOIN LATERAL (
        SELECT match_id, winner_id
        FROM all_matches
        WHERE player1_id = u.user_id OR player2_id = u.user_id
        ORDER BY match_id ASC
    ) m
)
, user_win_streaks AS
(
    SELECT
        user_id
        , streak_group
        , COUNT(*) FILTER(WHERE user_id = winner_id)
        AS streak_length
        , MAX(streak_group) OVER (PARTITION BY user_id)
        AS last_group
    FROM match_streaks
    GROUP BY user_id, streak_group
)
, user_win_streak_stats AS
(
    SELECT
        user_id
        , MAX(streak_length)
        AS max_streak
        , MAX(streak_length)
               FILTER (WHERE streak_group = last_group)
        AS current_streak
    FROM user_win_streaks
    GROUP BY user_id
)
, ranked_stats AS
(
    SELECT
        users.id
        AS user_id
        , COALESCE(NULLIF(TRIM(users.display_name), ''), users.username)
        AS display_name
        , users.avatar_url
        AS avatar_url
        , sum(wins)
        AS wins
        , sum(losses)
        AS losses
        , sum(wins) + sum(losses)
        AS total_games
        , sum(goals_scored)
        AS goals_scored
        , sum(goals_conceded)
        AS goals_conceded
        , (sum(goals_scored) - sum(goals_conceded))
        AS goal_difference
        , (3 * SUM(wins))
        AS points
        , current_streak
        , max_streak
        , COALESCE(user_xp.xp, 0)
        AS xp
        , COALESCE(user_xp.level, 1)
        AS level
    FROM stats_all
        INNER JOIN users
            ON users.id = stats_all.user_id
        INNER JOIN user_win_streak_stats
            ON user_win_streak_stats.user_id = users.id
        LEFT JOIN user_xp
            ON user_xp.user_id = users.id
    GROUP BY users.id, users.display_name, users.avatar_url, current_streak, max_streak, user_xp.xp, user_xp.level
)
, ranking_results AS
(
    SELECT
        ROW_NUMBER() OVER (ORDER BY {row_number_sort})
        AS rank
        , display_name
        , user_id
        , avatar_url
        , points
        , total_games
        , wins
        , losses
        , goals_scored
        , goals_conceded
        , goal_difference
        , current_streak
        , max_streak
        , xp
        , level
    FROM ranked_stats
)
, player_stats AS
(
    SELECT
        *
    FROM ranking_results
    WHERE ((:player_id)::int IS NOT NULL AND :player_id = user_id)
)
, summary AS
(
    SELECT
        COALESCE(
            (SELECT
                jsonb_build_object(
                    'display_name', display_name,
                    'value', max_streak
                )
             FROM ranking_results
             ORDER BY max_streak DESC, {default_sort_string}
             LIMIT 1),
            jsonb_build_object(
                'display_name', 'No Data',
                'value', 0
            )
        )
        AS max_max_streak
        , COALESCE(
            (SELECT
                jsonb_build_object(
                    'display_name', display_name,
                    'value', points
                )
             FROM ranking_results
             ORDER BY points DESC, {default_sort_string}
             LIMIT 1),
            jsonb_build_object(
                'display_name', 'No Data',
                'value', 0
            )
        )
        AS max_points
        , COALESCE(
            (SELECT
                jsonb_build_object(
                    'display_name', display_name,
                    'value', current_streak
                )
             FROM ranking_results
             ORDER BY current_streak DESC, {default_sort_string}
             LIMIT 1),
            jsonb_build_object(
                'display_name', 'No Data',
                'value', 0
            )
        )
        AS max_current_streak
)
, page_ranking_results AS (
    SELECT * FROM ranking_results
    ORDER BY {sort_string}
    LIMIT :limit
    OFFSET (SELECT
               LEAST(:offset,
                     GREATEST(0, ranked_users - :limit))
            FROM user_count)
)
SELECT
    LEAST(:page,
          GREATEST(0, (((table user_count) - 1) / :limit)))
    AS page
    , GREATEST(0, (((table user_count) - 1) / :limit))
    AS last_page
    , :limit as per_page
    , (table user_count) as total
    , COALESCE(
        jsonb_agg(to_jsonb(page_ranking_results) ORDER BY {sort_string}),
        '[]'::jsonb
    )
    AS results
    , (SELECT to_jsonb(summary) FROM summary)
    AS summary
    , (SELECT to_jsonb(player_stats) FROM player_stats)
    AS player_stats
    
FROM page_ranking_results
    """)

    result = await db.execute(
        statement, {
            'offset': offset,
            'limit': limit,
            'page': page,
            'player_id': player_id,
        }
    )
    return result.mappings().one_or_none()


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
        .outerjoin(users, agg.c.user_id == users.c.id)
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

async def award_xp(user_id: int, amount: int, session: AsyncSession):
    """ caller should commit session"""
    statement = text("""
    INSERT INTO user_xp (user_id, xp)
    VALUES (:user_id, :amount)
    ON CONFLICT (user_id) DO UPDATE SET xp = user_xp.xp + :amount
    RETURNING xp
    """)
    result = await session.execute(
        statement, {'user_id': user_id, 'amount': amount}
    )
    result_victories = await victories(user_id, session)
    tournament_amount_xp = 100
    await reward_game_achievement_if_should(result_victories, user_id, session)
    xp = result.scalar_one()
    return xp


async def reward_game_achievement_if_should(
        result_victories: dict[str, int], user_id: int, session: AsyncSession):
    """ caller should commit session"""
    win_breakpoints = [1, 3, 5, 10, 25, 50, 100, 250, 500, 1000]

    # ASCIImoji icons — must stay in sync with the gamification migration
    _regular_icons = {
        1: '(•̀ᴗ•́)و', 3: 'ᕦ(ò_óˇ)ᕤ', 5: "(ง'̀-'́)ง",
        10: 'ᕙ(⇀‸↼‶)ᕗ', 25: r'\(^o^)/',
    }
    _tournament_icons = {
        1: 'ʕ•ᴥ•ʔ╯', 3: 'ʕ•̫͡•ʔ', 5: 'ʕ⊙ᴥ⊙ʔ',
    }

    regular_achievement = next((
        w_break for w_break in win_breakpoints
        if result_victories['regular_wins'] == w_break
    ), None)

    if regular_achievement is not None:
        achievement = {
            "a_key":  f'win{regular_achievement}',
            "a_name": f'win {regular_achievement} matches',
            "a_desc": f'You Won {regular_achievement} regular matches',
            "a_icon": _regular_icons.get(regular_achievement, f'({regular_achievement})'),
        }
        await insert_game_achievement(user_id, achievement, session)

    tournament_achievement = next((
        w_break for w_break in win_breakpoints
        if result_victories['tournament_wins'] == w_break
    ), None)

    if tournament_achievement is not None:
        achievement = {
            "a_key":  f'twin{tournament_achievement}',
            "a_name": f'win {tournament_achievement} tournament matches',
            "a_desc": f'You Won {tournament_achievement} tournament matches',
            "a_icon": _tournament_icons.get(tournament_achievement, f'_\\({tournament_achievement})/_'),
        }
        await insert_game_achievement(user_id, achievement, session)

    # ── New badge conditions ─────────────────────────────────────────────────
    # Consolidate the 3 matches-table COUNTs and the user_xp level lookup into
    # ONE query (4 round-trips → 1) using PostgreSQL FILTER clauses. The
    # standalone helpers (count_games, won_vs_ai, has_perfect_game) remain
    # available and tested for callers that need just one of these values.
    stats_row = (await session.execute(
        text("""
            WITH match_stats AS (
                SELECT
                    COUNT(*) FILTER (WHERE (player1_id = :uid OR player2_id = :uid)
                                     AND status = 'finished')                     AS total_games,
                    COUNT(*) FILTER (WHERE winner_id = :uid AND player2_id = 0
                                     AND status = 'finished')                     AS ai_wins,
                    COUNT(*) FILTER (WHERE winner_id = :uid AND status = 'finished'
                                     AND ((player1_id = :uid AND score_p2 = 0 AND score_p1 >= 10)
                                       OR (player2_id = :uid AND score_p1 = 0 AND score_p2 >= 10))) AS perfect_games
                FROM matches
            )
            SELECT
                ms.total_games,
                ms.ai_wins,
                ms.perfect_games,
                ux.level
            FROM match_stats ms
            LEFT JOIN user_xp ux ON ux.user_id = :uid
        """),
        {"uid": user_id},
    )).one()

    if stats_row.total_games >= 1:
        await insert_game_achievement(user_id, {
            "a_key": "first_game", "a_name": "Getting Started",
            "a_desc": "Play your first game", "a_icon": "(ง •_•)ง",
        }, session)

    if stats_row.ai_wins >= 1:
        await insert_game_achievement(user_id, {
            "a_key": "ai_conqueror", "a_name": "AI Conqueror",
            "a_desc": "Beat the AI opponent", "a_icon": "ʕっ•ᴥ•ʔっ",
        }, session)

    if stats_row.perfect_games >= 1:
        await insert_game_achievement(user_id, {
            "a_key": "perfect_game", "a_name": "Perfect Pong",
            "a_desc": "Win a game 10-0", "a_icon": "¬‿¬",
        }, session)

    if stats_row.level is not None:
        if stats_row.level >= 5:
            await insert_game_achievement(user_id, {
                "a_key": "level_5", "a_name": "Rising Star",
                "a_desc": "Reach Level 5", "a_icon": "★彡(◕‿◕)",
            }, session)
        if stats_row.level >= 10:
            await insert_game_achievement(user_id, {
                "a_key": "level_10", "a_name": "Elite Player",
                "a_desc": "Reach Level 10", "a_icon": "(ﾉ≧∀≦)ﾉ",
            }, session)


async def insert_game_achievement(
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
    RETURNING achievement_id, true as was_inserted
)
, insertion_notification AS
(
    INSERT INTO notifications (user_id, type, message)
        SELECT :user_id, 'game_achievement', :a_desc
        FROM insertion_user_achievement
        WHERE was_inserted = true
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

    return result.mappings().one_or_none()


async def victories(user_id: int, session: AsyncSession) -> dict[str, int]:
    statement = text("""
WITH matches_results AS
(
  SELECT
    winner_id
    ,count(winner_id)
    AS wins
  FROM matches
  WHERE winner_id = :user_id
  GROUP BY winner_id
)
, tournament_matches_results AS
(
  SELECT
     winner_id AS twinner_id
    ,count(winner_id)
    AS twins
  FROM tournament_matches
  WHERE winner_id = :user_id
  GROUP BY winner_id
)
SELECT
  COALESCE(wins, 0)
  AS wins_total
  , COALESCE(twins, 0)
  AS tournament_wins
  , COALESCE(wins, 0) - COALESCE(twins, 0)
  AS regular_wins
FROM matches_results
  FULL OUTER JOIN tournament_matches_results ON winner_id = twinner_id
LIMIT 1
    """)
    result = await session.execute(
        statement, {'user_id': user_id}
    )

    ret = result.mappings().one_or_none() or {
        'wins_total': 0,
        'regular_wins': 0,
        'tournament_wins': 0
    }

    return {**ret}


async def count_games(user_id: int, session: AsyncSession) -> int:
    """Total games played (won or lost) by user_id, including AI games."""
    result = await session.execute(
        text(
            "SELECT COUNT(*) FROM matches "
            "WHERE (player1_id = :uid OR player2_id = :uid) AND status = 'finished'"
        ),
        {"uid": user_id},
    )
    return result.scalar_one() or 0


async def won_vs_ai(user_id: int, session: AsyncSession) -> bool:
    """True if user has at least one win against AI (player2_id = 0)."""
    result = await session.execute(
        text(
            "SELECT COUNT(*) FROM matches "
            "WHERE winner_id = :uid AND player2_id = 0 AND status = 'finished'"
        ),
        {"uid": user_id},
    )
    return (result.scalar_one() or 0) >= 1


async def has_perfect_game(user_id: int, session: AsyncSession) -> bool:
    """True if user has won any match 10-0 (winner scored ≥10, opponent scored 0).

    The badge description in the achievements catalog says "Win a game 10-0",
    so the implementation enforces both halves: the opponent must be shut out
    AND the winner must have reached the standard 10-point Pong score.
    """
    result = await session.execute(
        text(
            "SELECT COUNT(*) FROM matches "
            "WHERE winner_id = :uid AND status = 'finished' "
            "AND ("
            "  (player1_id = :uid AND score_p2 = 0 AND score_p1 >= 10) OR "
            "  (player2_id = :uid AND score_p1 = 0 AND score_p2 >= 10)"
            ")"
        ),
        {"uid": user_id},
    )
    return (result.scalar_one() or 0) >= 1


async def get_achievements_for_user(user_id: int, session: AsyncSession) -> list[dict]:
    """Return full achievement catalog with per-user earned status, sorted earned-first."""
    result = await session.execute(
        text("""
            SELECT
                a.key,
                a.name,
                a.description,
                a.icon,
                (ua.user_id IS NOT NULL)      AS earned,
                ua.earned_at
            FROM achievements a
            LEFT JOIN user_achievements ua
                ON ua.achievement_id = a.id AND ua.user_id = :uid
            ORDER BY
                earned DESC,
                ua.earned_at DESC NULLS LAST,
                a.key ASC
        """),
        {"uid": user_id},
    )
    return [dict(row) for row in result.mappings()]


async def get_xp_for_user(user_id: int, session: AsyncSession) -> dict | None:
    """Return XP row for user, or None if user has never played."""
    result = await session.execute(
        text("SELECT user_id, xp, level FROM user_xp WHERE user_id = :uid"),
        {"uid": user_id},
    )
    row = result.mappings().one_or_none()
    if row is None:
        return None
    return {
        "user_id": row["user_id"],
        "xp": row["xp"],
        "level": row["level"],
        "xp_in_level": row["xp"] % 100,
        "xp_to_next_level": 100,
    }


# async def get_leaderboard_paginated(
#     db: AsyncSession,
#     limit: int = 20,
#     page: int = 0,
#     sort_assoc: list[tuple[str, str]] | None = None,
# ) -> dict:
#     """Return paginated leaderboard with streak metadata and summary stats."""
#     per_page = max(int(limit or 20), 1)
#     page_number = max(int(page or 0), 0)
#     sort_assoc = sort_assoc or []

#     finished_cond = (Match.status == "finished", Match.finished_at.is_not(None))

#     p1 = select(
#         Match.player1_id.label("user_id"),
#         Match.score_p1.label("goals_scored"),
#         Match.score_p2.label("goals_conceded"),
#         case((Match.winner_id == Match.player1_id, 1), else_=0).label("is_win"),
#     ).where(*finished_cond)

#     p2 = select(
#         Match.player2_id.label("user_id"),
#         Match.score_p2.label("goals_scored"),
#         Match.score_p1.label("goals_conceded"),
#         case((Match.winner_id == Match.player2_id, 1), else_=0).label("is_win"),
#     ).where(*finished_cond)

#     combined = union_all(p1, p2).subquery()

#     agg = (
#         select(
#             combined.c.user_id,
#             func.sum(combined.c.is_win).label("wins"),
#             func.sum(1 - combined.c.is_win).label("losses"),
#             func.count(combined.c.user_id).label("total_games"),
#             func.sum(combined.c.goals_scored).label("goals_scored"),
#             func.sum(combined.c.goals_conceded).label("goals_conceded"),
#             (
#                 func.sum(combined.c.goals_scored) - func.sum(combined.c.goals_conceded)
#             ).label("goal_difference"),
#             (func.sum(combined.c.is_win) * 3).label("points"),
#         )
#         .group_by(combined.c.user_id)
#         .subquery()
#     )

#     users = table(
#         "users",
#         column("id", Integer),
#         column("username", String),
#         column("display_name", String),
#     )

#     agg_stmt = (
#         select(
#             agg.c.user_id,
#             agg.c.wins,
#             agg.c.losses,
#             agg.c.total_games,
#             agg.c.goals_scored,
#             agg.c.goals_conceded,
#             agg.c.goal_difference,
#             agg.c.points,
#             users.c.username,
#             users.c.display_name,
#         )
#         .outerjoin(users, agg.c.user_id == users.c.id)
#     )
#     agg_rows = [dict(row) for row in (await db.execute(agg_stmt)).mappings().all()]

#     streak_stmt = (
#         select(
#             Match.id,
#             Match.player1_id,
#             Match.player2_id,
#             Match.winner_id,
#             Match.finished_at,
#         )
#         .where(*finished_cond)
#         .order_by(Match.finished_at.asc(), Match.id.asc())
#     )
#     streak_rows = (await db.execute(streak_stmt)).mappings().all()

#     streak_by_user: dict[int, dict[str, int]] = {}
#     for row in streak_rows:
#         for player_id, won in (
#             (row["player1_id"], row["winner_id"] == row["player1_id"]),
#             (row["player2_id"], row["winner_id"] == row["player2_id"]),
#         ):
#             if player_id is None:
#                 continue
#             user_streak = streak_by_user.setdefault(
#                 int(player_id), {"current_streak": 0, "max_streak": 0}
#             )
#             user_streak["current_streak"] = (
#                 user_streak["current_streak"] + 1 if won else 0
#             )
#             user_streak["max_streak"] = max(
#                 user_streak["max_streak"], user_streak["current_streak"]
#             )

#     rows: list[dict] = []
#     for row in agg_rows:
#         user_id = int(row["user_id"])
#         streak = streak_by_user.get(user_id, {"current_streak": 0, "max_streak": 0})
#         rows.append(
#             {
#                 "user_id": user_id,
#                 "display_name": row.get("display_name") or row.get("username") or f"User {user_id}",
#                 "wins": int(row["wins"] or 0),
#                 "losses": int(row["losses"] or 0),
#                 "total_games": int(row["total_games"] or 0),
#                 "goals_scored": int(row["goals_scored"] or 0),
#                 "goals_conceded": int(row["goals_conceded"] or 0),
#                 "goal_difference": int(row["goal_difference"] or 0),
#                 "points": int(row["points"] or 0),
#                 "max_streak": int(streak["max_streak"]),
#                 "current_streak": int(streak["current_streak"]),
#             }
#         )

#     rows.sort(
#         key=lambda item: (
#             -item["points"],
#             -item["goal_difference"],
#             -item["goals_scored"],
#             item["user_id"],
#         )
#     )
#     for idx, row in enumerate(rows, start=1):
#         row["rank"] = idx

#     sortable_fields = {
#         "rank",
#         "wins",
#         "losses",
#         "points",
#         "user_id",
#         "max_streak",
#         "total_games",
#         "display_name",
#         "goals_scored",
#         "current_streak",
#         "goals_conceded",
#         "goal_difference",
#     }
#     valid_sorts = [
#         (field, direction)
#         for field, direction in sort_assoc
#         if field in sortable_fields and direction in {"ASC", "DESC"}
#     ]
#     if valid_sorts:
#         for field, direction in reversed(valid_sorts):
#             reverse = direction == "DESC"
#             if field == "display_name":
#                 rows.sort(key=lambda item: item[field].lower(), reverse=reverse)
#             else:
#                 rows.sort(key=lambda item: item[field], reverse=reverse)

#     def _summary_item(field: str) -> dict:
#         if not rows:
#             return {"value": 0, "display_name": "No Data"}
#         best = max(rows, key=lambda item: item[field])
#         return {"value": int(best[field]), "display_name": best["display_name"]}

#     total = len(rows)
#     last_page = max((total - 1) // per_page, 0) if total else 0
#     start = page_number * per_page
#     end = start + per_page
#     paged_rows = rows[start:end] if start < total else []

#     return {
#         "page": page_number,
#         "last_page": last_page,
#         "per_page": per_page,
#         "total": total,
#         "results": paged_rows,
#         "summary": {
#             "max_points": _summary_item("points"),
#             "max_max_streak": _summary_item("max_streak"),
#             "max_current_streak": _summary_item("current_streak"),
#         },
#     }

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
    """User withdraws from a tournament in progress.
    
    Returns (tournament, tournament_complete).
    """
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

    await db.delete(participant)
    await db.flush()
    
    # Check if tournament should be marked complete
    # (all remaining participants are no longer actively playing)
    remaining_participants_result = await db.execute(
        select(TournamentParticipant).where(
            TournamentParticipant.tournament_id == tournament_id
        )
    )
    remaining_participants = list(remaining_participants_result.scalars().all())
    
    tournament_complete = False
    if not remaining_participants:
        tournament.status = "complete"
        tournament_complete = True
    
    await db.commit()
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
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == tournament_id)
    )
    participants = list(participants_result.scalars().all())
    matches_result = await db.execute(
        select(TournamentMatch).where(TournamentMatch.tournament_id == tournament_id)
    )
    matches = list(matches_result.scalars().all())
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

    random.shuffle(participants)

    tournament_matches: list[TournamentMatch] = []
    num_matches = tournament.max_participants // 2
    for i in range(num_matches):
        p1 = participants[i * 2]
        p2 = participants[i * 2 + 1]

        match = Match(
            player1_id=p1.user_id,
            player2_id=p2.user_id,
            status="ongoing",
            started_at=datetime.now(timezone.utc),
        )
        db.add(match)
        await db.flush()

        tm = TournamentMatch(
            tournament_id=tournament_id,
            match_id=match.id,
            round=1,
            position=i,
            player1_id=p1.user_id,
            player2_id=p2.user_id,
            status="pending",
        )
        db.add(tm)
        tournament_matches.append(tm)

    tournament.status = "in_progress"
    await db.commit()
    for tm in tournament_matches:
        await db.refresh(tm)
    await db.refresh(tournament)
    return tournament, tournament_matches


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
    await db.flush()
    await award_xp(winner_id, 10, db)
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
    """Record the winner of a tournament match and advance the bracket.

    Returns (tournament, tournament_complete).
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
    current_round = tm.round
    round_result = await db.execute(
        select(TournamentMatch)
        .where(
            TournamentMatch.tournament_id == tournament_id,
            TournamentMatch.round == current_round,
        )
        .order_by(TournamentMatch.position)
    )
    round_matches = list(round_result.scalars().all())

    tournament_complete = False
    if all(rm.status == "finished" for rm in round_matches):
        if len(round_matches) == 1:
            tournament.status = "complete"
            tournament_complete = True
        else:
            for i in range(len(round_matches) // 2):
                w1 = round_matches[i * 2].winner_id
                w2 = round_matches[i * 2 + 1].winner_id
                new_match = Match(
                    player1_id=w1,
                    player2_id=w2,
                    status="ongoing",
                    started_at=datetime.now(timezone.utc),
                )
                db.add(new_match)
                await db.flush()
                new_tm = TournamentMatch(
                    tournament_id=tournament_id,
                    match_id=new_match.id,
                    round=current_round + 1,
                    position=i,
                    player1_id=w1,
                    player2_id=w2,
                    status="pending",
                )
                db.add(new_tm)

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

def leaderboard_order_by_str(sort_assoc: list[tuple[str, str]] | None) -> str | None:
    if sort_assoc is None:
        return None
    valid_columns = [
        'rank',
        'display_name',
        'points',
        'total_games',
        'wins',
        'losses',
        'goals_scored',
        'goals_conceded',
        'goal_difference',
        'max_streak',
        'current_streak'
    ]
    order_columns = []
    for (sort_key, order) in sort_assoc:
        norm_order = 'DESC' if order.upper() == 'DESC' else 'ASC'
        norm_key = sort_key.lower() if sort_key.lower() in valid_columns else None
        if norm_key is not None:
            order_columns.append(f"{norm_key} {norm_order}")
    result = ', '.join(order_columns) if len(order_columns) > 0 else None
    return result


async def get_leaderboard_paginated(
        db: AsyncSession,
        limit: int = 20,
        page: int = 0,
        sort_assoc: list[tuple[str, str]] | None = None
) -> dict | None:
    offset = page * limit
    default_sort_string = """
points DESC,
goal_difference DESC,
goals_scored DESC,
user_id ASC
    """
    sort_string = leaderboard_order_by_str(sort_assoc)
    sort_string = sort_string if sort_string is not None else default_sort_string
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
        , COALESCE(users.display_name, users.username)
        AS display_name
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
    FROM stats_all
        INNER JOIN users
            ON users.id = stats_all.user_id
        INNER JOIN user_win_streak_stats
            ON user_win_streak_stats.user_id = users.id
    GROUP BY users.id, users.display_name, current_streak, max_streak
)
, ranking_results AS
(
    SELECT
        ROW_NUMBER() OVER (ORDER BY {default_sort_string})
        AS rank
        , display_name
        , user_id
        , points
        , total_games
        , wins
        , losses
        , goals_scored
        , goals_conceded
        , goal_difference
        , current_streak
        , max_streak
    FROM ranked_stats
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
             ORDER BY {default_sort_string}
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
    LEAST(:page, (((table user_count) - 1) / :limit))
    AS page
    , (((table user_count) - 1) / :limit)
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
FROM page_ranking_results
    """)

    result = await db.execute(
        statement, {'offset': offset, 'limit': limit, 'page': page}
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

    regular_achievement = next((
        w_break for w_break in win_breakpoints
        if result_victories['regular_wins'] == w_break
    ), None)

    if regular_achievement is not None:
        achievement = {
            "a_key": f'win{regular_achievement}',
            "a_name": f'win {regular_achievement} matches',
            "a_desc": f'You Won {regular_achievement} regular matches',
            "a_icon": f'({regular_achievement})'
        }
        await insert_game_achievement(user_id, achievement, session)

    tournament_achievement = next((
        w_break for w_break in win_breakpoints
        if result_victories['tournament_wins'] == w_break
    ), None)

    if tournament_achievement is not None:
        achievement = {
            "a_key": f'twin{tournament_achievement}',
            "a_name": f'win {tournament_achievement} tournament matches',
            "a_desc": f'You Won {tournament_achievement} tournament matches',
            "a_icon": f'_\({tournament_achievement})/_'
        }
        await insert_game_achievement(user_id, achievement, session)


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
    RETURNING achievement_id
)
, insertion_notification AS
(
    INSERT INTO notifications (user_id, type, message)
        VALUES (:user_id, 'game_achievement', :a_desc)
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

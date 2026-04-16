import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from shared.config.settings import settings
from persistence import (
    InvalidWinner,
    TournamentMatchAlreadyFinished,
    TournamentMatchNotFound,
    TournamentNotFound,
    create_match,
    create_tournament,
    finish_match,
    get_leaderboard,
    get_match,
    get_tournament_with_participants,
    get_user_matches,
    get_user_stats,
    join_tournament,
    record_tournament_match_result,
    start_tournament,
)


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE TABLE tournament_matches, tournament_participants, "
                "tournaments, matches RESTART IDENTITY CASCADE"
            )
        )
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
    await engine.dispose()


async def _setup_tournament(db, max_participants: int):
    tournament = await create_tournament(db, name="t", creator_id=1, max_participants=max_participants)
    # Note: create_tournament() already adds creator (uid=1) as a participant
    # So we only need to add remaining participants (2 through max_participants)
    statement = text("""
SELECT
    DISTINCT id
FROM users
WHERE
    NOT id = 1
ORDER BY id DESC
LIMIT :limit
    """)
    result = await db.execute(statement, {'limit': max_participants - 1})
    data = result.all()
    for uid in data:
        await join_tournament(db, tournament.id, uid[0])
    _, matches = await start_tournament(db, tournament.id, user_id=1)
    return tournament, matches


@pytest.mark.asyncio
async def test_create_match_inserts_row(db):
    match = await create_match(db, player1_id=1, player2_id=2)
    assert match.id is not None
    assert match.player1_id == 1
    assert match.player2_id == 2
    assert match.status == "ongoing"
    assert match.winner_id is None
    assert match.started_at is not None


@pytest.mark.asyncio
async def test_get_match_returns_row(db):
    match = await create_match(db, player1_id=1, player2_id=2)
    fetched = await get_match(db, match.id)
    assert fetched is not None
    assert fetched.id == match.id


@pytest.mark.asyncio
async def test_get_match_returns_none_for_unknown_id(db):
    result = await get_match(db, 99999)
    assert result is None


@pytest.mark.asyncio
async def test_finish_match_updates_row(db):
    match = await create_match(db, player1_id=1, player2_id=2)
    finished = await finish_match(db, match.id, winner_id=1, score_p1=7, score_p2=3)
    assert finished.status == "finished"
    assert finished.winner_id == 1
    assert finished.score_p1 == 7
    assert finished.score_p2 == 3
    assert finished.finished_at is not None


@pytest.mark.asyncio
async def test_finish_match_returns_none_for_unknown_id(db):
    result = await finish_match(db, 99999, winner_id=1, score_p1=7, score_p2=3)
    assert result is None


@pytest.mark.asyncio
async def test_get_user_stats_empty(db):
    stats = await get_user_stats(db, user_id=42)
    assert stats["wins"] == 0
    assert stats["losses"] == 0
    assert stats["total_games"] == 0
    assert stats["goals_scored"] == 0
    assert stats["goals_conceded"] == 0


@pytest.mark.asyncio
async def test_get_user_stats_counts_correctly(db):
    # player 1 wins one, loses one
    m1 = await create_match(db, player1_id=1, player2_id=2)
    await finish_match(db, m1.id, winner_id=1, score_p1=7, score_p2=3)

    m2 = await create_match(db, player1_id=1, player2_id=2)
    await finish_match(db, m2.id, winner_id=2, score_p1=2, score_p2=7)

    stats = await get_user_stats(db, user_id=1)
    assert stats["wins"] == 1
    assert stats["losses"] == 1
    assert stats["total_games"] == 2
    assert stats["goals_scored"] == 9   # 7 + 2
    assert stats["goals_conceded"] == 10  # 3 + 7


@pytest.mark.asyncio
async def test_get_user_stats_excludes_ongoing_matches(db):
    await create_match(db, player1_id=1, player2_id=2)  # not finished
    stats = await get_user_stats(db, user_id=1)
    assert stats["total_games"] == 0


@pytest.mark.asyncio
async def test_get_user_matches_returns_newest_first(db):
    m1 = await create_match(db, player1_id=1, player2_id=2)
    m2 = await create_match(db, player1_id=1, player2_id=3)
    matches = await get_user_matches(db, user_id=1)
    assert len(matches) == 2
    assert matches[0].id == m2.id  # newest first


@pytest.mark.asyncio
async def test_get_user_matches_returns_empty_for_unknown_user(db):
    matches = await get_user_matches(db, user_id=99999)
    assert matches == []


@pytest.mark.asyncio
async def test_get_user_stats_counts_goals_as_player2(db):
    # user 2 is player2 in this match
    m = await create_match(db, player1_id=1, player2_id=2)
    await finish_match(db, m.id, winner_id=2, score_p1=3, score_p2=7)

    stats = await get_user_stats(db, user_id=2)
    assert stats["wins"] == 1
    assert stats["goals_scored"] == 7
    assert stats["goals_conceded"] == 3


@pytest.mark.asyncio
async def test_get_leaderboard_orders_by_points_then_goal_difference(db):
    m1 = await create_match(db, player1_id=1, player2_id=2)
    await finish_match(db, m1.id, winner_id=1, score_p1=7, score_p2=3)

    m2 = await create_match(db, player1_id=2, player2_id=3)
    await finish_match(db, m2.id, winner_id=2, score_p1=6, score_p2=1)

    m3 = await create_match(db, player1_id=1, player2_id=3)
    await finish_match(db, m3.id, winner_id=1, score_p1=5, score_p2=0)

    leaderboard = await get_leaderboard(db)

    assert len(leaderboard) == 3
    assert leaderboard[0]["user_id"] == 1
    assert leaderboard[0]["points"] == 6
    assert leaderboard[0]["rank"] == 1

    assert leaderboard[1]["user_id"] == 2
    assert leaderboard[1]["points"] == 3
    assert leaderboard[1]["goal_difference"] == 1
    assert leaderboard[1]["rank"] == 2

    assert leaderboard[2]["user_id"] == 3
    assert leaderboard[2]["points"] == 0
    assert leaderboard[2]["rank"] == 3


@pytest.mark.asyncio
async def test_record_match_result_marks_finished_and_no_advance_when_round_incomplete(db):
    tournament, r1 = await _setup_tournament(db, 4)
    first = r1[0]
    _, complete = await record_tournament_match_result(
        db, tournament.id, first.match_id, winner_id=first.player1_id
    )
    assert complete is False
    _, _, all_matches = await get_tournament_with_participants(db, tournament.id)
    finished = [m for m in all_matches if m.status == "finished"]
    assert len(finished) == 1
    assert finished[0].winner_id == first.player1_id
    # No new round yet
    assert all(m.round == 1 for m in all_matches)


@pytest.mark.asyncio
async def test_record_match_result_persists_scores_on_match_row(db):
    tournament, r1 = await _setup_tournament(db, 4)
    first = r1[0]
    await record_tournament_match_result(
        db, tournament.id, first.match_id, winner_id=first.player1_id, score_p1=7, score_p2=3
    )
    match = await get_match(db, first.match_id)
    assert match.status == "finished"
    assert match.winner_id == first.player1_id
    assert match.score_p1 == 7
    assert match.score_p2 == 3


@pytest.mark.asyncio
async def test_record_match_result_advances_to_next_round_when_round_complete(db):
    tournament, r1 = await _setup_tournament(db, 4)
    winners = [m.player1_id for m in r1]
    for m in r1:
        await record_tournament_match_result(db, tournament.id, m.match_id, m.player1_id)

    _, _, all_matches = await get_tournament_with_participants(db, tournament.id)
    round2 = [m for m in all_matches if m.round == 2]
    assert len(round2) == 1
    assert {round2[0].player1_id, round2[0].player2_id} == set(winners)
    assert round2[0].status == "pending"


@pytest.mark.asyncio
async def test_record_match_result_completes_tournament_on_final(db):
    tournament, r1 = await _setup_tournament(db, 4)
    for m in r1:
        await record_tournament_match_result(db, tournament.id, m.match_id, m.player1_id)
    _, _, all_matches = await get_tournament_with_participants(db, tournament.id)
    final = next(m for m in all_matches if m.round == 2)
    _, complete = await record_tournament_match_result(
        db, tournament.id, final.match_id, winner_id=final.player1_id
    )
    assert complete is True
    t, _, _ = await get_tournament_with_participants(db, tournament.id)
    assert t.status == "complete"


@pytest.mark.asyncio
async def test_record_match_result_8_player_full_bracket(db):
    tournament, r1 = await _setup_tournament(db, 8)
    for m in r1:
        await record_tournament_match_result(db, tournament.id, m.match_id, m.player1_id)
    _, _, all_matches = await get_tournament_with_participants(db, tournament.id)
    r2 = [m for m in all_matches if m.round == 2]
    assert len(r2) == 2
    for m in r2:
        await record_tournament_match_result(db, tournament.id, m.match_id, m.player1_id)
    _, _, all_matches = await get_tournament_with_participants(db, tournament.id)
    r3 = [m for m in all_matches if m.round == 3]
    assert len(r3) == 1
    _, complete = await record_tournament_match_result(
        db, tournament.id, r3[0].match_id, winner_id=r3[0].player1_id
    )
    assert complete is True
    t, _, _ = await get_tournament_with_participants(db, tournament.id)
    assert t.status == "complete"


@pytest.mark.asyncio
async def test_record_match_result_invalid_winner(db):
    tournament, r1 = await _setup_tournament(db, 4)
    with pytest.raises(InvalidWinner):
        await record_tournament_match_result(db, tournament.id, r1[0].match_id, winner_id=99999)


@pytest.mark.asyncio
async def test_record_match_result_already_finished(db):
    tournament, r1 = await _setup_tournament(db, 4)
    await record_tournament_match_result(db, tournament.id, r1[0].match_id, r1[0].player1_id)
    with pytest.raises(TournamentMatchAlreadyFinished):
        await record_tournament_match_result(db, tournament.id, r1[0].match_id, r1[0].player1_id)


@pytest.mark.asyncio
async def test_record_match_result_unknown_tournament(db):
    with pytest.raises(TournamentNotFound):
        await record_tournament_match_result(db, 99999, 1, winner_id=1)


@pytest.mark.asyncio
async def test_record_match_result_match_not_in_tournament(db):
    tournament, _ = await _setup_tournament(db, 4)
    other = await create_match(db, player1_id=50, player2_id=51)
    with pytest.raises(TournamentMatchNotFound):
        await record_tournament_match_result(db, tournament.id, other.id, winner_id=50)


@pytest.mark.asyncio
async def test_get_leaderboard_applies_limit(db):
    for user_id in (1, 2, 3):
        match = await create_match(db, player1_id=user_id, player2_id=99)
        await finish_match(db, match.id, winner_id=user_id, score_p1=3, score_p2=0)

    leaderboard = await get_leaderboard(db, limit=2)
    assert len(leaderboard) == 2

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from persistence import (
    TournamentMatchAlreadyFinished,
    TournamentNotInProgress,
    TournamentNotParticipant,
    TournamentNotFound,
    TournamentMatchNotFound,
    InvalidWinner,
    create_match,
    create_tournament,
    finish_match,
    get_leaderboard,
    get_match,
    get_tournament_with_participants,
    get_user_matches,
    get_user_stats,
    join_tournament,
    leave_tournament,
    record_tournament_match_result,
    start_tournament,
    withdraw_tournament,
)
from shared.config.settings import settings
from service.models.match import Match


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE TABLE tournament_matches, tournament_participants, "
                "tournaments, matches, users, credentials RESTART IDENTITY CASCADE"
            )
        )
        for uid in range(1, 9):
            cid = uid + 10000
            await conn.execute(
                text(
                    "INSERT INTO credentials (id, username, password) "
                    "VALUES (:id, :username, 'fake')"
                ),
                {"id": cid, "username": f"cred_{uid}"},
            )
            await conn.execute(
                text(
                    "INSERT INTO users (id, username, credential_id) "
                    "VALUES (:id, :username, :cid)"
                ),
                {"id": uid, "username": f"user{uid}", "cid": cid},
            )

    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session

    await engine.dispose()


async def _setup_tournament(db: AsyncSession, max_participants: int = 4):
    tournament = await create_tournament(db, name="cup", creator_id=1, max_participants=max_participants)
    for uid in range(2, max_participants + 1):
        await join_tournament(db, tournament.id, uid)
    tournament, matches = await start_tournament(db, tournament.id, user_id=1)
    return tournament, matches


async def _get_matches(db: AsyncSession, tournament_id: int):
    data = await get_tournament_with_participants(db, tournament_id)
    assert data is not None
    _, _, matches = data
    return matches


@pytest.mark.asyncio
async def test_create_match_inserts_row(db):
    match = await create_match(db, 1, 2)
    assert match.id is not None
    assert match.player1_id == 1
    assert match.player2_id == 2
    assert match.status == "ongoing"


@pytest.mark.asyncio
async def test_get_match_returns_row(db):
    created = await create_match(db, 1, 2)
    fetched = await get_match(db, created.id)
    assert fetched is not None
    assert fetched.id == created.id


@pytest.mark.asyncio
async def test_get_match_returns_none_for_unknown_id(db):
    assert await get_match(db, 999999) is None


@pytest.mark.asyncio
async def test_finish_match_updates_row(db):
    created = await create_match(db, 1, 2)
    finished = await finish_match(db, created.id, winner_id=1, score_p1=5, score_p2=2)
    assert finished is not None
    assert finished.winner_id == 1
    assert finished.score_p1 == 5
    assert finished.score_p2 == 2
    assert finished.status == "finished"
    assert finished.finished_at is not None


@pytest.mark.asyncio
async def test_finish_match_returns_none_for_unknown_id(db):
    assert await finish_match(db, 999999, winner_id=1, score_p1=1, score_p2=0) is None


@pytest.mark.asyncio
async def test_get_user_stats_empty(db):
    stats = await get_user_stats(db, 1)
    assert stats["wins"] == 0
    assert stats["losses"] == 0
    assert stats["total_games"] == 0
    assert stats["goals_scored"] == 0
    assert stats["goals_conceded"] == 0


@pytest.mark.asyncio
async def test_get_user_stats_counts_correctly(db):
    m1 = await create_match(db, 1, 2)
    await finish_match(db, m1.id, winner_id=1, score_p1=5, score_p2=2)

    m2 = await create_match(db, 1, 3)
    await finish_match(db, m2.id, winner_id=3, score_p1=1, score_p2=4)

    stats = await get_user_stats(db, 1)
    assert stats["wins"] == 1
    assert stats["losses"] == 1
    assert stats["total_games"] == 2
    assert stats["goals_scored"] == 6
    assert stats["goals_conceded"] == 6


@pytest.mark.asyncio
async def test_get_user_stats_excludes_ongoing_matches(db):
    await create_match(db, 1, 2)
    stats = await get_user_stats(db, 1)
    assert stats["total_games"] == 0


@pytest.mark.asyncio
async def test_get_user_matches_returns_newest_first(db):
    m1 = await create_match(db, 1, 2)
    m2 = await create_match(db, 3, 1)
    matches = await get_user_matches(db, 1)
    assert [m.id for m in matches][:2] == [m2.id, m1.id]


@pytest.mark.asyncio
async def test_get_user_stats_counts_goals_as_player2(db):
    created = await create_match(db, 2, 1)
    await finish_match(db, created.id, winner_id=1, score_p1=3, score_p2=6)
    stats = await get_user_stats(db, 1)
    assert stats["wins"] == 1
    assert stats["goals_scored"] == 6
    assert stats["goals_conceded"] == 3


@pytest.mark.asyncio
async def test_get_leaderboard_orders_by_points_then_goal_difference(db):
    m1 = await create_match(db, 1, 2)
    await finish_match(db, m1.id, winner_id=1, score_p1=5, score_p2=2)
    m2 = await create_match(db, 3, 4)
    await finish_match(db, m2.id, winner_id=3, score_p1=3, score_p2=0)
    m3 = await create_match(db, 1, 3)
    await finish_match(db, m3.id, winner_id=3, score_p1=1, score_p2=2)

    leaderboard = await get_leaderboard(db)
    assert leaderboard[0]["user_id"] == 3
    assert leaderboard[1]["user_id"] == 1


@pytest.mark.asyncio
async def test_get_leaderboard_applies_limit(db):
    for uid in range(1, 6):
        created = await create_match(db, uid, 6)
        await finish_match(db, created.id, winner_id=uid, score_p1=1, score_p2=0)

    leaderboard = await get_leaderboard(db, limit=3)
    assert len(leaderboard) == 3


@pytest.mark.asyncio
async def test_start_tournament_creates_round_robin_matches_for_four_players(db):
    tournament, matches = await _setup_tournament(db, 4)
    assert tournament.status == "in_progress"
    assert len(matches) == 6
    assert sum(1 for m in matches if m.status == "in_progress") == 2
    assert sum(1 for m in matches if m.status == "pending") == 4


@pytest.mark.asyncio
async def test_start_tournament_creates_all_unique_pairs_for_four_players(db):
    _, matches = await _setup_tournament(db, 4)
    pairings = {tuple(sorted((m.player1_id, m.player2_id))) for m in matches}
    assert len(pairings) == 6
    assert pairings == {
        (1, 2), (1, 3), (1, 4),
        (2, 3), (2, 4), (3, 4),
    }


@pytest.mark.asyncio
async def test_record_tournament_result_marks_match_finished_and_assigns_new_available_match(db):
    tournament, matches = await _setup_tournament(db, 4)
    first_active = next(m for m in matches if m.status == "in_progress")

    _, complete, newly_assigned = await record_tournament_match_result(
        db,
        tournament.id,
        first_active.match_id,
        winner_id=first_active.player1_id,
        score_p1=7,
        score_p2=3,
    )

    assert complete is False
    assert isinstance(newly_assigned, list)

    all_matches = await _get_matches(db, tournament.id)
    finished = [m for m in all_matches if m.status == "finished"]
    in_progress = [m for m in all_matches if m.status == "in_progress"]

    assert len(finished) == 1
    assert finished[0].winner_id == first_active.player1_id
    # With the current sequential round-robin assignment logic, one match remains active.
    assert len(in_progress) == 1


@pytest.mark.asyncio
async def test_record_tournament_result_persists_scores_on_match_row_and_response(db):
    tournament, matches = await _setup_tournament(db, 4)
    first_active = next(m for m in matches if m.status == "in_progress")

    await record_tournament_match_result(
        db,
        tournament.id,
        first_active.match_id,
        winner_id=first_active.player1_id,
        score_p1=7,
        score_p2=3,
    )

    match = await get_match(db, first_active.match_id)
    assert match is not None
    assert match.score_p1 == 7
    assert match.score_p2 == 3
    assert match.status == "finished"

    all_matches = await _get_matches(db, tournament.id)
    updated = next(m for m in all_matches if m.id == first_active.id)
    assert updated.score_p1 == 7
    assert updated.score_p2 == 3


@pytest.mark.asyncio
async def test_record_tournament_result_completes_round_robin_tournament_after_all_matches(db):
    tournament, matches = await _setup_tournament(db, 4)

    while True:
        current = await _get_matches(db, tournament.id)
        active = [m for m in current if m.status == "in_progress"]
        if not active:
            break
        for match in active:
            await record_tournament_match_result(
                db,
                tournament.id,
                match.match_id,
                winner_id=match.player1_id,
                score_p1=5,
                score_p2=2,
            )

    data = await get_tournament_with_participants(db, tournament.id)
    assert data is not None
    updated_tournament, _, updated_matches = data
    assert updated_tournament.status == "complete"
    assert all(m.status == "finished" for m in updated_matches)


@pytest.mark.asyncio
async def test_record_tournament_result_invalid_winner(db):
    tournament, matches = await _setup_tournament(db, 4)
    active = next(m for m in matches if m.status == "in_progress")
    with pytest.raises(InvalidWinner):
        await record_tournament_match_result(db, tournament.id, active.match_id, winner_id=999)


@pytest.mark.asyncio
async def test_record_tournament_result_already_finished(db):
    tournament, matches = await _setup_tournament(db, 4)
    active = next(m for m in matches if m.status == "in_progress")
    await record_tournament_match_result(db, tournament.id, active.match_id, active.player1_id)
    with pytest.raises(TournamentMatchAlreadyFinished):
        await record_tournament_match_result(db, tournament.id, active.match_id, active.player1_id)


@pytest.mark.asyncio
async def test_record_tournament_result_unknown_tournament(db):
    with pytest.raises(TournamentNotFound):
        await record_tournament_match_result(db, 999999, 1, 1)


@pytest.mark.asyncio
async def test_record_tournament_result_match_not_in_tournament(db):
    tournament, _ = await _setup_tournament(db, 4)
    with pytest.raises(TournamentMatchNotFound):
        await record_tournament_match_result(db, tournament.id, 999999, 1)


@pytest.mark.asyncio
async def test_withdraw_tournament_forfeits_current_and_future_matches_for_user(db):
    tournament, matches = await _setup_tournament(db, 4)
    withdrawing_user = next(m.player1_id for m in matches if m.status == "in_progress")

    updated_tournament, complete, newly_assigned = await withdraw_tournament(
        db, tournament.id, withdrawing_user
    )

    assert updated_tournament.id == tournament.id
    assert isinstance(complete, bool)
    assert isinstance(newly_assigned, list)

    data = await get_tournament_with_participants(db, tournament.id)
    assert data is not None
    _, participants, updated_matches = data

    participant_ids = {p.user_id for p in participants}
    assert withdrawing_user not in participant_ids

    affected = [
        m for m in updated_matches
        if withdrawing_user in (m.player1_id, m.player2_id)
    ]
    assert affected
    assert all(m.status == "finished" for m in affected)


@pytest.mark.asyncio
async def test_withdraw_tournament_raises_for_non_participant(db):
    tournament, _ = await _setup_tournament(db, 4)
    with pytest.raises(TournamentNotParticipant):
        await withdraw_tournament(db, tournament.id, 999)


@pytest.mark.asyncio
async def test_withdraw_tournament_raises_when_tournament_not_in_progress(db):
    tournament = await create_tournament(db, "cup", 1, 4)
    with pytest.raises(TournamentNotInProgress):
        await withdraw_tournament(db, tournament.id, 1)

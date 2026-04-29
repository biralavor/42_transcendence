import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from shared.config.settings import settings
from persistence import (
    InvalidWinner,
    TournamentMatchAlreadyFinished,
    TournamentMatchNotFound,
    TournamentNotFound,
    count_games,
    create_match,
    create_tournament,
    finish_match,
    get_leaderboard,
    get_match,
    get_tournament_with_participants,
    get_user_matches,
    get_user_stats,
    has_perfect_game,
    join_tournament,
    record_tournament_match_timeout_result,
    record_tournament_match_result,
    start_tournament,
    won_vs_ai,
)


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
    try:
        async with engine.connect() as conn:
            transaction = await conn.begin()

            # Keep persistence tests independent from module execution order.
            # Some tests award XP and require winner user_ids to exist.
            for uid in (1, 2, 3, 42, 50, 51, 99):
                await conn.execute(
                    text(
                        "INSERT INTO credentials (id, username, password) "
                        "VALUES (:id, :username, 'x') ON CONFLICT (id) DO NOTHING"
                    ),
                    {"id": uid, "username": f"persist_user_{uid}"},
                )
                await conn.execute(
                    text(
                        "INSERT INTO users (id, username, credential_id) "
                        "VALUES (:id, :username, :cid) ON CONFLICT (id) DO NOTHING"
                    ),
                    {"id": uid, "username": f"persist_user_{uid}", "cid": uid},
                )

            Session = async_sessionmaker(bind=conn, class_=AsyncSession, expire_on_commit=False)
            session = Session()

            # Helper functions under test call commit(); keep those changes inside
            # a nested transaction so the fixture can roll everything back later.
            await session.begin_nested()

            @event.listens_for(session.sync_session, "after_transaction_end")
            def _restart_savepoint(sync_session, transaction):
                if transaction.nested and not transaction._parent.nested:
                    sync_session.begin_nested()

            try:
                yield session
            finally:
                await session.close()
                await transaction.rollback()
    except Exception as exc:
        await engine.dispose()
        pytest.skip(f"Persistence integration DB unavailable: {exc}")

    await engine.dispose()


async def _setup_tournament(db, max_participants: int):
    # Ensure the required users exist (idempotent INSERT) so the test is
    # self-contained and doesn't depend on pre-seeded database state.
    # credentials must be inserted first due to the FK on users.credential_id.
    for uid in range(6001, 6000 + max_participants + 1):
        await db.execute(
            text(
                "INSERT INTO credentials (id, username, password) VALUES (:id, :u, 'x') "
                "ON CONFLICT (id) DO NOTHING"
            ),
            {"id": 10000 + uid, "u": f"test_user_{uid}"},
        )
        await db.execute(
            text(
                "INSERT INTO users (id, username, credential_id) VALUES (:id, :u, :cid) "
                "ON CONFLICT (id) DO NOTHING"
            ),
            {"id": uid, "u": f"test_user_{uid}", "cid": uid + 10000},
        )
    await db.flush()

    tournament = await create_tournament(db, name="t", creator_id=6001, max_participants=max_participants)
    # Note: create_tournament() already adds creator (uid=6001) as a participant
    # So we only need to add remaining participants (6002 through max_participants)
    for uid in range(6002, 6000 + max_participants + 1):
        await join_tournament(db, tournament.id, uid)
    _, matches = await start_tournament(db, tournament.id, user_id=6001)
    return tournament, matches


async def _ensure_users(db, *user_ids: int) -> None:
    for uid in user_ids:
        await db.execute(
            text(
                "INSERT INTO credentials (id, username, password) "
                "VALUES (:id, :username, 'x') ON CONFLICT (id) DO NOTHING"
            ),
            {"id": uid, "username": f"stats_user_{uid}"},
        )
        await db.execute(
            text(
                "INSERT INTO users (id, username, credential_id) "
                "VALUES (:id, :username, :cid) ON CONFLICT (id) DO NOTHING"
            ),
            {"id": uid, "username": f"stats_user_{uid}", "cid": uid},
        )
    await db.flush()


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
    player1_id = 20001
    player2_id = 20002
    await _ensure_users(db, player1_id, player2_id)

    # player 20001 wins one, loses one
    m1 = await create_match(db, player1_id=player1_id, player2_id=player2_id)
    await finish_match(db, m1.id, winner_id=player1_id, score_p1=7, score_p2=3)

    m2 = await create_match(db, player1_id=player1_id, player2_id=player2_id)
    await finish_match(db, m2.id, winner_id=player2_id, score_p1=2, score_p2=7)

    stats = await get_user_stats(db, user_id=player1_id)
    assert stats["wins"] == 1
    assert stats["losses"] == 1
    assert stats["total_games"] == 2
    assert stats["goals_scored"] == 9   # 7 + 2
    assert stats["goals_conceded"] == 10  # 3 + 7


@pytest.mark.asyncio
async def test_get_user_stats_excludes_ongoing_matches(db):
    player1_id = 20011
    player2_id = 20012
    await _ensure_users(db, player1_id, player2_id)

    await create_match(db, player1_id=player1_id, player2_id=player2_id)  # not finished
    stats = await get_user_stats(db, user_id=player1_id)
    assert stats["total_games"] == 0


@pytest.mark.asyncio
async def test_get_user_matches_returns_newest_first(db):
    player1_id = 20021
    player2_id = 20022
    player3_id = 20023
    await _ensure_users(db, player1_id, player2_id, player3_id)

    m1 = await create_match(db, player1_id=player1_id, player2_id=player2_id)
    m2 = await create_match(db, player1_id=player1_id, player2_id=player3_id)
    matches = await get_user_matches(db, user_id=player1_id)
    assert len(matches) == 2
    assert matches[0].id == m2.id  # newest first


@pytest.mark.asyncio
async def test_get_user_matches_returns_empty_for_unknown_user(db):
    matches = await get_user_matches(db, user_id=99999)
    assert matches == []


@pytest.mark.asyncio
async def test_get_user_stats_counts_goals_as_player2(db):
    player1_id = 20031
    player2_id = 20032
    await _ensure_users(db, player1_id, player2_id)

    # player2_id is player2 in this match
    m = await create_match(db, player1_id=player1_id, player2_id=player2_id)
    await finish_match(db, m.id, winner_id=player2_id, score_p1=3, score_p2=7)

    stats = await get_user_stats(db, user_id=player2_id)
    assert stats["wins"] == 1
    assert stats["goals_scored"] == 7
    assert stats["goals_conceded"] == 3


@pytest.mark.asyncio
async def test_get_leaderboard_orders_by_points_then_goal_difference(db):
    p1 = 20041
    p2 = 20042
    p3 = 20043
    await _ensure_users(db, p1, p2, p3)

    m1 = await create_match(db, player1_id=p1, player2_id=p2)
    await finish_match(db, m1.id, winner_id=p1, score_p1=7, score_p2=3)

    m2 = await create_match(db, player1_id=p2, player2_id=p3)
    await finish_match(db, m2.id, winner_id=p2, score_p1=6, score_p2=1)

    m3 = await create_match(db, player1_id=p1, player2_id=p3)
    await finish_match(db, m3.id, winner_id=p1, score_p1=5, score_p2=0)

    leaderboard = await get_leaderboard(db)

    rows = {row["user_id"]: row for row in leaderboard}
    assert p1 in rows and p2 in rows and p3 in rows

    assert rows[p1]["points"] == 6
    assert rows[p1]["goal_difference"] == 9

    assert rows[p2]["points"] == 3
    assert rows[p2]["goal_difference"] == 1

    assert rows[p3]["points"] == 0
    assert rows[p3]["goal_difference"] == -10

    # Ordering should still rank p1 above p2 above p3.
    assert rows[p1]["rank"] < rows[p2]["rank"] < rows[p3]["rank"]


@pytest.mark.asyncio
async def test_record_match_result_marks_finished_and_no_advance_when_round_incomplete(db):
    tournament, r1 = await _setup_tournament(db, 4)
    first = r1[0]
    _, complete, newly_assigned = await record_tournament_match_result(
        db, tournament.id, first.match_id, winner_id=first.player1_id
    )
    assert complete is False
    assert newly_assigned == []
    _, _, all_matches = await get_tournament_with_participants(db, tournament.id)
    finished = [m for m in all_matches if m.status == "finished"]
    assert len(finished) == 1
    assert finished[0].winner_id == first.player1_id
    # Round-robin stays in a single round.
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
async def test_record_match_result_assigns_new_pending_matches_when_players_become_available(db):
    tournament, r1 = await _setup_tournament(db, 4)
    active = [m for m in r1 if m.status == "in_progress"]
    assert len(active) == 2

    any_newly_assigned = False
    for m in active:
        _, _, newly_assigned = await record_tournament_match_result(
            db, tournament.id, m.match_id, m.player1_id
        )
        any_newly_assigned = any_newly_assigned or bool(newly_assigned)

    assert any_newly_assigned is True

    _, _, all_matches = await get_tournament_with_participants(db, tournament.id)
    assert len(all_matches) == 6
    assert all(m.round == 1 for m in all_matches)
    assert len([m for m in all_matches if m.status == "finished"]) == 2
    assert len([m for m in all_matches if m.status == "in_progress"]) == 2


@pytest.mark.asyncio
async def test_record_match_result_completes_tournament_on_final(db):
    tournament, _ = await _setup_tournament(db, 4)

    complete = False
    safety = 0
    while not complete and safety < 20:
        safety += 1
        _, _, all_matches = await get_tournament_with_participants(db, tournament.id)
        active = [m for m in all_matches if m.status == "in_progress"]
        assert active, "Expected at least one in_progress match before completion"
        current = active[0]
        _, complete, _ = await record_tournament_match_result(
            db, tournament.id, current.match_id, winner_id=current.player1_id
        )

    assert safety < 20
    assert complete is True
    t, _, all_matches = await get_tournament_with_participants(db, tournament.id)
    assert t.status == "complete"
    assert len(all_matches) == 6
    assert all(m.status == "finished" for m in all_matches)


@pytest.mark.asyncio
async def test_record_match_result_8_player_round_robin_completes(db):
    tournament, seeded = await _setup_tournament(db, 8)
    assert len(seeded) == 28
    assert all(m.round == 1 for m in seeded)

    complete = False
    safety = 0
    while not complete and safety < 80:
        safety += 1
        _, _, all_matches = await get_tournament_with_participants(db, tournament.id)
        active = [m for m in all_matches if m.status == "in_progress"]
        assert active, "Expected in_progress matches while tournament is not complete"
        current = active[0]
        _, complete, _ = await record_tournament_match_result(
            db, tournament.id, current.match_id, winner_id=current.player1_id
        )

    assert safety < 80
    assert complete is True
    t, _, all_matches = await get_tournament_with_participants(db, tournament.id)
    assert t.status == "complete"
    assert len(all_matches) == 28
    assert all(m.status == "finished" for m in all_matches)


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
async def test_record_tournament_match_timeout_result_marks_wo_winner(db):
    tournament, seeded = await _setup_tournament(db, 4)
    active = next(m for m in seeded if m.status == "in_progress")

    _, complete, _ = await record_tournament_match_timeout_result(
        db=db,
        tournament_id=tournament.id,
        tournament_match_id=active.id,
        winner_id=active.player1_id,
    )
    assert complete is False

    _, _, matches = await get_tournament_with_participants(db, tournament.id)
    updated = next(m for m in matches if m.id == active.id)
    assert updated.status == "finished"
    assert updated.winner_id == active.player1_id
    assert updated.score_p1 == 1
    assert updated.score_p2 == 0


@pytest.mark.asyncio
async def test_record_tournament_match_timeout_result_with_no_winner(db):
    tournament, seeded = await _setup_tournament(db, 4)
    active = next(m for m in seeded if m.status == "in_progress")

    _, complete, _ = await record_tournament_match_timeout_result(
        db=db,
        tournament_id=tournament.id,
        tournament_match_id=active.id,
        winner_id=None,
    )
    assert complete is False

    _, _, matches = await get_tournament_with_participants(db, tournament.id)
    updated = next(m for m in matches if m.id == active.id)
    assert updated.status == "finished"
    assert updated.winner_id is None
    assert updated.score_p1 == 0
    assert updated.score_p2 == 0


@pytest.mark.asyncio
async def test_get_leaderboard_applies_limit(db):
    for user_id in (1, 2, 3):
        match = await create_match(db, player1_id=user_id, player2_id=99)
        await finish_match(db, match.id, winner_id=user_id, score_p1=3, score_p2=0)

    leaderboard = await get_leaderboard(db, limit=2)
    assert len(leaderboard) == 2


# ── Task 3: helper function tests ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_count_games_returns_zero_for_new_user(db):
    count = await count_games(42, db)
    assert count == 0


@pytest.mark.asyncio
async def test_won_vs_ai_returns_false_with_no_matches(db):
    result = await won_vs_ai(42, db)
    assert result is False


@pytest.mark.asyncio
async def test_has_perfect_game_returns_false_with_no_matches(db):
    result = await has_perfect_game(42, db)
    assert result is False


@pytest.mark.asyncio
async def test_first_game_badge_unlocked_after_any_game(db):
    match = await create_match(db, player1_id=1, player2_id=2)
    await finish_match(db, match.id, winner_id=1, score_p1=10, score_p2=5)
    row = (await db.execute(
        text(
            "SELECT ua.user_id FROM user_achievements ua "
            "JOIN achievements a ON a.id = ua.achievement_id "
            "WHERE a.key = 'first_game' AND ua.user_id = :uid"
        ),
        {"uid": 1},
    )).one_or_none()
    assert row is not None, "first_game badge should be unlocked after winning a match"


@pytest.mark.asyncio
async def test_perfect_game_badge_unlocked_on_10_0_win(db):
    match = await create_match(db, player1_id=1, player2_id=2)
    await finish_match(db, match.id, winner_id=1, score_p1=10, score_p2=0)
    row = (await db.execute(
        text(
            "SELECT ua.user_id FROM user_achievements ua "
            "JOIN achievements a ON a.id = ua.achievement_id "
            "WHERE a.key = 'perfect_game' AND ua.user_id = :uid"
        ),
        {"uid": 1},
    )).one_or_none()
    assert row is not None, "perfect_game badge should unlock on 10-0 win"


@pytest.mark.asyncio
async def test_has_perfect_game_returns_false_for_partial_shutout(db):
    """A 5-0 win is a shutout but NOT a perfect game (badge requires winner ≥10).

    Regression guard for the description-vs-implementation fix: previously
    `has_perfect_game` returned True for any shutout regardless of winner score.
    """
    # Use a fresh user pair so prior shutouts don't affect the assertion
    match = await create_match(db, player1_id=42, player2_id=99)
    await finish_match(db, match.id, winner_id=42, score_p1=5, score_p2=0)
    # We can't directly assert has_perfect_game(42) is False because earlier
    # tests in the same DB may have given user 42 a real 10-0 win. Instead
    # check that THIS specific 5-0 match was not enough to unlock the badge
    # via SELECT against the matches table directly using the same predicate.
    from persistence import has_perfect_game
    # ── First, verify the predicate-level behavior using a fresh user (3) ──
    # User 3 has no prior matches in our test seed.
    count_user3 = (await db.execute(
        text(
            "SELECT COUNT(*) FROM matches "
            "WHERE winner_id = 3 AND status = 'finished' AND ("
            "  (player1_id = 3 AND score_p2 = 0 AND score_p1 >= 10) OR "
            "  (player2_id = 3 AND score_p1 = 0 AND score_p2 >= 10)"
            ")"
        ),
    )).scalar_one()
    # Build a 5-0 win for user 3
    m_partial = await create_match(db, player1_id=3, player2_id=99)
    await finish_match(db, m_partial.id, winner_id=3, score_p1=5, score_p2=0)
    after_partial = (await db.execute(
        text(
            "SELECT COUNT(*) FROM matches "
            "WHERE winner_id = 3 AND status = 'finished' AND ("
            "  (player1_id = 3 AND score_p2 = 0 AND score_p1 >= 10) OR "
            "  (player2_id = 3 AND score_p1 = 0 AND score_p2 >= 10)"
            ")"
        ),
    )).scalar_one()
    assert after_partial == count_user3, (
        f"5-0 should NOT count as a perfect game (count went {count_user3} → {after_partial}). "
        f"perfect_game requires winner score ≥10."
    )
    # And the helper itself should agree (no prior matches → still False)
    assert await has_perfect_game(3, db) is False


@pytest.mark.asyncio
async def test_has_perfect_game_returns_true_for_10_0_win(db):
    """A 10-0 win DOES qualify (winner reached the standard Pong score)."""
    from persistence import has_perfect_game
    # Snapshot: did user 50 already have a perfect game?
    pre = await has_perfect_game(50, db)
    m = await create_match(db, player1_id=50, player2_id=51)
    await finish_match(db, m.id, winner_id=50, score_p1=10, score_p2=0)
    assert await has_perfect_game(50, db) is True, (
        f"10-0 should unlock perfect_game (was perfect_game={pre} before)"
    )


# ── Task 2: XP amount tests ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_finish_match_awards_25_xp_to_winner(db):
    """Winner earns +25 XP on regular game win."""
    match = await create_match(db, player1_id=1, player2_id=2)
    await finish_match(db, match.id, winner_id=1, score_p1=10, score_p2=5)
    row = (await db.execute(
        text("SELECT xp FROM user_xp WHERE user_id = :uid"), {"uid": 1}
    )).one_or_none()
    assert row is not None and row.xp == 25


@pytest.mark.asyncio
async def test_finish_match_awards_5_xp_to_loser(db):
    """Loser earns +5 XP on regular game loss."""
    match = await create_match(db, player1_id=1, player2_id=2)
    await finish_match(db, match.id, winner_id=1, score_p1=10, score_p2=5)
    row = (await db.execute(
        text("SELECT xp FROM user_xp WHERE user_id = :uid"), {"uid": 2}
    )).one_or_none()
    assert row is not None and row.xp == 5


@pytest.mark.asyncio
async def test_finish_match_skips_xp_when_ai_is_winner(db):
    """When the AI (player_id=0) wins, no XP row is inserted for user_id=0
    (would violate FK on user_xp.user_id → users.id).
    """
    # Match: human (user 1) vs AI (user_id=0)
    # We need user 0 to NOT exist in users; AI matches use 0 as a sentinel.
    match = await create_match(db, player1_id=1, player2_id=0)
    # AI wins
    finished = await finish_match(db, match.id, winner_id=0, score_p1=2, score_p2=10)
    assert finished is not None
    assert finished.status == "finished"
    assert finished.winner_id == 0

    # Verify no user_xp row was inserted for user_id=0
    row = (await db.execute(
        text("SELECT xp FROM user_xp WHERE user_id = 0"),
    )).one_or_none()
    assert row is None, "AI sentinel (user_id=0) should never get a user_xp row"

    # Loser is user 1 — gets the +5 XP for losing (humans still get loss XP vs AI)
    row_loser = (await db.execute(
        text("SELECT xp FROM user_xp WHERE user_id = 1"),
    )).one_or_none()
    assert row_loser is not None and row_loser.xp >= 5


@pytest.mark.asyncio
async def test_finish_match_skips_xp_when_ai_is_loser(db):
    """When the AI loses, the human winner still gets +25 XP, but no XP row
    is inserted for the AI loser (user_id=0).
    """
    match = await create_match(db, player1_id=1, player2_id=0)
    # Human wins
    finished = await finish_match(db, match.id, winner_id=1, score_p1=10, score_p2=2)
    assert finished is not None
    assert finished.status == "finished"

    # Winner (user 1) gets +25 XP
    row_winner = (await db.execute(
        text("SELECT xp FROM user_xp WHERE user_id = 1"),
    )).one_or_none()
    assert row_winner is not None and row_winner.xp >= 25

    # AI loser (user_id=0) gets no XP row
    row_ai = (await db.execute(
        text("SELECT xp FROM user_xp WHERE user_id = 0"),
    )).one_or_none()
    assert row_ai is None, "AI sentinel (user_id=0) should never get a user_xp row"


# --------------------------------------------------------------------------- #
# list_live_matches
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_list_live_matches_returns_only_ongoing(db):
    # Two distinct user pairs to avoid colliding on the same room
    await _ensure_users(db, 90001, 90002, 90003, 90004)
    ongoing = await create_match(db, player1_id=90001, player2_id=90002)
    finished = await create_match(db, player1_id=90003, player2_id=90004)
    await finish_match(db, finished.id, winner_id=90003, score_p1=10, score_p2=4)

    from persistence import list_live_matches
    rows = await list_live_matches(db)
    match_ids = [int(r["match_id"]) for r in rows]
    assert ongoing.id in match_ids
    assert finished.id not in match_ids


@pytest.mark.asyncio
async def test_list_live_matches_excludes_ai_games(db):
    await _ensure_users(db, 90010)
    # AI sentinel = 0; one side AI → must be excluded
    ai_match = await create_match(db, player1_id=90010, player2_id=0)

    from persistence import list_live_matches
    rows = await list_live_matches(db)
    match_ids = [int(r["match_id"]) for r in rows]
    assert ai_match.id not in match_ids


@pytest.mark.asyncio
async def test_list_live_matches_projects_player_fields(db):
    await _ensure_users(db, 90020, 90021)
    # Set display_name + avatar_url so we can assert projection
    await db.execute(
        text("UPDATE users SET display_name='Alice A', avatar_url='/uploads/avatars/90020.png' WHERE id=:i"),
        {"i": 90020},
    )
    await db.execute(
        text("UPDATE users SET display_name='', avatar_url=NULL WHERE id=:i"),
        {"i": 90021},
    )
    match = await create_match(db, player1_id=90020, player2_id=90021)

    from persistence import list_live_matches
    rows = await list_live_matches(db)
    row = next(r for r in rows if int(r["match_id"]) == match.id)
    assert row["p1_id"] == 90020
    assert row["p1_username"] == "stats_user_90020"
    assert row["p1_display_name"] == "Alice A"
    assert row["p1_avatar_url"] == "/uploads/avatars/90020.png"
    # Empty display_name falls back to username (COALESCE+NULLIF in SQL)
    assert row["p2_display_name"] == "stats_user_90021"
    assert row["p2_avatar_url"] is None


@pytest.mark.asyncio
async def test_list_live_matches_orders_by_started_at_desc(db):
    await _ensure_users(db, 90030, 90031, 90032, 90033)
    older = await create_match(db, player1_id=90030, player2_id=90031)
    newer = await create_match(db, player1_id=90032, player2_id=90033)

    # Ensure deterministic ordering by adjusting started_at
    await db.execute(
        text("UPDATE matches SET started_at = started_at - INTERVAL '1 hour' WHERE id=:i"),
        {"i": older.id},
    )

    from persistence import list_live_matches
    rows = await list_live_matches(db)
    # Filter to the two we just created
    relevant = [r for r in rows if int(r["match_id"]) in (older.id, newer.id)]
    assert [int(r["match_id"]) for r in relevant] == [newer.id, older.id]


@pytest.mark.asyncio
async def test_mark_match_finished_if_ongoing_marks_ongoing_row_and_returns_true(db):
    """An 'ongoing' row gets status='finished' + finished_at populated, and
    the helper returns True."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select
    from service.persistence import mark_match_finished_if_ongoing
    from service.models.match import Match

    m = Match(
        player1_id=42,
        player2_id=50,
        status="ongoing",
        started_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db.add(m)
    await db.flush()
    match_id = m.id

    updated = await mark_match_finished_if_ongoing(db, match_id)
    await db.commit()
    assert updated is True

    result = await db.execute(
        select(Match).where(Match.id == match_id)
    )
    row = result.scalars().one()
    assert row.status == "finished"
    assert row.finished_at is not None
    # We deliberately do NOT touch winner_id or scores — caller has no data.
    assert row.winner_id is None
    assert row.score_p1 == 0
    assert row.score_p2 == 0


@pytest.mark.asyncio
async def test_mark_match_finished_if_ongoing_is_idempotent_on_finished_row(db):
    """Calling the helper on a row that's already finished returns False and
    leaves all fields untouched."""
    from datetime import datetime, timezone
    from sqlalchemy import select
    from service.persistence import mark_match_finished_if_ongoing
    from service.models.match import Match

    earlier = datetime(2024, 1, 1, tzinfo=timezone.utc)
    m = Match(
        player1_id=42,
        player2_id=50,
        status="finished",
        finished_at=earlier,
        winner_id=42,
        score_p1=7,
        score_p2=3,
    )
    db.add(m)
    await db.flush()
    match_id = m.id

    updated = await mark_match_finished_if_ongoing(db, match_id)
    await db.commit()
    assert updated is False

    result = await db.execute(
        select(Match).where(Match.id == match_id)
    )
    row = result.scalars().one()
    assert row.status == "finished"
    assert row.finished_at == earlier  # not bumped
    assert row.winner_id == 42
    assert row.score_p1 == 7
    assert row.score_p2 == 3


@pytest.mark.asyncio
async def test_mark_match_finished_if_ongoing_respects_grace_window(db):
    """A freshly-created match (started_at = NOW) is too young to reconcile
    under the default 30-second grace window. Passing min_age_seconds=0
    bypasses the gate and finishes it immediately."""
    from datetime import datetime, timezone
    from sqlalchemy import select
    from service.persistence import mark_match_finished_if_ongoing
    from service.models.match import Match

    m = Match(
        player1_id=42,
        player2_id=50,
        status="ongoing",
        started_at=datetime.now(timezone.utc),
    )
    db.add(m)
    await db.flush()
    match_id = m.id

    # Default grace window — too young, helper returns False, row unchanged.
    updated_default = await mark_match_finished_if_ongoing(db, match_id)
    await db.commit()
    assert updated_default is False

    result = await db.execute(select(Match).where(Match.id == match_id))
    row = result.scalars().one()
    assert row.status == "ongoing"
    assert row.finished_at is None

    # Override window to 0 — gate is bypassed, helper finishes the row.
    updated_override = await mark_match_finished_if_ongoing(db, match_id, min_age_seconds=0)
    await db.commit()
    assert updated_override is True

    result = await db.execute(select(Match).where(Match.id == match_id))
    row = result.scalars().one()
    assert row.status == "finished"
    assert row.finished_at is not None

"""Tests for game-service/history.py — match history listing.

Three testable units:
  1. match_history_order_by_str  — pure-logic whitelist for the `order` query
  2. match_history_filter_str    — pure-logic SQL WHERE fragment builder
  3. get_match_history_paginated — real-DB smoke test through the full query

The filter-fragment function does f-string interpolation, so the tests
include negative cases that probe what happens with unexpected input shapes
(security boundary).
"""
import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from shared.config.settings import settings
from history import (
    match_history_order_by_str,
    match_history_filter_str,
    get_match_history_paginated,
)
from persistence import create_match, finish_match


# --------------------------------------------------------------------------- #
# match_history_order_by_str — whitelist (only `date` and `result` allowed)
# --------------------------------------------------------------------------- #

class TestMatchHistoryOrderByStr:
    def test_none_returns_none(self):
        assert match_history_order_by_str(None) is None

    def test_date_desc_is_allowed(self):
        assert match_history_order_by_str([('date', 'DESC')]) == 'date DESC'

    def test_result_asc_is_allowed(self):
        assert match_history_order_by_str([('result', 'ASC')]) == 'result ASC'

    def test_date_and_result_both_kept(self):
        assert match_history_order_by_str([('date', 'DESC'), ('result', 'ASC')]) == \
            'date DESC, result ASC'

    def test_unknown_columns_silently_dropped(self):
        # Whitelist only has date/result — anything else is rejected
        for bad_col in ['user_id', 'match_id', 'score', 'opponent_id', 'rank',
                        'xp', "'; DROP TABLE matches; --"]:
            assert match_history_order_by_str([(bad_col, 'DESC')]) is None, (
                f"unknown column {bad_col!r} should be dropped, not echoed"
            )

    def test_mixed_valid_and_invalid_keeps_only_valid(self):
        assert match_history_order_by_str(
            [('date', 'DESC'), ('attacker_col', 'DESC'), ('result', 'ASC')]
        ) == 'date DESC, result ASC'


# --------------------------------------------------------------------------- #
# match_history_filter_str — WHERE fragment builder
# --------------------------------------------------------------------------- #

class TestMatchHistoryFilterStr:
    def test_no_filters_returns_always_true(self):
        # An empty filter set still produces a valid WHERE clause (the always-true
        # `1 = 1` so the fragment can be safely composed in the parent SQL).
        result = match_history_filter_str({
            'result': None, 'date_from': None, 'date_to': None,
        })
        assert result == '1 = 1'

    def test_result_win_is_capitalized_and_quoted(self):
        result = match_history_filter_str({
            'result': 'win', 'date_from': None, 'date_to': None,
        })
        assert "result = 'Win'" in result

    def test_result_loss_is_capitalized_and_quoted(self):
        result = match_history_filter_str({
            'result': 'loss', 'date_from': None, 'date_to': None,
        })
        assert "result = 'Loss'" in result

    def test_result_other_value_is_ignored(self):
        # Only 'win' and 'loss' are allowed values; anything else is dropped.
        # This is the input-validation boundary for the result filter.
        for bad in ['draw', 'WIN; DROP TABLE matches; --', 'all', '']:
            result = match_history_filter_str({
                'result': bad, 'date_from': None, 'date_to': None,
            })
            assert "result =" not in result, (
                f"bogus result {bad!r} should NOT produce a result filter"
            )

    def test_date_from_only_uses_greater_than(self):
        result = match_history_filter_str({
            'result': None, 'date_from': '2025-01-01', 'date_to': None,
        })
        assert "finished_at > '2025-01-01'::timestamp" in result

    def test_date_to_only_uses_less_than(self):
        result = match_history_filter_str({
            'result': None, 'date_from': None, 'date_to': '2025-12-31',
        })
        assert "finished_at < '2025-12-31'::timestamp" in result

    def test_date_range_uses_between(self):
        result = match_history_filter_str({
            'result': None, 'date_from': '2025-01-01', 'date_to': '2025-12-31',
        })
        assert "BETWEEN '2025-01-01'::timestamp AND '2025-12-31'::timestamp" in result

    def test_combined_result_and_date_range(self):
        result = match_history_filter_str({
            'result': 'win', 'date_from': '2025-01-01', 'date_to': '2025-12-31',
        })
        assert "result = 'Win'" in result
        assert "BETWEEN" in result

    def test_filters_are_anded_with_AND(self):
        result = match_history_filter_str({
            'result': 'win', 'date_from': '2025-01-01', 'date_to': None,
        })
        assert 'AND' in result, "multiple filters should be combined with AND"


# --------------------------------------------------------------------------- #
# get_match_history_paginated — real-DB smoke test
# --------------------------------------------------------------------------- #

@pytest_asyncio.fixture
async def db():
    """Real DB session with savepoint-rollback isolation. Mirrors the `db`
    fixture in test_persistence.py but seeds different user IDs to avoid
    cross-test interference."""
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
    try:
        async with engine.connect() as conn:
            transaction = await conn.begin()
            for uid in (70001, 70002, 70003, 70099):
                await conn.execute(
                    text(
                        "INSERT INTO credentials (id, username, password) "
                        "VALUES (:id, :username, 'x') ON CONFLICT (id) DO NOTHING"
                    ),
                    {"id": uid, "username": f"hist_user_{uid}"},
                )
                await conn.execute(
                    text(
                        "INSERT INTO users (id, username, credential_id) "
                        "VALUES (:id, :username, :cid) ON CONFLICT (id) DO NOTHING"
                    ),
                    {"id": uid, "username": f"hist_user_{uid}", "cid": uid},
                )

            Session = async_sessionmaker(bind=conn, class_=AsyncSession, expire_on_commit=False)
            session = Session()
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
        pytest.skip(f"history integration DB unavailable: {exc}")
    await engine.dispose()


@pytest.mark.asyncio
async def test_history_returns_pagination_envelope_shape(db):
    """Empty history (no matches for user) still returns the page envelope."""
    page = await get_match_history_paginated(
        search_for={
            'player_id': 70001, 'page': 0, 'limit': 10,
            'result': None, 'date_from': None, 'date_to': None,
        },
        sort_assoc=None,
        session=db,
    )
    assert page.total >= 0
    assert page.per_page == 10
    assert page.page == 0
    assert isinstance(page.results, list)
    # Summary dict is always present
    assert page.summary is not None


@pytest.mark.asyncio
async def test_history_includes_finished_match(db):
    """A finished match where the user was player1 shows up in their history
    with the correct result, score, and opponent."""
    match = await create_match(db, player1_id=70001, player2_id=70002)
    await finish_match(db, match.id, winner_id=70001, score_p1=10, score_p2=4)

    page = await get_match_history_paginated(
        search_for={
            'player_id': 70001, 'page': 0, 'limit': 10,
            'result': None, 'date_from': None, 'date_to': None,
        },
        sort_assoc=None,
        session=db,
    )

    # User 70001 should have at least the one match we just finished
    assert page.total >= 1
    assert any(
        r.match_id == match.id and r.result == 'Win' and r.score == '10-4'
        and r.opponent_id == 70002
        for r in page.results
    ), f"Expected our match in history; got: {[r.model_dump() for r in page.results]}"


@pytest.mark.asyncio
async def test_history_filters_by_result_win(db):
    """Filtering result=win returns only wins."""
    # User 70003 plays 2 matches: wins one, loses one
    m_win = await create_match(db, player1_id=70003, player2_id=70099)
    await finish_match(db, m_win.id, winner_id=70003, score_p1=10, score_p2=2)
    m_loss = await create_match(db, player1_id=70003, player2_id=70099)
    await finish_match(db, m_loss.id, winner_id=70099, score_p1=3, score_p2=10)

    page = await get_match_history_paginated(
        search_for={
            'player_id': 70003, 'page': 0, 'limit': 10,
            'result': 'win', 'date_from': None, 'date_to': None,
        },
        sort_assoc=None,
        session=db,
    )
    # Every returned row should be a Win
    for r in page.results:
        assert r.result == 'Win', (
            f"result=win filter returned a non-Win row: {r.model_dump()}"
        )
    # And our specific win should be in there
    assert any(r.match_id == m_win.id for r in page.results)


@pytest.mark.asyncio
async def test_history_score_is_perspective_relative(db):
    """The `score` field is rendered from the user's perspective: their score
    first, opponent's score second — regardless of player1/player2 slot."""
    # User 70002 plays as player2 and wins 9-3 (their score is score_p2=9)
    m = await create_match(db, player1_id=70099, player2_id=70002)
    await finish_match(db, m.id, winner_id=70002, score_p1=3, score_p2=9)

    page = await get_match_history_paginated(
        search_for={
            'player_id': 70002, 'page': 0, 'limit': 10,
            'result': None, 'date_from': None, 'date_to': None,
        },
        sort_assoc=None,
        session=db,
    )
    row = next((r for r in page.results if r.match_id == m.id), None)
    assert row is not None
    assert row.score == '9-3', (
        f"score should be user-perspective ('9-3' since 70002 scored 9); got {row.score!r}"
    )
    assert row.result == 'Win'
    assert row.opponent_id == 70099


@pytest.mark.asyncio
async def test_history_pagination_metadata_clamps_out_of_range_page(db):
    """Asking for a wildly out-of-range page returns the actual last_page in
    the response (does not 500 or return an arbitrary page number)."""
    await create_match(db, player1_id=70001, player2_id=70002)
    page = await get_match_history_paginated(
        search_for={
            'player_id': 70001, 'page': 999, 'limit': 10,
            'result': None, 'date_from': None, 'date_to': None,
        },
        sort_assoc=None,
        session=db,
    )
    # The query CTE clamps `page` to last_page; verify that contract.
    assert page.page <= page.last_page
    assert page.per_page == 10


@pytest.mark.asyncio
async def test_history_opponent_display_name_falls_back_to_username_when_null(db):
    """opponent_display_name must equal opponent's username when display_name is NULL.

    Users inserted by this fixture have no display_name (NULL). The COALESCE in
    paged_matches_with_opponent_display_name must substitute the username so the
    frontend never receives an empty / null player-card name.
    """
    match = await create_match(db, player1_id=70001, player2_id=70002)
    await finish_match(db, match.id, winner_id=70001, score_p1=10, score_p2=4)

    page = await get_match_history_paginated(
        search_for={
            'player_id': 70001, 'page': 0, 'limit': 10,
            'result': None, 'date_from': None, 'date_to': None,
        },
        sort_assoc=None,
        session=db,
    )
    row = next((r for r in page.results if r.match_id == match.id), None)
    assert row is not None
    assert row.opponent_display_name == 'hist_user_70002', (
        f"Expected username fallback 'hist_user_70002', got {row.opponent_display_name!r}"
    )


@pytest.mark.asyncio
async def test_history_opponent_display_name_uses_set_display_name(db):
    """opponent_display_name must return the actual display_name when it is set."""
    await db.execute(
        text("UPDATE users SET display_name = 'Bobby Tables' WHERE id = 70002")
    )

    match = await create_match(db, player1_id=70001, player2_id=70002)
    await finish_match(db, match.id, winner_id=70001, score_p1=7, score_p2=3)

    page = await get_match_history_paginated(
        search_for={
            'player_id': 70001, 'page': 0, 'limit': 10,
            'result': None, 'date_from': None, 'date_to': None,
        },
        sort_assoc=None,
        session=db,
    )
    row = next((r for r in page.results if r.match_id == match.id), None)
    assert row is not None
    assert row.opponent_display_name == 'Bobby Tables'

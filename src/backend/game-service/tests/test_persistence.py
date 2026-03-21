import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from shared.config.settings import settings
from persistence import create_match, finish_match, get_match, get_user_stats, get_user_matches


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE matches RESTART IDENTITY CASCADE"))
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
    await engine.dispose()


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

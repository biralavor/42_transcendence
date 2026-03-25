import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from shared.config.settings import settings
from persistence import get_or_create_room, save_message, get_room_history


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
    async with engine.begin() as conn:
        # Terminate any idle-in-transaction connections that would block TRUNCATE
        await conn.execute(text(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            "WHERE state = 'idle in transaction' "
            "AND datname = current_database() "
            "AND pid <> pg_backend_pid()"
        ))
        await conn.execute(text("TRUNCATE TABLE messages, chat_rooms RESTART IDENTITY CASCADE"))
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_get_or_create_room_creates_row(db):
    room = await get_or_create_room(db, "general")
    assert room.id is not None
    assert room.room_name == "general"


@pytest.mark.asyncio
async def test_get_or_create_room_is_idempotent(db):
    room1 = await get_or_create_room(db, "general")
    room2 = await get_or_create_room(db, "general")
    assert room1.id == room2.id


@pytest.mark.asyncio
async def test_save_message_inserts_row(db):
    room = await get_or_create_room(db, "test")
    msg = await save_message(db, room.id, "Alice", "hello")
    assert msg.id is not None
    assert msg.content == "hello"
    assert msg.sender_name == "Alice"
    assert msg.user_id is None


@pytest.mark.asyncio
async def test_get_room_history_returns_oldest_first(db):
    room = await get_or_create_room(db, "hist")
    await save_message(db, room.id, "A", "first")
    await save_message(db, room.id, "B", "second")
    history = await get_room_history(db, room.id)
    assert [m.content for m in history] == ["first", "second"]


@pytest.mark.asyncio
async def test_get_room_history_respects_limit(db):
    room = await get_or_create_room(db, "limit")
    for i in range(60):
        await save_message(db, room.id, "user", f"msg{i}")
    history = await get_room_history(db, room.id, limit=50)
    assert len(history) == 50
    assert history[0].content == "msg10"  # oldest within last 50


@pytest.mark.asyncio
async def test_get_room_history_returns_empty_for_unknown_room(db):
    history = await get_room_history(db, 99999)
    assert history == []

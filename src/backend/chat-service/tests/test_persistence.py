"""Direct tests for chat-service/persistence.py against a real database.

Uses the savepoint-rollback pattern (mirrors `game-service/tests/test_persistence.py`)
so each test is isolated against a long-lived shared DB without TRUNCATE.
"""
import pytest
import pytest_asyncio
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from fastapi import HTTPException

from shared.config.settings import settings
from service.persistence import (
    block_user,
    create_general_room,
    get_blocked_ids,
    get_or_create_dm_room,
    get_or_create_room,
    get_room_history,
    is_blocked,
    save_message,
    unblock_user,
)


@pytest_asyncio.fixture
async def db():
    """Real DB session with savepoint isolation. Seeds high-ID test users so
    chat-side tests never collide with the game-service / user-service test
    users (5001+, 9000+, 70000+, etc.)."""
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
    try:
        async with engine.connect() as conn:
            transaction = await conn.begin()
            for uid in (80001, 80002, 80003, 80099):
                await conn.execute(
                    text(
                        "INSERT INTO credentials (id, username, password) "
                        "VALUES (:id, :username, 'x') ON CONFLICT (id) DO NOTHING"
                    ),
                    {"id": uid, "username": f"chat_user_{uid}"},
                )
                await conn.execute(
                    text(
                        "INSERT INTO users (id, username, credential_id) "
                        "VALUES (:id, :username, :cid) ON CONFLICT (id) DO NOTHING"
                    ),
                    {"id": uid, "username": f"chat_user_{uid}", "cid": uid},
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
        pytest.skip(f"chat persistence integration DB unavailable: {exc}")
    await engine.dispose()


# --------------------------------------------------------------------------- #
# Room creation
# --------------------------------------------------------------------------- #

class TestGetOrCreateRoom:
    @pytest.mark.asyncio
    async def test_creates_new_room_when_slug_missing(self, db):
        room = await get_or_create_room(db, "test-room-r2-001")
        assert room.id is not None
        assert room.room_name == "test-room-r2-001"

    @pytest.mark.asyncio
    async def test_returns_existing_room_for_known_slug(self, db):
        a = await get_or_create_room(db, "test-room-r2-002")
        b = await get_or_create_room(db, "test-room-r2-002")
        assert a.id == b.id


class TestGetOrCreateDmRoom:
    @pytest.mark.asyncio
    async def test_dm_slug_uses_sorted_ids(self, db):
        """DM slug is `DM-{min}-{max}` regardless of argument order."""
        a = await get_or_create_dm_room(db, 80001, 80002)
        b = await get_or_create_dm_room(db, 80002, 80001)
        assert a.id == b.id
        assert a.room_name == "DM-80001-80002"

    @pytest.mark.asyncio
    async def test_dm_room_has_dm_room_type(self, db):
        room = await get_or_create_dm_room(db, 80003, 80099)
        assert room.room_type == "dm"


# --------------------------------------------------------------------------- #
# Messages
# --------------------------------------------------------------------------- #

class TestMessages:
    @pytest.mark.asyncio
    async def test_save_and_read_one_message(self, db):
        room = await get_or_create_room(db, "test-msg-r2-001")
        msg = await save_message(db, room.id, "alice", "hello world")
        assert msg.id is not None
        assert msg.content == "hello world"
        assert msg.sender_name == "alice"

        history = await get_room_history(db, room.id)
        assert any(m.id == msg.id for m in history)

    @pytest.mark.asyncio
    async def test_history_is_oldest_first(self, db):
        room = await get_or_create_room(db, "test-msg-r2-002")
        msgs = []
        for content in ["first", "second", "third"]:
            msgs.append(await save_message(db, room.id, "alice", content))

        history = await get_room_history(db, room.id)
        # Filter to just OUR messages (room may have unrelated messages)
        our_history = [m for m in history if m.id in {x.id for x in msgs}]
        assert [m.content for m in our_history] == ["first", "second", "third"], (
            "history should be oldest-first within our test slice"
        )

    @pytest.mark.asyncio
    async def test_history_respects_limit_argument(self, db):
        room = await get_or_create_room(db, "test-msg-r2-003")
        for i in range(15):
            await save_message(db, room.id, "alice", f"msg-{i}")
        history = await get_room_history(db, room.id, limit=5)
        assert len(history) == 5

    @pytest.mark.asyncio
    async def test_history_handles_unicode_and_emoji(self, db):
        room = await get_or_create_room(db, "test-msg-r2-004")
        payload = "héllo 🎮 中文 ñoño"
        msg = await save_message(db, room.id, "alice", payload)
        history = await get_room_history(db, room.id)
        match = next((m for m in history if m.id == msg.id), None)
        assert match is not None
        assert match.content == payload


# --------------------------------------------------------------------------- #
# Blocks
# --------------------------------------------------------------------------- #

class TestBlocks:
    @pytest.mark.asyncio
    async def test_block_and_check_is_blocked(self, db):
        await block_user(db, blocker_id=80001, blocked_id=80002)
        assert await is_blocked(db, 80001, 80002) is True

    @pytest.mark.asyncio
    async def test_block_is_directional(self, db):
        """Blocking from A→B should NOT mean B blocks A."""
        await block_user(db, blocker_id=80001, blocked_id=80003)
        assert await is_blocked(db, 80001, 80003) is True
        assert await is_blocked(db, 80003, 80001) is False

    @pytest.mark.asyncio
    async def test_block_is_idempotent(self, db):
        """Calling block_user twice should not raise or duplicate."""
        await block_user(db, blocker_id=80001, blocked_id=80099)
        await block_user(db, blocker_id=80001, blocked_id=80099)  # second call
        # Should still be blocked exactly once
        assert await is_blocked(db, 80001, 80099) is True

    @pytest.mark.asyncio
    async def test_unblock_removes_existing_block(self, db):
        await block_user(db, blocker_id=80002, blocked_id=80003)
        assert await is_blocked(db, 80002, 80003) is True
        await unblock_user(db, blocker_id=80002, blocked_id=80003)
        assert await is_blocked(db, 80002, 80003) is False

    @pytest.mark.asyncio
    async def test_unblock_unknown_pair_raises_404(self, db):
        with pytest.raises(HTTPException) as exc_info:
            await unblock_user(db, blocker_id=80099, blocked_id=80001)
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_blocked_ids_returns_only_users_blocked_by_caller(self, db):
        await block_user(db, blocker_id=80001, blocked_id=80002)
        await block_user(db, blocker_id=80001, blocked_id=80003)
        blocked = await get_blocked_ids(db, 80001)
        assert 80002 in blocked
        assert 80003 in blocked
        # Reverse direction should not appear
        not_blocked = await get_blocked_ids(db, 80002)
        assert 80001 not in not_blocked


# --------------------------------------------------------------------------- #
# General room creation (with name validation)
# --------------------------------------------------------------------------- #

class TestCreateGeneralRoom:
    @pytest.mark.asyncio
    async def test_valid_room_name_creates_room(self, db):
        # Use timestamp to avoid duplicate-name 409 across runs
        import time
        name = f"r2-room-{int(time.time() * 1000) % 100000}"
        room = await create_general_room(db, name, "alice")
        assert room.id is not None
        assert room.room_name == name
        assert room.room_type == "general"

    @pytest.mark.asyncio
    async def test_empty_room_name_raises_400(self, db):
        with pytest.raises(HTTPException) as exc_info:
            await create_general_room(db, "", "alice")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_whitespace_only_room_name_raises_400(self, db):
        with pytest.raises(HTTPException) as exc_info:
            await create_general_room(db, "    ", "alice")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_room_name_with_invalid_chars_raises_400(self, db):
        for bad in ["bad/name", "<script>", "name@host", "name;DROP"]:
            with pytest.raises(HTTPException) as exc_info:
                await create_general_room(db, bad, "alice")
            assert exc_info.value.status_code == 400, (
                f"name {bad!r} should be rejected with 400"
            )

    @pytest.mark.asyncio
    async def test_room_name_too_long_raises_400(self, db):
        too_long = "a" * 60  # max 50 per the regex
        with pytest.raises(HTTPException) as exc_info:
            await create_general_room(db, too_long, "alice")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_room_creation_saves_system_message(self, db):
        """The contract says a system 'created by …' message is saved so the
        new room is immediately visible to the room list."""
        import time
        name = f"r2-room-sys-{int(time.time() * 1000) % 100000}"
        room = await create_general_room(db, name, "alice")
        history = await get_room_history(db, room.id)
        # First message in the room should be the system one
        assert len(history) >= 1
        sys_msg = history[0]
        assert sys_msg.sender_name == "system"
        assert "alice" in sys_msg.content

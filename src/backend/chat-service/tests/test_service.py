import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from jose import jwt
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import ASGITransport, AsyncClient

from shared.config.settings import settings
from shared.database import get_db
from main import app
from persistence import get_or_create_room, save_message, get_room_history
from persistence import block_user, unblock_user, get_blocked_ids, is_blocked
from persistence import get_or_create_dm_room
from persistence import create_general_room, list_live_rooms

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
        await conn.execute(text("TRUNCATE TABLE messages, chat_rooms, blocks RESTART IDENTITY CASCADE"))
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
    for i in range(20):
        await save_message(db, room.id, "user", f"msg{i}")
    history = await get_room_history(db, room.id, limit=15)
    assert len(history) == 15
    assert history[0].content == "msg5"  # oldest within last 15


@pytest.mark.asyncio
async def test_get_room_history_returns_empty_for_unknown_room(db):
    history = await get_room_history(db, 99999)
    assert history == []


@pytest.mark.asyncio
async def test_block_user_creates_row(db):
    await block_user(db, blocker_id=1, blocked_id=2)
    assert await is_blocked(db, blocker_id=1, blocked_id=2)


@pytest.mark.asyncio
async def test_block_is_one_directional(db):
    await block_user(db, blocker_id=1, blocked_id=2)
    assert not await is_blocked(db, blocker_id=2, blocked_id=1)


@pytest.mark.asyncio
async def test_block_user_is_idempotent(db):
    await block_user(db, blocker_id=1, blocked_id=2)
    await block_user(db, blocker_id=1, blocked_id=2)  # must not raise
    assert await is_blocked(db, blocker_id=1, blocked_id=2)


@pytest.mark.asyncio
async def test_unblock_user_removes_row(db):
    await block_user(db, blocker_id=1, blocked_id=2)
    await unblock_user(db, blocker_id=1, blocked_id=2)
    assert not await is_blocked(db, blocker_id=1, blocked_id=2)


@pytest.mark.asyncio
async def test_unblock_nonexistent_raises_404(db):
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        await unblock_user(db, blocker_id=1, blocked_id=99)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_get_blocked_ids_returns_set(db):
    await block_user(db, blocker_id=1, blocked_id=2)
    await block_user(db, blocker_id=1, blocked_id=3)
    result = await get_blocked_ids(db, user_id=1)
    assert result == {2, 3}


@pytest.mark.asyncio
async def test_get_blocked_ids_empty_when_none(db):
    result = await get_blocked_ids(db, user_id=99)
    assert result == set()


@pytest.mark.asyncio
async def test_get_or_create_dm_room_uses_sorted_ids(db):
    """Room name is always DM-{min}-{max} regardless of argument order."""
    room1 = await get_or_create_dm_room(db, user_a_id=5, user_b_id=2)
    room2 = await get_or_create_dm_room(db, user_a_id=2, user_b_id=5)
    assert room1.id == room2.id
    assert room1.room_name == "DM-2-5"
    assert room1.room_type == "dm"


@pytest.mark.asyncio
async def test_get_or_create_dm_room_is_idempotent(db):
    r1 = await get_or_create_dm_room(db, user_a_id=1, user_b_id=3)
    r2 = await get_or_create_dm_room(db, user_a_id=1, user_b_id=3)
    assert r1.id == r2.id


# ---------------------------------------------------------------------------
# Endpoint tests (mocked DB — no Docker required)
# ---------------------------------------------------------------------------

def _make_session():
    """Create a mock AsyncSession that simulates database responses.
    
    Handles two critical queries for get_current_user():
    1. SELECT id FROM users WHERE credential_id = ? → returns [credential_id] (user_id=credential_id for tests)
    2. SELECT id, username, status, ... FROM users WHERE id = :uid → returns full profile row
    """
    # Mapping of test credential_ids to human-readable usernames
    _user_names = {1: "alice", 2: "bob", 3: "charlie", 4: "diana", 5: "eve", 7: "frank"}
    
    session = AsyncMock()
    
    async def mock_execute(query, params=None):
        # Create a result mock for the response
        result_mock = MagicMock()
        
        # Convert query and params to strings for matching
        query_str = str(query)
        params_str = str(params) if params else ""
        
        # Query 1: Lookup user by credential_id (returns just user_id)
        # For tests, we use credential_id as user_id for simplicity
        if "credential_id" in params_str or "cid" in params_str:
            # Extract credential_id from params dict
            if params:
                cred_id = params.get("cid", params.get("credential_id", 1))
            else:
                cred_id = 1
            result_mock.first.return_value = [cred_id]  # user_id = credential_id
        # Query 2: Get user profile by id (returns full row for CurrentUser)
        elif "uid" in params_str or ":uid" in query_str:
            # Extract user_id from params
            if params:
                uid = params.get("uid", 1)
            else:
                uid = 1
            # Use sensible username from mapping, or fallback to user{id}
            username = _user_names.get(uid, f"user{uid}")
            # Return a row matching: SELECT id, username, status, display_name, bio
            result_mock.first.return_value = (uid, username, "online", username.capitalize(), f"Bio for {username}")
        else:
            # For other queries (blocks, rooms, etc), return empty
            result_mock.first.return_value = None
        
        # Support .scalars() chain for queries using .scalars().first()
        scalars_mock = MagicMock()
        scalars_mock.first.return_value = None
        scalars_mock.all.return_value = []
        result_mock.scalars.return_value = scalars_mock
        
        return result_mock
    
    session.execute = AsyncMock(side_effect=mock_execute)
    return session


def _valid_token(credential_id: int = 1) -> str:
    from datetime import timedelta, datetime, timezone
    payload = {"sub": "alice", "credential_id": credential_id, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")


@pytest.mark.asyncio
async def test_post_dm_returns_room_name():
    session = _make_session()
    async def fake_db():
        yield session

    app.dependency_overrides[get_db] = fake_db
    try:
        with patch("main.get_or_create_dm_room", new=AsyncMock(
            return_value=MagicMock(room_name="DM-1-2")
        )):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post(
                    "/dm/2",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 200
        assert resp.json()["room_name"] == "DM-1-2"
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_post_dm_self_returns_400():
    session = _make_session()
    async def fake_db():
        yield session

    app.dependency_overrides[get_db] = fake_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/dm/1",
                headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
            )
        assert resp.status_code == 400
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_post_block_returns_204():
    session = _make_session()
    async def fake_db():
        yield session

    app.dependency_overrides[get_db] = fake_db
    try:
        with patch("main.block_user", new=AsyncMock()):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post(
                    "/block/2",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 204
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_delete_block_returns_204():
    session = _make_session()
    async def fake_db():
        yield session

    app.dependency_overrides[get_db] = fake_db
    try:
        with patch("main.unblock_user", new=AsyncMock()):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.delete(
                    "/block/2",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 204
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_get_blocked_returns_list():
    session = _make_session()
    async def fake_db():
        yield session

    app.dependency_overrides[get_db] = fake_db
    try:
        with patch("main.get_blocked_ids", new=AsyncMock(return_value={3, 5})):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get(
                    "/blocked",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 200
        assert set(resp.json()) == {3, 5}
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_endpoints_require_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.post("/dm/2")).status_code == 403
        assert (await client.post("/block/2")).status_code == 403
        assert (await client.delete("/block/2")).status_code == 403
        assert (await client.get("/blocked")).status_code == 403


@pytest.mark.asyncio
async def test_get_room_active_returns_count():
    session = _make_session()
    async def fake_db():
        yield session
    app.dependency_overrides[get_db] = fake_db
    try:
        with patch("main.manager") as mock_manager:
            mock_manager.active_connections.return_value = 1
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get(
                    "/room/DM-1-2/active",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 200
        assert resp.json() == {"active_connections": 1}
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_get_room_active_zero_when_empty():
    session = _make_session()
    async def fake_db():
        yield session
    app.dependency_overrides[get_db] = fake_db
    try:
        with patch("main.manager") as mock_manager:
            mock_manager.active_connections.return_value = 0
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get(
                    "/room/DM-3-7/active",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=3)}"},
                )
        assert resp.status_code == 200
        assert resp.json() == {"active_connections": 0}
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_get_room_active_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/room/DM-1-2/active")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_room_active_non_participant_gets_403():
    """A valid token whose uid is not in the DM slug must be rejected."""
    session = _make_session()
    async def fake_db():
        yield session
    app.dependency_overrides[get_db] = fake_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/room/DM-1-2/active",
                headers={"Authorization": f"Bearer {_valid_token(credential_id=5)}"},
            )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_get_room_active_non_dm_slug_gets_403():
    """Non-DM room slugs must be rejected even with a valid token."""
    session = _make_session()
    async def fake_db():
        yield session
    app.dependency_overrides[get_db] = fake_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/room/general/active",
                headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
            )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# General Public Rooms Tests (TDD for Task 1)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_general_room_creates_row(db):
    room = await create_general_room(db, room_name="coding", creator_name="alice")
    assert room.id is not None
    assert room.room_name == "coding"
    assert room.room_type == "general"


@pytest.mark.asyncio
async def test_create_general_room_saves_system_message(db):
    room = await create_general_room(db, room_name="gaming", creator_name="bob")
    history = await get_room_history(db, room.id)
    assert len(history) == 1
    assert history[0].sender_name == "system"
    assert "bob" in history[0].content


@pytest.mark.asyncio
async def test_create_general_room_rejects_duplicate(db):
    from fastapi import HTTPException
    await create_general_room(db, room_name="myroom", creator_name="alice")
    with pytest.raises(HTTPException) as exc:
        await create_general_room(db, room_name="myroom", creator_name="bob")
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_create_general_room_rejects_invalid_name(db):
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await create_general_room(db, room_name="!!bad!!", creator_name="alice")
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_list_live_rooms_returns_active_only(db):
    await create_general_room(db, room_name="live", creator_name="alice")
    await create_general_room(db, room_name="empty-room", creator_name="bob")
    mock_manager = MagicMock()
    mock_manager.active_connections.side_effect = lambda slug: 2 if slug == "live" else 0
    result = await list_live_rooms(db, mock_manager)
    assert len(result) == 1
    assert result[0]["room_name"] == "live"
    assert result[0]["active_connections"] == 2


@pytest.mark.asyncio
async def test_list_live_rooms_excludes_dm_rooms(db):
    await create_general_room(db, room_name="general1", creator_name="alice")
    await get_or_create_dm_room(db, user_a_id=10, user_b_id=20)
    mock_manager = MagicMock()
    mock_manager.active_connections.return_value = 1
    result = await list_live_rooms(db, mock_manager)
    names = [r["room_name"] for r in result]
    assert "general1" in names
    assert "DM-10-20" not in names


# ---------------------------------------------------------------------------
# Endpoint Tests for POST /rooms and GET /rooms (TDD for Task 2)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_post_rooms_returns_201():
    session = _make_session()
    async def fake_db():
        yield session
    app.dependency_overrides[get_db] = fake_db
    try:
        mock_create = AsyncMock(return_value=MagicMock(room_name="coding"))
        with patch("main.create_general_room", new=mock_create):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post(
                    "/rooms",
                    json={"room_name": "coding"},
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 201
        assert resp.json()["room_name"] == "coding"
        mock_create.assert_awaited_once()
        _, kwargs = mock_create.call_args
        assert kwargs["room_name"] == "coding"
        # creator_name comes from JWT sub claim, not from request body
        assert kwargs["creator_name"] == "alice"
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_post_rooms_returns_409_on_duplicate():
    from fastapi import HTTPException as FHTTPException
    session = _make_session()
    async def fake_db():
        yield session
    app.dependency_overrides[get_db] = fake_db
    try:
        with patch("main.create_general_room", new=AsyncMock(
            side_effect=FHTTPException(status_code=409, detail="Room name already exists")
        )):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post(
                    "/rooms",
                    json={"room_name": "existing"},
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 409
        assert "already exists" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_get_rooms_returns_list():
    session = _make_session()
    async def fake_db():
        yield session
    app.dependency_overrides[get_db] = fake_db
    try:
        with patch("main.list_live_rooms", new=AsyncMock(
            return_value=[{"room_name": "general", "active_connections": 3}]
        )):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get(
                    "/rooms",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["room_name"] == "general"
        assert data[0]["active_connections"] == 3
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_rooms_endpoints_require_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.post(
            "/rooms", json={"room_name": "x"}
        )).status_code == 403
        assert (await client.get("/rooms")).status_code == 403

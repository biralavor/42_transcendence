# src/backend/chat-service/tests/test_main.py
"""HTTP endpoint tests for chat-service/main.py.

Covers the endpoints NOT already tested by test_service.py:
  - POST /block/{user_id}
  - DELETE /block/{user_id}
  - GET /blocked
  - POST /rooms (create_room)
  - GET /rooms (list_live_rooms)
  - GET /room/{room_slug}/active

The /dm/{friend_id} endpoint is covered by test_service.py.
The /health and / endpoints are covered by test_health.py (separate task).

Pattern mirrors test_service.py: mock the DB session, mock get_or_create_room
and other persistence functions per-test, override get_db dependency, mint a
valid JWT for the caller.
"""
from datetime import timedelta, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt

from main import app
from shared.config.settings import settings
from shared.database import get_db


def _make_session():
    """Mock AsyncSession with credential_id → user_id resolution.

    Mirrors the helper in test_service.py — kept duplicated rather than imported
    to avoid coupling test files. Maps credential_id to user_id (same value for
    test simplicity) and returns a sensible username for get_current_user().
    """
    _user_names = {1: "alice", 2: "bob", 3: "charlie", 4: "diana", 5: "eve"}
    session = AsyncMock()

    async def mock_execute(query, params=None):
        result_mock = MagicMock()
        params_str = str(params) if params else ""
        query_str = str(query)

        if "credential_id" in params_str or "cid" in params_str:
            cred_id = params.get("cid", params.get("credential_id", 1)) if params else 1
            result_mock.first.return_value = [cred_id]
        elif "uid" in params_str or ":uid" in query_str:
            uid = params.get("uid", 1) if params else 1
            username = _user_names.get(uid, f"user{uid}")
            result_mock.first.return_value = (
                uid, username, "online", username.capitalize(), f"Bio for {username}",
            )
        else:
            result_mock.first.return_value = None

        scalars_mock = MagicMock()
        scalars_mock.first.return_value = None
        scalars_mock.all.return_value = []
        result_mock.scalars.return_value = scalars_mock
        return result_mock

    session.execute = AsyncMock(side_effect=mock_execute)
    return session


def _valid_token(credential_id: int = 1) -> str:
    payload = {
        "sub": "alice",
        "credential_id": credential_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")


def _override_db(session):
    """Helper: install a get_db override that yields the given session."""
    async def fake_db():
        yield session
    app.dependency_overrides[get_db] = fake_db


# --------------------------------------------------------------------------- #
# POST /block/{user_id}  — block a user
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_block_returns_204():
    """Successful block returns 204 No Content."""
    session = _make_session()
    _override_db(session)
    try:
        with patch("main.block_user", new=AsyncMock(return_value=None)):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post(
                    "/block/2",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 204
        assert resp.content == b""
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_block_calls_persistence_with_caller_id_as_blocker():
    """The blocker is the caller (from JWT), the blocked is the path param."""
    session = _make_session()
    _override_db(session)
    spy = AsyncMock(return_value=None)
    try:
        with patch("main.block_user", new=spy):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                await client.post(
                    "/block/42",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        spy.assert_awaited_once()
        kwargs = spy.await_args.kwargs
        assert kwargs.get("blocker_id") == 1, f"blocker should be caller (1), got {kwargs.get('blocker_id')}"
        assert kwargs.get("blocked_id") == 42, f"blocked should be path param (42), got {kwargs.get('blocked_id')}"
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_block_without_token_returns_401_or_403():
    """Block requires authentication."""
    session = _make_session()
    _override_db(session)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/block/2")
        assert resp.status_code in (401, 403), f"unauthenticated request should fail, got {resp.status_code}"
    finally:
        app.dependency_overrides.pop(get_db, None)


# --------------------------------------------------------------------------- #
# DELETE /block/{user_id}  — unblock a user
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_unblock_returns_204_on_success():
    session = _make_session()
    _override_db(session)
    try:
        with patch("main.unblock_user", new=AsyncMock(return_value=None)):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.delete(
                    "/block/2",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 204
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_unblock_propagates_404_from_persistence():
    """If unblock_user raises HTTPException(404), the endpoint returns 404."""
    from fastapi import HTTPException
    session = _make_session()
    _override_db(session)
    try:
        with patch("main.unblock_user", new=AsyncMock(
            side_effect=HTTPException(status_code=404, detail="Block not found")
        )):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.delete(
                    "/block/99",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Block not found"
    finally:
        app.dependency_overrides.pop(get_db, None)


# --------------------------------------------------------------------------- #
# GET /blocked  — list blocked user IDs
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_blocked_returns_sorted_list_of_ids():
    """The endpoint returns the blocked IDs as a sorted list (helps the frontend
    render deterministically)."""
    session = _make_session()
    _override_db(session)
    try:
        with patch("main.get_blocked_ids", new=AsyncMock(return_value={42, 7, 99})):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get(
                    "/blocked",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 200
        assert resp.json() == [7, 42, 99]
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_blocked_returns_empty_list_when_none_blocked():
    session = _make_session()
    _override_db(session)
    try:
        with patch("main.get_blocked_ids", new=AsyncMock(return_value=set())):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get(
                    "/blocked",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 200
        assert resp.json() == []
    finally:
        app.dependency_overrides.pop(get_db, None)


# --------------------------------------------------------------------------- #
# POST /rooms  — create a general public room
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_post_rooms_returns_201_with_room_name():
    """Successful room creation returns 201 + the room_name."""
    session = _make_session()
    _override_db(session)
    fake_room = MagicMock(room_name="general-test-room")
    try:
        with patch("main.create_general_room", new=AsyncMock(return_value=fake_room)):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post(
                    "/rooms",
                    json={"room_name": "general-test-room"},
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 201
        assert resp.json()["room_name"] == "general-test-room"
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_post_rooms_propagates_400_for_invalid_name():
    """If create_general_room raises 400 (invalid name), the endpoint returns 400."""
    from fastapi import HTTPException
    session = _make_session()
    _override_db(session)
    try:
        with patch("main.create_general_room", new=AsyncMock(
            side_effect=HTTPException(status_code=400, detail="Invalid room name")
        )):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post(
                    "/rooms",
                    json={"room_name": ""},
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 400
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_post_rooms_propagates_409_for_duplicate_name():
    from fastapi import HTTPException
    session = _make_session()
    _override_db(session)
    try:
        with patch("main.create_general_room", new=AsyncMock(
            side_effect=HTTPException(status_code=409, detail="Room name already exists")
        )):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.post(
                    "/rooms",
                    json={"room_name": "duplicate"},
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 409
    finally:
        app.dependency_overrides.pop(get_db, None)


# --------------------------------------------------------------------------- #
# GET /rooms  — list persisted general rooms
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_get_rooms_returns_list_from_persistence():
    """Endpoint forwards persisted rooms and their active counts."""
    session = _make_session()
    _override_db(session)
    fake_rooms = [
        {"room_name": "general-1", "active_connections": 3},
        {"room_name": "general-2", "active_connections": 1},
    ]
    try:
        with patch("main.list_live_rooms", new=AsyncMock(return_value=fake_rooms)):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get(
                    "/rooms",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 200
        assert resp.json() == fake_rooms
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_get_rooms_returns_empty_list_when_no_rooms():
    session = _make_session()
    _override_db(session)
    try:
        with patch("main.list_live_rooms", new=AsyncMock(return_value=[])):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get(
                    "/rooms",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 200
        assert resp.json() == []
    finally:
        app.dependency_overrides.pop(get_db, None)


# --------------------------------------------------------------------------- #
# GET /room/{room_slug}/active  — DM-room active connection count
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_room_active_returns_count_for_authorized_dm_participant():
    """Caller who is participant in DM-1-2 can read the active count."""
    session = _make_session()
    _override_db(session)
    fake_manager = MagicMock()
    fake_manager.active_connections = MagicMock(return_value=2)
    try:
        with patch("main.manager", fake_manager):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get(
                    "/room/DM-1-2/active",
                    headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
                )
        assert resp.status_code == 200
        assert resp.json() == {"active_connections": 2}
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_room_active_returns_403_for_non_dm_slug():
    """Slugs that don't match the DM-{lo}-{hi} pattern are rejected."""
    session = _make_session()
    _override_db(session)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/room/general-room/active",
                headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
            )
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Not a DM room"
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_room_active_returns_403_when_caller_not_in_dm():
    """Caller user_id=1 trying to peek into DM-7-9 (where they're not a participant) → 403."""
    session = _make_session()
    _override_db(session)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/room/DM-7-9/active",
                headers={"Authorization": f"Bearer {_valid_token(credential_id=1)}"},
            )
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Not a participant"
    finally:
        app.dependency_overrides.pop(get_db, None)

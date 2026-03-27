# src/backend/user-service/tests/test_friends.py
from unittest.mock import MagicMock

from httpx import AsyncClient, ASGITransport
from service.main import app


async def test_list_friends_empty_for_unknown_user():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/friends/9999")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_requests_empty_for_unknown_user():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/friends/9999/requests")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_remove_friend_not_found():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.delete("/friends/9999/8888")
    assert resp.status_code == 404


async def test_accept_request_not_found():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.put("/friends/9999/accept/8888")
    assert resp.status_code == 404


async def test_decline_request_not_found():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.delete("/friends/9999/decline/8888")
    assert resp.status_code == 404


async def test_accept_request_forbidden_for_non_recipient():
    """User cannot accept a request addressed to someone else."""
    from service.main import get_current_user

    fake_user = MagicMock()
    fake_user.id = 1  # JWT user is id=1, but path says user_id=2

    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.put("/friends/2/accept/8888")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403


async def test_decline_request_forbidden_for_non_recipient():
    """User cannot decline a request addressed to someone else."""
    from service.main import get_current_user

    fake_user = MagicMock()
    fake_user.id = 1  # JWT user is id=1, but path says user_id=2

    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete("/friends/2/decline/8888")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403


async def test_search_users_empty():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/search?q=nobody")
    assert resp.status_code == 200
    assert resp.json() == []

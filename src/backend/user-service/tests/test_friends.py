# src/backend/user-service/tests/test_friends.py
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


async def test_search_users_empty():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/search?q=nobody")
    assert resp.status_code == 200
    assert resp.json() == []

# src/backend/user-service/tests/test_profile.py
from httpx import AsyncClient, ASGITransport
from service.main import app


async def test_get_profile_not_found():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/profile/9999")
    assert resp.status_code == 404


async def test_update_profile_not_found():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.put("/profile/9999", json={"display_name": "X"})
    assert resp.status_code == 404

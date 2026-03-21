from httpx import AsyncClient, ASGITransport
from service.main import app


async def test_history_empty_for_unknown_user():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/matches/history/9999")
    assert resp.status_code == 200
    assert resp.json() == []

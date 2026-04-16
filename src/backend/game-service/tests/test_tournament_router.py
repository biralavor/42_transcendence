import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from main import app
from service import router as router_module
from service.auth import get_current_user_id
from shared.config.settings import settings
from shared.database import get_db

try:
    from service.auth import get_current_token  # type: ignore
except ImportError:  # pragma: no cover
    get_current_token = None  # type: ignore


_engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
_TestSession = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


async def _override_get_db():
    async with _TestSession() as session:
        yield session


@pytest_asyncio.fixture
async def client_and_user(monkeypatch):
    async with _engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE TABLE tournament_matches, tournament_participants, "
                "tournaments, matches, users, credentials RESTART IDENTITY CASCADE"
            )
        )
        for uid in range(1, 10):
            cid = uid + 10000
            await conn.execute(
                text(
                    "INSERT INTO credentials (id, username, password) "
                    "VALUES (:id, :username, 'fake')"
                ),
                {"id": cid, "username": f"cred_{uid}"},
            )
            await conn.execute(
                text(
                    "INSERT INTO users (id, username, credential_id) "
                    "VALUES (:id, :username, :cid)"
                ),
                {"id": uid, "username": f"user{uid}", "cid": cid},
            )

    current = {"id": 1}

    async def _override_current_user_id():
        return current["id"]

    async def _override_current_token():
        return "test-token"

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user_id] = _override_current_user_id
    if get_current_token is not None:
        app.dependency_overrides[get_current_token] = _override_current_token

    # Disable external notification side effects if present in this branch state.
    async def _noop(*args, **kwargs):
        return None

    for name in (
        "_notify_match_available",
        "_notify_tournament_complete",
        "send_tournament_notification",
        "_notify_tournament_full",
    ):
        if hasattr(router_module, name):
            monkeypatch.setattr(router_module, name, _noop)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac, current

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_tournament_returns_201_and_join_link(client_and_user):
    client, _ = client_and_user
    resp = await client.post("/tournaments", json={"name": "Cup", "max_participants": 4})

    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] is not None
    assert data["join_link"] == f"/api/game/tournaments/{data['id']}/join"


@pytest.mark.asyncio
async def test_creator_is_auto_registered_and_detail_returns_participants(client_and_user):
    client, _ = client_and_user
    create = await client.post("/tournaments", json={"name": "Cup", "max_participants": 4})
    tournament_id = create.json()["id"]

    detail = await client.get(f"/tournaments/{tournament_id}")
    assert detail.status_code == 200
    data = detail.json()
    assert data["creator_id"] == 1
    assert data["status"] == "open"
    assert len(data["participants"]) == 1
    assert data["participants"][0]["user_id"] == 1


@pytest.mark.asyncio
async def test_join_tournament_adds_participants(client_and_user):
    client, current = client_and_user
    create = await client.post("/tournaments", json={"name": "Cup", "max_participants": 4})
    tournament_id = create.json()["id"]

    for uid in (2, 3, 4):
        current["id"] = uid
        join = await client.post(f"/tournaments/{tournament_id}/join")
        assert join.status_code == 201

    detail = await client.get(f"/tournaments/{tournament_id}")
    assert detail.status_code == 200
    data = detail.json()
    assert sorted(p["user_id"] for p in data["participants"]) == [1, 2, 3, 4]


@pytest.mark.asyncio
async def test_user_cannot_create_second_active_tournament(client_and_user):
    client, _ = client_and_user
    first = await client.post("/tournaments", json={"name": "Cup A", "max_participants": 4})
    assert first.status_code == 201

    second = await client.post("/tournaments", json={"name": "Cup B", "max_participants": 4})
    assert second.status_code == 409
    assert "active tournament" in second.json()["detail"]


@pytest.mark.asyncio
async def test_user_cannot_join_another_active_tournament(client_and_user):
    client, current = client_and_user

    current["id"] = 1
    t1 = (await client.post("/tournaments", json={"name": "Cup A", "max_participants": 4})).json()["id"]
    current["id"] = 2
    _ = (await client.post("/tournaments", json={"name": "Cup B", "max_participants": 4})).json()["id"]

    current["id"] = 2
    join = await client.post(f"/tournaments/{t1}/join")
    assert join.status_code == 409
    assert "active tournament" in join.json()["detail"]


@pytest.mark.asyncio
async def test_start_tournament_requires_full_slots_and_creator(client_and_user):
    client, current = client_and_user
    create = await client.post("/tournaments", json={"name": "Cup", "max_participants": 4})
    tournament_id = create.json()["id"]

    not_full = await client.post(f"/tournaments/{tournament_id}/start")
    assert not_full.status_code == 409

    for uid in (2, 3, 4):
        current["id"] = uid
        joined = await client.post(f"/tournaments/{tournament_id}/join")
        assert joined.status_code == 201

    current["id"] = 2
    not_creator = await client.post(f"/tournaments/{tournament_id}/start")
    assert not_creator.status_code == 403

    current["id"] = 1
    start = await client.post(f"/tournaments/{tournament_id}/start")
    assert start.status_code == 200
    data = start.json()
    assert data["status"] == "in_progress"
    assert len(data["matches"]) == 6
    assert sum(1 for m in data["matches"] if m["status"] == "in_progress") == 2


@pytest.mark.asyncio
async def test_record_tournament_result_endpoint_persists_scores(client_and_user):
    client, current = client_and_user
    tournament_id = (await client.post("/tournaments", json={"name": "Cup", "max_participants": 4})).json()["id"]
    for uid in (2, 3, 4):
        current["id"] = uid
        joined = await client.post(f"/tournaments/{tournament_id}/join")
        assert joined.status_code == 201

    current["id"] = 1
    started = await client.post(f"/tournaments/{tournament_id}/start")
    assert started.status_code == 200
    active_match = next(m for m in started.json()["matches"] if m["status"] == "in_progress")

    resp = await client.post(
        f"/tournaments/{tournament_id}/matches/{active_match['match_id']}/result",
        json={
            "winner_id": active_match["player1_id"],
            "score_p1": 7,
            "score_p2": 3,
        },
    )
    assert resp.status_code == 200
    refreshed = await client.get(f"/tournaments/{tournament_id}")
    updated = next(m for m in refreshed.json()["matches"] if m["id"] == active_match["id"])
    assert updated["status"] == "finished"
    assert updated["winner_id"] == active_match["player1_id"]
    assert updated["score_p1"] == 7
    assert updated["score_p2"] == 3


@pytest.mark.asyncio
async def test_leave_open_tournament_removes_participant(client_and_user):
    client, current = client_and_user
    tournament_id = (await client.post("/tournaments", json={"name": "Cup", "max_participants": 4})).json()["id"]

    current["id"] = 2
    joined = await client.post(f"/tournaments/{tournament_id}/join")
    assert joined.status_code == 201

    leave = await client.post(f"/tournaments/{tournament_id}/leave")
    assert leave.status_code == 204

    current["id"] = 1
    detail = await client.get(f"/tournaments/{tournament_id}")
    participants = sorted(p["user_id"] for p in detail.json()["participants"])
    assert participants == [1]


@pytest.mark.asyncio
async def test_delete_open_tournament_requires_creator(client_and_user):
    client, current = client_and_user
    tournament_id = (await client.post("/tournaments", json={"name": "Cup", "max_participants": 4})).json()["id"]

    current["id"] = 2
    forbidden = await client.delete(f"/tournaments/{tournament_id}")
    assert forbidden.status_code == 403

    current["id"] = 1
    deleted = await client.delete(f"/tournaments/{tournament_id}")
    assert deleted.status_code == 204

    missing = await client.get(f"/tournaments/{tournament_id}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_withdraw_in_progress_tournament_marks_progress_and_keeps_tournament_accessible(client_and_user):
    client, current = client_and_user
    tournament_id = (await client.post("/tournaments", json={"name": "Cup", "max_participants": 4})).json()["id"]
    for uid in (2, 3, 4):
        current["id"] = uid
        joined = await client.post(f"/tournaments/{tournament_id}/join")
        assert joined.status_code == 201

    current["id"] = 1
    started = await client.post(f"/tournaments/{tournament_id}/start")
    assert started.status_code == 200
    active_match = next(m for m in started.json()["matches"] if m["status"] == "in_progress")
    withdrawing_user = active_match["player1_id"]

    current["id"] = withdrawing_user
    withdraw = await client.post(f"/tournaments/{tournament_id}/withdraw")
    assert withdraw.status_code == 200
    data = withdraw.json()
    affected = [m for m in data["matches"] if withdrawing_user in (m["player1_id"], m["player2_id"])]
    assert affected
    assert all(m["status"] == "finished" for m in affected)
    assert all(m["winner_id"] != withdrawing_user for m in affected)

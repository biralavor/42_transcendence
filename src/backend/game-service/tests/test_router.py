import asyncio

import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from starlette.testclient import TestClient

from shared.database import Base, get_db
from main import app

# --------------------------------------------------------------------------- #
# Shared in-memory SQLite DB for all HTTP tests in this module
# --------------------------------------------------------------------------- #

_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
_TestSession = sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


async def _override_get_db():
    async with _TestSession() as session:
        yield session


def setup_module(_):
    async def _create():
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    asyncio.run(_create())


def teardown_module(_):
    asyncio.run(_engine.dispose())


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


# --------------------------------------------------------------------------- #
# POST /matches
# --------------------------------------------------------------------------- #

def test_start_match_returns_201(client):
    resp = client.post("/matches", json={"player1_id": 1, "player2_id": 2})
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] is not None
    assert data["player1_id"] == 1
    assert data["player2_id"] == 2
    assert data["status"] == "ongoing"
    assert data["winner_id"] is None


# --------------------------------------------------------------------------- #
# POST /matches/{match_id}/finish
# --------------------------------------------------------------------------- #

def test_finish_match_returns_updated(client):
    match_id = client.post("/matches", json={"player1_id": 1, "player2_id": 2}).json()["id"]
    resp = client.post(f"/matches/{match_id}/finish", json={"winner_id": 1, "score_p1": 7, "score_p2": 3})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "finished"
    assert data["winner_id"] == 1
    assert data["score_p1"] == 7
    assert data["score_p2"] == 3


def test_finish_match_404_for_unknown_id(client):
    resp = client.post("/matches/99999/finish", json={"winner_id": 1, "score_p1": 7, "score_p2": 3})
    assert resp.status_code == 404


def test_finish_match_409_if_already_finished(client):
    match_id = client.post("/matches", json={"player1_id": 1, "player2_id": 2}).json()["id"]
    client.post(f"/matches/{match_id}/finish", json={"winner_id": 1, "score_p1": 7, "score_p2": 3})
    resp = client.post(f"/matches/{match_id}/finish", json={"winner_id": 1, "score_p1": 7, "score_p2": 3})
    assert resp.status_code == 409


# --------------------------------------------------------------------------- #
# GET /stats/{user_id}
# --------------------------------------------------------------------------- #

def test_get_stats_empty_for_new_user(client):
    resp = client.get("/stats/999")
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == 999
    assert data["wins"] == 0
    assert data["losses"] == 0
    assert data["total_games"] == 0


def test_get_stats_reflects_finished_matches(client):
    match_id = client.post("/matches", json={"player1_id": 10, "player2_id": 20}).json()["id"]
    client.post(f"/matches/{match_id}/finish", json={"winner_id": 10, "score_p1": 7, "score_p2": 2})

    resp = client.get("/stats/10")
    assert resp.status_code == 200
    data = resp.json()
    assert data["wins"] == 1
    assert data["losses"] == 0
    assert data["total_games"] == 1
    assert data["goals_scored"] == 7
    assert data["goals_conceded"] == 2


# --------------------------------------------------------------------------- #
# GET /matches/{user_id}
# --------------------------------------------------------------------------- #

def test_get_matches_empty_for_new_user(client):
    resp = client.get("/matches/888")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_matches_returns_both_sides(client):
    # user 30 plays as player1 and as player2
    client.post("/matches", json={"player1_id": 30, "player2_id": 99})
    client.post("/matches", json={"player1_id": 99, "player2_id": 30})

    resp = client.get("/matches/30")
    assert resp.status_code == 200
    assert len(resp.json()) == 2

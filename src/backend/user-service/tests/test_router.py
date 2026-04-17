import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import text
from httpx import AsyncClient, ASGITransport

from shared.config.settings import settings
from shared.database import get_db
from main import app

# --------------------------------------------------------------------------- #
# Shared PostgreSQL engine for all HTTP tests in this module
# --------------------------------------------------------------------------- #

_engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
_TestSession = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


async def _override_get_db():
    async with _TestSession() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    async with _engine.begin() as conn:

        app.dependency_overrides[get_db] = _override_get_db
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_search_without_query_returns_400(client):
    resp = await client.get("/search")
    assert resp.status_code == 400
    resp = await client.get("/search?q")
    assert resp.status_code == 400
    resp = await client.get("/search?q=")
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_search_with_query_returns_200(client):

    resp = await client.get("/search?q=a")
    assert resp.status_code == 200

@pytest.mark.asyncio
async def test_search_with_query_returns_schema(client):

    resp = await client.get("/search?q=a")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert isinstance(data.get('results'), list)
    assert isinstance(data.get('total'), int)
    assert isinstance(data.get('page'), int)
    assert isinstance(data.get('per_page'), int)

# # --------------------------------------------------------------------------- #
# # POST /matches/{match_id}/finish
# # --------------------------------------------------------------------------- #

# @pytest.mark.asyncio
# async def test_finish_match_returns_updated(client):
#     resp_create = await client.post("/matches", json={"player1_id": 5001, "player2_id": 5002})
#     match_id = resp_create.json()["id"]
#     resp = await client.post(f"/matches/{match_id}/finish", json={"winner_id": 5001, "score_p1": 7, "score_p2": 3})
#     assert resp.status_code == 200
#     data = resp.json()
#     assert data["status"] == "finished"
#     assert data["winner_id"] == 5001
#     assert data["score_p1"] == 7
#     assert data["score_p2"] == 3


# @pytest.mark.asyncio
# async def test_finish_match_404_for_unknown_id(client):
#     resp = await client.post("/matches/99999/finish", json={"winner_id": 5001, "score_p1": 7, "score_p2": 3})
#     assert resp.status_code == 404


# @pytest.mark.asyncio
# async def test_finish_match_409_if_already_finished(client):
#     resp_create = await client.post("/matches", json={"player1_id": 5001, "player2_id": 5002})
#     match_id = resp_create.json()["id"]
#     await client.post(f"/matches/{match_id}/finish", json={"winner_id": 5001, "score_p1": 7, "score_p2": 3})
#     resp = await client.post(f"/matches/{match_id}/finish", json={"winner_id": 5001, "score_p1": 7, "score_p2": 3})
#     assert resp.status_code == 409


# # --------------------------------------------------------------------------- #
# # GET /stats/{user_id}
# # --------------------------------------------------------------------------- #

# @pytest.mark.asyncio
# async def test_get_stats_empty_for_new_user(client):
#     resp = await client.get("/stats/999")
#     assert resp.status_code == 200
#     data = resp.json()
#     assert data["user_id"] == 999
#     assert data["wins"] == 0
#     assert data["losses"] == 0
#     assert data["total_games"] == 0


# @pytest.mark.asyncio
# async def test_get_stats_reflects_finished_matches(client):
#     resp_create = await client.post("/matches", json={"player1_id": 5010, "player2_id": 5020})
#     match_id = resp_create.json()["id"]
#     await client.post(f"/matches/{match_id}/finish", json={"winner_id": 5010, "score_p1": 7, "score_p2": 2})

#     resp = await client.get("/stats/5010")
#     assert resp.status_code == 200
#     data = resp.json()
#     assert data["wins"] == 1
#     assert data["losses"] == 0
#     assert data["total_games"] == 1
#     assert data["goals_scored"] == 7
#     assert data["goals_conceded"] == 2


# # --------------------------------------------------------------------------- #
# # GET /matches/{user_id}
# # --------------------------------------------------------------------------- #

# @pytest.mark.asyncio
# async def test_get_matches_empty_for_new_user(client):
#     resp = await client.get("/matches/888")
#     assert resp.status_code == 200
#     assert resp.json() == []


# @pytest.mark.asyncio
# async def test_get_matches_returns_both_sides(client):
#     # user 5030 plays as player1 and as player2
#     await client.post("/matches", json={"player1_id": 5030, "player2_id": 5999})
#     await client.post("/matches", json={"player1_id": 5999, "player2_id": 5030})

#     resp = await client.get("/matches/5030")
#     assert resp.status_code == 200
#     assert len(resp.json()) == 2


# # --------------------------------------------------------------------------- #
# # GET /leaderboard
# # --------------------------------------------------------------------------- #

# @pytest.mark.asyncio
# async def test_get_leaderboard_returns_ranked_rows(client):
#     resp1 = await client.post("/matches", json={"player1_id": 5001, "player2_id": 5002})
#     m1 = resp1.json()["id"]
#     await client.post(f"/matches/{m1}/finish", json={"winner_id": 5001, "score_p1": 7, "score_p2": 2})

#     resp2 = await client.post("/matches", json={"player1_id": 5002, "player2_id": 5003})
#     m2 = resp2.json()["id"]
#     await client.post(f"/matches/{m2}/finish", json={"winner_id": 5002, "score_p1": 4, "score_p2": 1})

#     resp = await client.get("/leaderboard")
#     assert resp.status_code == 200
#     data = resp.json()
#     print(data)
#     assert len(data['results']) == 3
#     assert data['results'][0]["rank"] == 1
#     assert data['results'][0]["user_id"] == 5001
#     assert data['results'][0]["points"] == 3


# @pytest.mark.asyncio
# async def test_get_leaderboard_honors_limit_query_param(client):
#     for user_id in [5010, 5020, 5030]:
#         resp_create = await client.post("/matches", json={"player1_id": user_id, "player2_id": 5999})
#         match_id = resp_create.json()["id"]
#         await client.post(f"/matches/{match_id}/finish", json={"winner_id": user_id, "score_p1": 3, "score_p2": 0})

#     resp = await client.get("/leaderboard?limit=2")
#     assert resp.status_code == 200
#     data = resp.json()
#     assert len(data['results']) == 2



# @pytest.mark.asyncio
# async def test_get_leaderboard_limit_one_page_one(client):
#     for user_id1 in [5001, 5001, 5002, 5003, 5001, 5020, 5030, 5030, 5030]:
#         for user_id2 in [5001, 5002, 5003, 5010, 5020, 5030, 5099, 5999]:
#             if user_id1 == user_id2:
#                 continue
#             resp_create = await client.post("/matches", json={"player1_id": user_id1, "player2_id": user_id2})
#             match_id = resp_create.json()["id"]
#             await client.post(f"/matches/{match_id}/finish", json={"winner_id": user_id1, "score_p1": 1, "score_p2": 0})

#     resp = await client.get("/leaderboard?limit=1&page=1")
#     assert resp.status_code == 200
#     data = resp.json()
#     assert data['page'] == 1
#     assert data['per_page'] == 1
#     assert data['last_page'] == 7
#     assert data['total'] == 8
#     results = data['results']
#     assert len(results) == 1
#     assert results[0]['rank'] == 2
#     assert results[0]['max_streak'] == 21
#     assert results[0]['current_streak'] == 21
#     assert results[0]['total_games'] == 27
#     assert results[0]['wins'] == 21
#     assert results[0]['losses'] == 6
#     assert data['summary']['max_max_streak']['value'] == 21
#     assert data['summary']['max_current_streak']['value'] == 21
#     assert data['summary']['max_points']['value'] == 63

# @pytest.mark.asyncio
# async def test_get_leaderboard_limit_one_page_zero_rank_desc(client):
#     for user_id1 in [5001, 5001, 5002, 5003, 5001, 5020, 5030, 5030, 5030]:
#         for user_id2 in [5001, 5002, 5003, 5010, 5020, 5030, 5099, 5999]:
#             if user_id1 == user_id2:
#                 continue
#             resp_create = await client.post("/matches", json={"player1_id": user_id1, "player2_id": user_id2})
#             match_id = resp_create.json()["id"]
#             await client.post(f"/matches/{match_id}/finish", json={"winner_id": user_id1, "score_p1": 1, "score_p2": 0})

#     resp = await client.get("/leaderboard?limit=1&page=0&order=rank:desc")
#     assert resp.status_code == 200
#     data = resp.json()

#     assert data['page'] == 0
#     assert data['per_page'] == 1
#     assert data['last_page'] == 7
#     assert data['total'] == 8
#     results = data['results']
#     assert len(results) == 1
#     assert results[0]['rank'] == 8
#     assert results[0]['wins'] == 0
#     assert results[0]['losses'] == 9
#     assert results[0]['current_streak'] == 0
#     assert results[0]['max_streak'] == 0
#     assert results[0]['goals_scored'] == 0
#     assert results[0]['goals_conceded'] == 9
#     assert results[0]['goal_difference'] == -9
#     assert data['summary']['max_max_streak']['value'] == 21
#     assert data['summary']['max_current_streak']['value'] == 21
#     assert data['summary']['max_points']['value'] == 63

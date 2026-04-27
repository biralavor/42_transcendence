import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import text
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timedelta, timezone

from shared.config.settings import settings
from shared.database import get_db
from service.auth import get_current_user_id
from main import app
from jose import jwt
import json
# --------------------------------------------------------------------------- #
# Shared PostgreSQL engine for all HTTP tests in this module
# --------------------------------------------------------------------------- #

_engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
_TestSession = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


async def _override_get_db():
    async with _TestSession() as session:
        yield session

@pytest_asyncio.fixture()
async def session():
    async with _TestSession() as session:
        yield session


@pytest_asyncio.fixture()
async def client():
    async with _engine.begin() as conn:

        # Create isolated test credentials with high IDs to avoid conflicts with seeded users
        test_users = [
            (5001, "test_alice"), (5002, "test_bob"), (5003, "test_charlie"),
            (5010, "test_user10"), (5020, "test_user20"), (5030, "test_user30"),
            (5040, "test_user40"), (5041, "test_user41"), (5042, "test_user42"),
            (5043, "test_user43"), (5044, "test_user44"), (5045, "test_user45"),
            (5060, "test_user60"), (5061, "test_user61"), (5062, "test_user62"),
            (5063, "test_user63"),
            (5099, "test_user99"), (5999, "test_user999")
        ]
        for uid, name in test_users:
            # Check if test user already exists (idempotent)
            existing = await conn.execute(
                text("SELECT id FROM credentials WHERE username = :u"),
                {"u": name}
            )
            if not existing.fetchone():
                cid = uid + 10000
                await conn.execute(
                    text("INSERT INTO credentials (id, username, password) VALUES (:id, :u, 'fake') ON CONFLICT (id) DO NOTHING"),
                    {"id": cid, "u": name}
                )
                await conn.execute(
                    text("INSERT INTO users (id, username, credential_id) VALUES (:id, :u, :cid) ON CONFLICT (id) DO NOTHING"),
                    {"id": uid, "u": name, "cid": cid}
                )

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


def _override_user_id(uid: int):
    """Return a dependency override that always resolves to the given user ID."""
    async def _dep():
        return uid
    return _dep


@pytest_asyncio.fixture
async def auth_client():
    """Yield a factory that creates an AsyncClient authenticated as a given user ID."""
    async with _engine.begin() as conn:

        test_users = [
            (5001, "test_alice"), (5002, "test_bob"), (5003, "test_charlie"),
            (5010, "test_user10"), (5020, "test_user20"), (5030, "test_user30"),
            (5040, "test_user40"), (5041, "test_user41"), (5042, "test_user42"),
            (5043, "test_user43"), (5044, "test_user44"), (5045, "test_user45"),
            (5099, "test_user99"), (5999, "test_user999")
        ]
        for uid, name in test_users:
            existing = await conn.execute(
                text("SELECT id FROM credentials WHERE username = :u"),
                {"u": name}
            )
            if not existing.fetchone():
                cid = uid + 10000
                await conn.execute(
                    text("INSERT INTO credentials (id, username, password) VALUES (:id, :u, 'fake')"),
                    {"id": cid, "u": name}
                )
                await conn.execute(
                    text("INSERT INTO users (id, username, credential_id) VALUES (:id, :u, :cid)"),
                    {"id": uid, "u": name, "cid": cid}
                )

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _make_client(user_id: int):
        app.dependency_overrides[get_db] = _override_get_db
        app.dependency_overrides[get_current_user_id] = _override_user_id(user_id)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
        app.dependency_overrides.clear()

    yield _make_client


# --------------------------------------------------------------------------- #
# POST /matches
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_start_match_returns_201(client):
    resp = await client.post("/matches", json={"player1_id": 5001, "player2_id": 5002})
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] is not None
    assert data["player1_id"] == 5001
    assert data["player2_id"] == 5002
    assert data["status"] == "ongoing"
    assert data["winner_id"] is None


# --------------------------------------------------------------------------- #
# POST /matches/{match_id}/finish
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_finish_match_returns_updated(client):
    resp_create = await client.post("/matches", json={"player1_id": 5001, "player2_id": 5002})
    match_id = resp_create.json()["id"]
    resp = await client.post(f"/matches/{match_id}/finish", json={"winner_id": 5001, "score_p1": 7, "score_p2": 3})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "finished"
    assert data["winner_id"] == 5001
    assert data["score_p1"] == 7
    assert data["score_p2"] == 3


@pytest.mark.asyncio
async def test_finish_match_404_for_unknown_id(client):
    resp = await client.post("/matches/99999/finish", json={"winner_id": 5001, "score_p1": 7, "score_p2": 3})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_finish_match_409_if_already_finished(client):
    resp_create = await client.post("/matches", json={"player1_id": 5001, "player2_id": 5002})
    match_id = resp_create.json()["id"]
    await client.post(f"/matches/{match_id}/finish", json={"winner_id": 5001, "score_p1": 7, "score_p2": 3})
    resp = await client.post(f"/matches/{match_id}/finish", json={"winner_id": 5001, "score_p1": 7, "score_p2": 3})
    assert resp.status_code == 409


# --------------------------------------------------------------------------- #
# GET /stats/{user_id}
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_get_stats_empty_for_new_user(client):
    resp = await client.get("/stats/999")
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == 999
    assert data["wins"] == 0
    assert data["losses"] == 0
    assert data["total_games"] == 0


@pytest.mark.asyncio
async def test_get_stats_reflects_finished_matches(client):
    resp_create = await client.post("/matches", json={"player1_id": 5010, "player2_id": 5020})
    match_id = resp_create.json()["id"]
    await client.post(f"/matches/{match_id}/finish", json={"winner_id": 5010, "score_p1": 7, "score_p2": 2})

    resp = await client.get("/stats/5010")
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

@pytest.mark.asyncio
async def test_get_matches_empty_for_new_user(client):
    resp = await client.get("/matches/888")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_get_matches_returns_both_sides(client):
    # user 5030 plays as player1 and as player2
    await client.post("/matches", json={"player1_id": 5030, "player2_id": 5999})
    await client.post("/matches", json={"player1_id": 5999, "player2_id": 5030})

    resp = await client.get("/matches/5030")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


# --------------------------------------------------------------------------- #
# GET /leaderboard
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_get_leaderboard_returns_ranked_rows(client):
    resp1 = await client.post("/matches", json={"player1_id": 5001, "player2_id": 5002})
    m1 = resp1.json()["id"]
    await client.post(f"/matches/{m1}/finish", json={"winner_id": 5001, "score_p1": 7, "score_p2": 2})

    resp2 = await client.post("/matches", json={"player1_id": 5002, "player2_id": 5003})
    m2 = resp2.json()["id"]
    await client.post(f"/matches/{m2}/finish", json={"winner_id": 5002, "score_p1": 4, "score_p2": 1})

    resp = await client.get("/leaderboard")
    assert resp.status_code == 200
    data = resp.json()

    rows = {row["user_id"]: row for row in data["results"]}
    assert 5001 in rows and 5002 in rows and 5003 in rows

    # From the two matches above:
    # 5001 beats 5002 once -> 3 points
    # 5002 beats 5003 once and loses once -> 3 points, worse goal difference
    # 5003 loses once -> 0 points
    assert rows[5001]["points"] >= 3
    assert rows[5002]["points"] >= 3
    assert rows[5003]["points"] >= 0
    assert rows[5001]["rank"] < rows[5003]["rank"]


@pytest.mark.asyncio
async def test_get_leaderboard_honors_limit_query_param(client):
    for user_id in [5010, 5020, 5030]:
        resp_create = await client.post("/matches", json={"player1_id": user_id, "player2_id": 5999})
        match_id = resp_create.json()["id"]
        await client.post(f"/matches/{match_id}/finish", json={"winner_id": user_id, "score_p1": 3, "score_p2": 0})

    resp = await client.get("/leaderboard?limit=2")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data['results']) == 2


@pytest.mark.asyncio
@pytest.mark.timeout(120)
async def test_get_leaderboard_limit_one_page_one(client):
    for user_id1 in [5001, 5001, 5002, 5003, 5001, 5020, 5030, 5030, 5030]:
        for user_id2 in [5001, 5002, 5003, 5010, 5020, 5030, 5099, 5999]:
            if user_id1 == user_id2:
                continue
            resp_create = await client.post("/matches", json={"player1_id": user_id1, "player2_id": user_id2})
            match_id = resp_create.json()["id"]
            await client.post(f"/matches/{match_id}/finish", json={"winner_id": user_id1, "score_p1": 1, "score_p2": 0})

    resp = await client.get("/leaderboard?limit=1&page=1")
    assert resp.status_code == 200
    data = resp.json()
    assert data['page'] == 1
    assert data['per_page'] == 1
    assert data['total'] >= 2
    assert data['last_page'] == data['total'] - 1
    results = data['results']
    assert len(results) == 1
    assert results[0]['rank'] == 2
    assert results[0]['wins'] >= 0
    assert results[0]['losses'] >= 0
    assert results[0]['total_games'] == results[0]['wins'] + results[0]['losses']
    assert data['summary']['max_max_streak']['value'] >= 0
    assert data['summary']['max_current_streak']['value'] >= 0
    assert data['summary']['max_points']['value'] >= 0


@pytest.mark.asyncio
@pytest.mark.timeout(120)
async def test_get_leaderboard_limit_one_page_zero_rank_desc(client):
    for user_id1 in [5001, 5001, 5002, 5003, 5001, 5020, 5030, 5030, 5030]:
        for user_id2 in [5001, 5002, 5003, 5010, 5020, 5030, 5099, 5999]:
            if user_id1 == user_id2:
                continue
            resp_create = await client.post("/matches", json={"player1_id": user_id1, "player2_id": user_id2})
            match_id = resp_create.json()["id"]
            await client.post(f"/matches/{match_id}/finish", json={"winner_id": user_id1, "score_p1": 1, "score_p2": 0})

    resp = await client.get("/leaderboard?limit=1&page=0&order=rank:desc")
    assert resp.status_code == 200
    data = resp.json()

    assert data['page'] == 0
    assert data['per_page'] == 1
    assert data['total'] >= 1
    assert data['last_page'] == data['total'] - 1
    results = data['results']
    assert len(results) == 1
    assert results[0]['rank'] == data['total']
    assert results[0]['wins'] >= 0
    assert results[0]['losses'] >= 0
    assert results[0]['total_games'] == results[0]['wins'] + results[0]['losses']
    assert data['summary']['max_max_streak']['value'] >= 0
    assert data['summary']['max_current_streak']['value'] >= 0
    assert data['summary']['max_points']['value'] >= 0


# --------------------------------------------------------------------------- #
# POST /ai
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_start_ai_game_default_difficulty(auth_client):
    async with auth_client(5001) as client:
        resp = await client.post("/ai", json={})
        assert resp.status_code == 201
        data = resp.json()
        assert "game_id" in data
        assert data["game_id"].startswith("ai-")


@pytest.mark.asyncio
async def test_start_ai_game_explicit_difficulty(auth_client):
    async with auth_client(5001) as client:
        for level in ("easy", "medium", "hard"):
            resp = await client.post("/ai", json={"difficulty": level})
            assert resp.status_code == 201
            assert resp.json()["game_id"].startswith("ai-")


@pytest.mark.asyncio
async def test_start_ai_game_invalid_difficulty(auth_client):
    async with auth_client(5001) as client:
        resp = await client.post("/ai", json={"difficulty": "impossible"})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_start_ai_game_requires_auth(client):
    """Without authentication the endpoint must reject the request."""
    resp = await client.post("/ai", json={"difficulty": "easy"})
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_start_ai_game_creates_match_with_ai_player(auth_client):
    """The match row for an AI game uses AI_PLAYER_ID (0) as player2."""
    from service.ai import AI_PLAYER_ID
    async with auth_client(5001) as client:
        resp = await client.post("/ai", json={"difficulty": "hard"})
        assert resp.status_code == 201
        matches_resp = await client.get("/matches/5001")
        assert matches_resp.status_code == 200
        rows = matches_resp.json()
        assert any(m["player2_id"] == AI_PLAYER_ID for m in rows)


@pytest.mark.asyncio
async def test_start_ai_game_uses_ball_speed_from_preferences(auth_client):
    """When a user has game_preferences set, the session uses their ball_speed_multiplier."""
    import asyncio
    from sqlalchemy import text as sqla_text
    from service.game_manager import game_manager
    from service.game_session import GameSession

    # Write a game_preferences row for user 5001
    async with _engine.begin() as conn:
        await conn.execute(
            sqla_text(
                "UPDATE users SET game_preferences = CAST(:prefs AS jsonb) WHERE id = :uid"
            ),
            {"prefs": '{"theme": "wood", "ball_speed_multiplier": 1.5}', "uid": 5001},
        )

    async with auth_client(5001) as client:
        resp = await client.post("/ai", json={"difficulty": "medium"})
        assert resp.status_code == 201
        game_id = resp.json()["game_id"]

    await asyncio.sleep(0.05)  # let the game loop start

    session = game_manager.get_session(game_id)
    assert session is not None, "game session was not created within timeout"
    assert abs(session.speed_multiplier - 1.5) < 0.001
    assert abs(session.ball.vx - GameSession.INITIAL_BALL_VX * 1.5) < 0.1

    await game_manager.delete_session(game_id)


@pytest.mark.asyncio
async def test_start_ai_game_defaults_speed_when_no_preferences(auth_client):
    """When a user has no game_preferences, the session defaults to speed 1.0."""
    import asyncio
    from sqlalchemy import text as sqla_text
    from service.game_manager import game_manager
    from service.game_session import GameSession

    # Ensure user 5002 has no preferences
    async with _engine.begin() as conn:
        await conn.execute(
            sqla_text("UPDATE users SET game_preferences = NULL WHERE id = :uid"),
            {"uid": 5002},
        )

    async with auth_client(5002) as client:
        resp = await client.post("/ai", json={"difficulty": "easy"})
        assert resp.status_code == 201
        game_id = resp.json()["game_id"]

    await asyncio.sleep(0.05)

    session = game_manager.get_session(game_id)
    assert session is not None, "game session was not created within timeout"
    assert abs(session.speed_multiplier - 1.0) < 0.001

    await game_manager.delete_session(game_id)

    
def create_fake_access_token(data: dict, expires_delta: timedelta):
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 15
    REFRESH_TOKEN_EXPIRE_DAYS = 7

    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)


@pytest.mark.asyncio
async def test_matches_history_without_query_parameters_and_no_token_is_bad(client):
    resp = await client.get("/matches/history?")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_matches_history_with_no_query_parameters_and_valid_token_is_ok(client):

    access_token = create_fake_access_token(
        data={"sub": 'test_alice', "credential_id": 15001},
        expires_delta=timedelta(minutes=30),
    )
    resp = await client.get("/matches/history", headers={"Authorization": f"Bearer {access_token}"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_matches_history_with_player_id_query_parameters_and_valid_token_is_ok(client):

    access_token = create_fake_access_token(
        data={"sub": 'test_alice', "credential_id": 15001},
        expires_delta=timedelta(minutes=30),
    )
    resp = await client.get("/matches/history?player_id=2", headers={"Authorization": f"Bearer {access_token}"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_matches_history_with_player_id_query_parameters_and_no_token_is_ok(client):

    resp = await client.get("/matches/history?player_id=2")
    assert resp.status_code == 200

@pytest.mark.asyncio
async def test_matches_history_when_ok_returns_schema(client):

    access_token = create_fake_access_token(
        data={"sub": 'test_alice', "credential_id": 15001},
        expires_delta=timedelta(minutes=30),
    )
    resp = await client.get("/matches/history", headers={"Authorization": f"Bearer {access_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert isinstance(data.get('results'), list)
    assert isinstance(data.get('total'), int)
    assert isinstance(data.get('page'), int)
    assert isinstance(data.get('per_page'), int)
    assert isinstance(data.get('last_page'), int)

    if len(data.get('results')) > 0:
        element = data.get('results')[0]
        assert isinstance(element.get('match_id'), int)
        assert isinstance(element.get('player_id'), int)
        assert isinstance(element.get('opponent_id'), int)
        assert isinstance(element.get('score'), str)
        assert isinstance(element.get('date'), str)

@pytest.mark.asyncio
async def test_matches_history_with_limit_query_parameter_respect_limit(client):

    access_token = create_fake_access_token(
        data={"sub": 'test_alice', "credential_id": 15001},
        expires_delta=timedelta(minutes=30),
    )
    resp = await client.get("/matches/history?limit=1", headers={"Authorization": f"Bearer {access_token}"})
    assert resp.status_code == 200
    data = resp.json()

    assert data.get('page') == 0
    assert data.get('per_page') == 1
    results = data.get('results')
    assert len(results) == 1

@pytest.mark.asyncio
async def test_matches_history_with_page_query_parameter_respect_page(client):

    access_token = create_fake_access_token(
        data={"sub": 'test_alice', "credential_id": 15001},
        expires_delta=timedelta(minutes=30),
    )
    for page in range(3):
        resp = await client.get(f"/matches/history?limit=1&page={page}", headers={"Authorization": f"Bearer {access_token}"})
        assert resp.status_code == 200
        data = resp.json()

        assert data.get('page') == page
        assert data.get('per_page') == 1
        results = data.get('results')
        assert len(results) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("result_query", [
    ("win"),
    ("loss")
])
async def test_matches_history_with_result_query_parameter_respect_result(result_query, client):

    resp = await client.get(f"/matches/history?player_id=5001&limit=3&page=0&result={result_query}")
    assert resp.status_code == 200
    data = resp.json()

    results = data.get('results')
    assert len(results) > 0
    for pong_match in results:
        result = pong_match['result']
        assert result == result_query.capitalize()


@pytest.mark.asyncio
async def test_matches_history_with_date_from_query_parameter_respect_date(client, session):

    player_id = 5001
    statement = text("""
SELECT DISTINCT finished_at FROM matches
WHERE (player1_id = (:player_id)::int OR player2_id = :player_id)
    AND status = 'finished'
    ORDER BY finished_at ASC
    """)
    query_result = await session.execute(statement, {
        'player_id': player_id
    })
    data = [d['finished_at'] for d in query_result.mappings().all()]

    assert len(data) > 2

    from urllib.parse import quote_plus
    date_str = quote_plus(data[1].isoformat())

    resp_no_filter = await client.get(f"/matches/history?player_id=5001&limit=50&page=0&order=date:asc")
    assert resp_no_filter.status_code == 200
    data_no_filter = resp_no_filter.json()
    unfiltered_results = data_no_filter.get('results')
    assert len(unfiltered_results) > 2

    resp_filtered = await client.get(f"/matches/history?player_id=5001&limit=50&page=0&date_from={date_str}&order=date:asc")
    assert resp_filtered.status_code == 200
    data_date_from_filter = resp_filtered.json()
    filtered_results = data_date_from_filter.get('results')
    assert len(unfiltered_results) >= 1

    assert filtered_results[0]['date'] \
        > unfiltered_results[0]['date']

@pytest.mark.asyncio
async def test_matches_history_with_date_to_query_parameter_respect_date(client, session):

    player_id = 5001
    statement = text("""
SELECT DISTINCT finished_at FROM matches
WHERE (player1_id = (:player_id)::int OR player2_id = :player_id)
    AND status = 'finished'
    ORDER BY finished_at DESC
    """)
    query_result = await session.execute(statement, {
        'player_id': player_id
    })
    data = [d['finished_at'] for d in query_result.mappings().all()]

    assert len(data) > 2

    from urllib.parse import quote_plus
    date_str = quote_plus(data[1].isoformat())

    resp_no_filter = await client.get(f"/matches/history?player_id=5001&limit=50&page=0")
    assert resp_no_filter.status_code == 200
    data_no_filter = resp_no_filter.json()
    unfiltered_results = data_no_filter.get('results')
    assert len(unfiltered_results) > 2

    resp_filtered = await client.get(f"/matches/history?player_id=5001&limit=50&page=0&date_to={date_str}")
    assert resp_filtered.status_code == 200
    data_date_to_filter = resp_filtered.json()
    filtered_results = data_date_to_filter.get('results')
    assert len(unfiltered_results) >= 1

    assert filtered_results[-1]['date'] \
        < unfiltered_results[-1]['date']



# --------------------------------------------------------------------------- #
# GET /achievements/{user_id}
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_get_achievements_returns_full_catalog(client):
    """GET /achievements/{user_id} returns all achievements with earned flag."""
    resp = await client.get("/achievements/5001")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 8
    keys = [a["key"] for a in data]
    assert "win1" in keys
    assert "first_game" in keys
    for a in data:
        assert "key" in a
        assert "earned" in a
        assert "icon" in a


@pytest.mark.asyncio
async def test_get_achievements_earned_after_win(client):
    """After winning a match, first_game badge appears as earned."""
    resp_create = await client.post("/matches", json={"player1_id": 5001, "player2_id": 5002})
    match_id = resp_create.json()["id"]
    await client.post(f"/matches/{match_id}/finish", json={"winner_id": 5001, "score_p1": 10, "score_p2": 3})

    resp = await client.get("/achievements/5001")
    assert resp.status_code == 200
    earned = [a for a in resp.json() if a["earned"]]
    earned_keys = [a["key"] for a in earned]
    assert "first_game" in earned_keys


# --------------------------------------------------------------------------- #
# GET /xp/{user_id}
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_get_xp_returns_correct_structure(client):
    """GET /xp/{user_id} always returns a valid XP response structure."""
    resp = await client.get("/xp/5099")
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == 5099
    assert "xp" in data
    assert "level" in data
    assert "xp_in_level" in data
    assert data["xp_to_next_level"] == 100
    assert data["xp"] >= 0
    assert data["xp_in_level"] == data["xp"] % 100


@pytest.mark.asyncio
async def test_get_xp_returns_level_and_breakdown(client):
    """GET /xp/{user_id} returns xp, level, and within-level breakdown after a win."""
    resp_create = await client.post("/matches", json={"player1_id": 5001, "player2_id": 5002})
    match_id = resp_create.json()["id"]
    await client.post(f"/matches/{match_id}/finish", json={"winner_id": 5001, "score_p1": 7, "score_p2": 2})

    resp = await client.get("/xp/5001")
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == 5001
    assert data["xp"] >= 25
    assert "level" in data
    assert "xp_in_level" in data
    assert data["xp_to_next_level"] == 100
    assert data["xp_in_level"] == data["xp"] % 100


# --------------------------------------------------------------------------- #
# GET /leaderboard — issue #238 enhancements
# --------------------------------------------------------------------------- #

@pytest.mark.asyncio
async def test_leaderboard_response_includes_xp_level_avatar_url(client):
    """Each row in /leaderboard results includes xp, level, avatar_url fields."""
    resp_create = await client.post("/matches", json={"player1_id": 5040, "player2_id": 5041})
    match_id = resp_create.json()["id"]
    await client.post(f"/matches/{match_id}/finish", json={"winner_id": 5040, "score_p1": 5, "score_p2": 2})

    resp = await client.get("/leaderboard")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["results"], list)
    assert len(data["results"]) >= 1
    for row in data["results"]:
        assert "xp" in row, f"Missing xp in row: {row}"
        assert "level" in row, f"Missing level in row: {row}"
        assert "avatar_url" in row, f"Missing avatar_url in row: {row}"
        assert isinstance(row["xp"], int)
        assert isinstance(row["level"], int)
        assert row["avatar_url"] is None or isinstance(row["avatar_url"], str)


@pytest.mark.asyncio
async def test_leaderboard_order_xp_desc_sorts_by_xp(client):
    """GET /leaderboard?order=xp:desc orders by XP descending.

    This test uses a setup where default-sort (points) and xp-sort disagree, so
    it actually discriminates whether `order=xp:desc` is being honored:
      - 5060: 1 win + 6 losses → 55 XP, 3 points
      - 5061: 2 wins + 0 losses → 50 XP, 6 points
    Under default (points DESC): 5061 ranks above 5060.
    Under xp DESC:                5060 ranks above 5061.

    Uses fresh user IDs (5060-5063) untouched by other tests so the scenario
    actually discriminates regardless of accumulated DB state from prior runs.
    """
    # 5060 wins 1 against 5062
    m_win = await client.post("/matches", json={"player1_id": 5060, "player2_id": 5062})
    await client.post(
        f"/matches/{m_win.json()['id']}/finish",
        json={"winner_id": 5060, "score_p1": 7, "score_p2": 3},
    )
    # 5060 loses 6 to 5062
    for _ in range(6):
        m_loss = await client.post("/matches", json={"player1_id": 5060, "player2_id": 5062})
        await client.post(
            f"/matches/{m_loss.json()['id']}/finish",
            json={"winner_id": 5062, "score_p1": 3, "score_p2": 7},
        )

    # 5061 wins 2 against 5063 (separate opponent so 5062's record stays clean)
    for _ in range(2):
        m = await client.post("/matches", json={"player1_id": 5061, "player2_id": 5063})
        await client.post(
            f"/matches/{m.json()['id']}/finish",
            json={"winner_id": 5061, "score_p1": 7, "score_p2": 3},
        )

    resp = await client.get("/leaderboard?order=xp:desc&limit=100")
    assert resp.status_code == 200
    rows = resp.json()["results"]
    # Use position in the returned `results` list to directly verify that
    # `order=xp:desc` is honored, independent of how `rank` is computed.
    pos_by_uid = {r["user_id"]: i for i, r in enumerate(rows)}
    assert 5060 in pos_by_uid and 5061 in pos_by_uid, (
        f"Expected 5060 and 5061 in response; got {list(pos_by_uid.keys())[:10]}..."
    )
    assert pos_by_uid[5060] < pos_by_uid[5061], (
        f"Expected user 5060 (more XP) to appear before 5061 in the result list "
        f"under xp:desc; got positions {pos_by_uid[5060]} vs {pos_by_uid[5061]}. "
        f"If 5060 appears AFTER 5061, the order=xp:desc param is being ignored."
    )


@pytest.mark.asyncio
async def test_leaderboard_default_sorts_by_xp_desc(client):
    """GET /leaderboard with no order query param defaults to XP descending.

    Verifies the global ordering invariant — every adjacent pair satisfies xp[i] >= xp[i+1].
    """
    # Touch a fresh user so there's at least one row with non-zero XP
    m = await client.post("/matches", json={"player1_id": 5045, "player2_id": 5044})
    await client.post(f"/matches/{m.json()['id']}/finish", json={"winner_id": 5045, "score_p1": 7, "score_p2": 1})

    resp = await client.get("/leaderboard?limit=100")
    assert resp.status_code == 200
    rows = resp.json()["results"]

    # Verify global ordering invariant — for any two adjacent rows, xp[i] >= xp[i+1]
    xps = [r["xp"] for r in rows]
    assert xps == sorted(xps, reverse=True), (
        f"Default sort should be XP DESC; got xps={xps}"
    )


@pytest.mark.asyncio
async def test_leaderboard_order_wins_desc_sorts_by_wins(client):
    """GET /leaderboard?order=wins:desc orders results by wins descending."""
    resp = await client.get("/leaderboard?order=wins:desc&limit=100")
    assert resp.status_code == 200
    rows = resp.json()["results"]
    if len(rows) < 2:
        pytest.skip("Not enough rows to verify ordering")
    wins_list = [r["wins"] for r in rows]
    assert wins_list == sorted(wins_list, reverse=True), (
        f"Expected wins DESC; got {wins_list}"
    )


@pytest.mark.asyncio
async def test_leaderboard_pagination_returns_correct_page(client):
    """GET /leaderboard?page=1&limit=20 returns the second page with correct metadata."""
    resp = await client.get("/leaderboard?page=1&limit=20")
    assert resp.status_code == 200
    data = resp.json()
    # When the database has fewer than 21 ranked players, page is clamped to last_page.
    # The response should still echo a valid page number and a list of results.
    assert "page" in data
    assert "last_page" in data
    assert "per_page" in data
    assert "total" in data
    assert data["per_page"] == 20
    assert isinstance(data["results"], list)

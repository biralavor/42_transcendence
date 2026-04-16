import pytest
import pytest_asyncio
from datetime import datetime, timedelta, timezone
from jose import jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from main import app
from persistence import create_tournament, join_tournament, start_tournament
from service.ws import router as ws_router
from shared.config.settings import settings


@pytest_asyncio.fixture
async def seeded_tournament():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE TABLE tournament_matches, tournament_participants, "
                "tournaments, matches, users, credentials RESTART IDENTITY CASCADE"
            )
        )
        for uid in range(1, 6):
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

    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as db:
        tournament = await create_tournament(db, name="ws-cup", creator_id=1, max_participants=4)
        for uid in (2, 3, 4):
            await join_tournament(db, tournament.id, uid)
        _, matches = await start_tournament(db, tournament.id, user_id=1)
        active = next(m for m in matches if m.status == "in_progress")
        yield {
            "tournament_id": tournament.id,
            "tournament_match_id": active.id,
            "match_id": active.match_id,
            "player1_id": active.player1_id,
            "player2_id": active.player2_id,
        }
    await engine.dispose()


@pytest.fixture(autouse=True)
def clear_ws_state():
    ws_router._setup_sessions.clear()
    ws_router._match_ids.clear()
    ws_router._waiting_room_ready.clear()
    ws_router._waiting_room_players.clear()
    ws_router._tournament_ready.clear()
    ws_router._tournament_waiting_rooms.clear()
    yield
    ws_router._setup_sessions.clear()
    ws_router._match_ids.clear()
    ws_router._waiting_room_ready.clear()
    ws_router._waiting_room_players.clear()
    ws_router._tournament_ready.clear()
    ws_router._tournament_waiting_rooms.clear()


def _token_for_credential(credential_id: int) -> str:
    payload = {
        "credential_id": credential_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")


@pytest.mark.timeout(10)
@pytest.mark.asyncio
async def test_tournament_websocket_emits_match_start_when_both_players_ready(seeded_tournament):
    tournament_id = seeded_tournament["tournament_id"]
    tournament_match_id = seeded_tournament["tournament_match_id"]
    expected_match_id = seeded_tournament["match_id"]
    player1_id = seeded_tournament["player1_id"]
    player2_id = seeded_tournament["player2_id"]

    token1 = _token_for_credential(player1_id + 10000)
    token2 = _token_for_credential(player2_id + 10000)

    client = TestClient(app)

    with client.websocket_connect(f"/ws/tournament/{tournament_id}?token={token1}") as ws1, \
         client.websocket_connect(f"/ws/tournament/{tournament_id}?token={token2}") as ws2:
        msg1 = ws1.receive_json()
        msg2 = ws2.receive_json()
        assert msg1["type"] == "tournament_connected"
        assert msg2["type"] == "tournament_connected"

        ws1.send_json({"type": "ready", "match_id": tournament_match_id})
        ready_messages = [ws1.receive_json(), ws2.receive_json()]
        assert all(m["type"] == "match_player_ready" for m in ready_messages)

        ws2.send_json({"type": "ready", "match_id": tournament_match_id})
        messages = [ws1.receive_json(), ws1.receive_json(), ws2.receive_json(), ws2.receive_json()]
        match_start = next(m for m in messages if m["type"] == "match_start")
        assert match_start["tournament_id"] == tournament_id
        assert match_start["tournament_match_id"] == tournament_match_id
        assert match_start["match_id"] == expected_match_id
        assert match_start["player1_id"] == player1_id
        assert match_start["player2_id"] == player2_id
        assert "game_room_id" in match_start


@pytest.mark.timeout(10)
@pytest.mark.asyncio
async def test_tournament_websocket_rejects_non_participant():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE TABLE tournament_matches, tournament_participants, "
                "tournaments, matches, users, credentials RESTART IDENTITY CASCADE"
            )
        )
        for uid in (1, 99):
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

    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as db:
        tournament = await create_tournament(db, name="private", creator_id=1, max_participants=4)

    client = TestClient(app)
    token = _token_for_credential(99 + 10000)

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/ws/tournament/{tournament.id}?token={token}"):
            pass

    await engine.dispose()

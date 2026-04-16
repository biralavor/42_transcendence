from types import SimpleNamespace

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from main import app
from service.ws import router as ws_router


class _FakeExecuteResult:
    def __init__(self, row):
        self._row = row

    def fetchone(self):
        return self._row


class _FakeSession:
    def __init__(self, credential_map):
        self.credential_map = credential_map

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def execute(self, _stmt, params=None):
        cid = params["cid"]
        user_id = self.credential_map.get(cid)
        return _FakeExecuteResult((user_id,) if user_id is not None else None)


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


@pytest.fixture
def seeded_tournament():
    return {
        "tournament_id": 1,
        "tournament_match_id": 10,
        "match_id": 99,
        "player1_id": 1,
        "player2_id": 3,
    }


def _patch_auth_and_tournament(monkeypatch, seeded_tournament, include_non_participant=False):
    credential_map = {
        seeded_tournament["player1_id"] + 10000: seeded_tournament["player1_id"],
        seeded_tournament["player2_id"] + 10000: seeded_tournament["player2_id"],
    }

    if include_non_participant:
        credential_map[99 + 10000] = 99

    def fake_decode(token, *_args, **_kwargs):
        return {"credential_id": int(token)}

    async def fake_get_tournament_with_participants(_db, tournament_id):
        if tournament_id != seeded_tournament["tournament_id"]:
            return None

        participants = [
            SimpleNamespace(user_id=seeded_tournament["player1_id"]),
            SimpleNamespace(user_id=seeded_tournament["player2_id"]),
        ]
        matches = [
            SimpleNamespace(
                id=seeded_tournament["tournament_match_id"],
                status="in_progress",
                match_id=seeded_tournament["match_id"],
                player1_id=seeded_tournament["player1_id"],
                player2_id=seeded_tournament["player2_id"],
            )
        ]
        return SimpleNamespace(id=tournament_id), participants, matches

    monkeypatch.setattr(ws_router.jwt, "decode", fake_decode)
    monkeypatch.setattr(
        ws_router,
        "AsyncSessionLocal",
        lambda: _FakeSession(credential_map),
    )
    monkeypatch.setattr(
        ws_router,
        "get_tournament_with_participants",
        fake_get_tournament_with_participants,
    )


@pytest.mark.timeout(10)
def test_tournament_websocket_emits_match_start_when_both_players_ready(monkeypatch, seeded_tournament):
    _patch_auth_and_tournament(monkeypatch, seeded_tournament)

    tournament_id = seeded_tournament["tournament_id"]
    tournament_match_id = seeded_tournament["tournament_match_id"]
    expected_match_id = seeded_tournament["match_id"]
    player1_id = seeded_tournament["player1_id"]
    player2_id = seeded_tournament["player2_id"]

    token1 = str(player1_id + 10000)
    token2 = str(player2_id + 10000)

    client1 = TestClient(app)
    client2 = TestClient(app)

    with client1.websocket_connect(f"/ws/tournament/{tournament_id}?token={token1}") as ws1, \
         client2.websocket_connect(f"/ws/tournament/{tournament_id}?token={token2}") as ws2:

        msg1 = ws1.receive_json()
        msg2 = ws2.receive_json()

        assert msg1["type"] == "tournament_connected"
        assert msg2["type"] == "tournament_connected"

        ws1.send_json({"type": "ready", "match_id": tournament_match_id})
        ws2.send_json({"type": "ready", "match_id": tournament_match_id})

        # Current backend may emit one ready broadcast before match_start.
        messages = [ws1.receive_json(), ws1.receive_json(), ws1.receive_json()]
        match_start = next(m for m in messages if m["type"] == "match_start")

        assert match_start["tournament_id"] == tournament_id
        assert match_start["tournament_match_id"] == tournament_match_id
        assert match_start["match_id"] == expected_match_id
        assert match_start["player1_id"] == player1_id
        assert match_start["player2_id"] == player2_id
        assert "game_room_id" in match_start


@pytest.mark.timeout(10)
def test_tournament_websocket_rejects_non_participant(monkeypatch, seeded_tournament):
    _patch_auth_and_tournament(monkeypatch, seeded_tournament, include_non_participant=True)

    client = TestClient(app)
    non_participant_token = str(99 + 10000)

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            f"/ws/tournament/{seeded_tournament['tournament_id']}?token={non_participant_token}"
        ):
            pass

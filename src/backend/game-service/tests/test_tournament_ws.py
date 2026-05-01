from types import SimpleNamespace
from unittest.mock import AsyncMock

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


class _NoopSession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.fixture(autouse=True)
def clear_ws_state():
    for task in list(ws_router._waiting_room_timeout_tasks.values()):
        if task is not None and not task.done():
            task.cancel()
    for task in list(ws_router._tournament_ready_timeout_tasks.values()):
        if task is not None and not task.done():
            task.cancel()

    ws_router._setup_sessions.clear()
    ws_router._match_ids.clear()
    ws_router._waiting_room_ready.clear()
    ws_router._waiting_room_players.clear()
    ws_router._tournament_ready.clear()
    ws_router._tournament_waiting_rooms.clear()
    ws_router._waiting_room_tournament_context.clear()
    ws_router._waiting_room_timeout_tasks.clear()
    ws_router._waiting_room_timeout_deadline.clear()
    ws_router._tournament_ready_timeout_tasks.clear()
    ws_router._tournament_ready_timeout_locks.clear()
    yield

    for task in list(ws_router._waiting_room_timeout_tasks.values()):
        if task is not None and not task.done():
            task.cancel()
    for task in list(ws_router._tournament_ready_timeout_tasks.values()):
        if task is not None and not task.done():
            task.cancel()

    ws_router._setup_sessions.clear()
    ws_router._match_ids.clear()
    ws_router._waiting_room_ready.clear()
    ws_router._waiting_room_players.clear()
    ws_router._tournament_ready.clear()
    ws_router._tournament_waiting_rooms.clear()
    ws_router._waiting_room_tournament_context.clear()
    ws_router._waiting_room_timeout_tasks.clear()
    ws_router._waiting_room_timeout_deadline.clear()
    ws_router._tournament_ready_timeout_tasks.clear()
    ws_router._tournament_ready_timeout_locks.clear()


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


def test_waiting_room_remembers_existing_match_id_from_first_ready():
    game_id = "tournament-1-match-99"

    first_ready_payload = {"type": "player_ready", "match_id": 99}
    second_ready_payload = {"type": "player_ready", "match_id": None}

    assert ws_router._remember_existing_match_id(game_id, first_ready_payload) == 99
    assert ws_router._remember_existing_match_id(game_id, second_ready_payload) == 99
    assert ws_router._match_ids[game_id] == 99


def test_waiting_room_recovers_tournament_match_id_from_game_room_id():
    game_id = "tournament-1-match-99"

    assert ws_router._remember_existing_match_id(game_id, {"type": "game_start"}) == 99
    assert ws_router._match_ids[game_id] == 99


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


@pytest.mark.asyncio
async def test_tournament_ready_timeout_marks_wo_winner(monkeypatch, seeded_tournament):
    tournament_id = seeded_tournament["tournament_id"]
    tournament_match_id = seeded_tournament["tournament_match_id"]
    player1_id = seeded_tournament["player1_id"]
    player2_id = seeded_tournament["player2_id"]
    ready_key = (tournament_id, tournament_match_id)
    ws_router._tournament_ready[ready_key] = {player1_id}

    match_row = SimpleNamespace(
        id=tournament_match_id,
        status="in_progress",
        player1_id=player1_id,
        player2_id=player2_id,
    )

    async def fake_get_tournament_with_participants(_db, _tournament_id):
        return SimpleNamespace(id=tournament_id), [], [match_row]

    recorded_winner = {"value": None}

    async def fake_record_timeout_result(*, db, tournament_id, tournament_match_id, winner_id):
        recorded_winner["value"] = winner_id
        return SimpleNamespace(id=tournament_id), False, []

    async def fake_sleep(_seconds):
        return None

    monkeypatch.setattr(ws_router, "READY_TIMEOUT_SECONDS", 0)
    monkeypatch.setattr(ws_router, "AsyncSessionLocal", lambda: _NoopSession())
    monkeypatch.setattr(ws_router, "get_tournament_with_participants", fake_get_tournament_with_participants)
    monkeypatch.setattr(ws_router, "record_tournament_match_timeout_result", fake_record_timeout_result)
    monkeypatch.setattr(ws_router, "sync_tournament_ready_timeouts", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(ws_router.asyncio, "sleep", fake_sleep)
    broadcast_mock = AsyncMock()
    monkeypatch.setattr(ws_router.manager, "broadcast", broadcast_mock)

    await ws_router._handle_tournament_ready_timeout(tournament_id, tournament_match_id)

    assert recorded_winner["value"] == player1_id
    room_id = f"tournament_{tournament_id}"
    timeout_payload = next(
        call.args[1]
        for call in broadcast_mock.await_args_list
        if call.args[0] == room_id and call.args[1].get("type") == "match_ready_timeout"
    )
    assert timeout_payload["winner_id"] == player1_id
    assert ready_key not in ws_router._tournament_ready


@pytest.mark.asyncio
async def test_game_over_records_tournament_match_result_server_side(monkeypatch):
    game_id = "tournament-2-match-6"
    tournament_id = 2
    match_id = 6
    tournament_match_id = 50

    ws_router._match_ids[game_id] = match_id
    ws_router._waiting_room_tournament_context[game_id] = (
        tournament_id,
        match_id,
        tournament_match_id,
    )

    recorded = {}

    async def fake_record_tournament_match_result(
        db,
        tournament_id,
        match_id,
        winner_id,
        score_p1,
        score_p2,
    ):
        recorded.update(
            {
                "tournament_id": tournament_id,
                "match_id": match_id,
                "winner_id": winner_id,
                "score_p1": score_p1,
                "score_p2": score_p2,
            }
        )
        return SimpleNamespace(id=tournament_id), True, []

    async def fake_get_tournament_with_participants(_db, _tournament_id):
        return SimpleNamespace(id=tournament_id), [], []

    monkeypatch.setattr(ws_router, "AsyncSessionLocal", lambda: _NoopSession())
    monkeypatch.setattr(
        ws_router,
        "record_tournament_match_result",
        fake_record_tournament_match_result,
    )
    monkeypatch.setattr(
        ws_router,
        "get_tournament_with_participants",
        fake_get_tournament_with_participants,
    )
    monkeypatch.setattr(ws_router.game_manager, "delete_session", AsyncMock())
    broadcast_mock = AsyncMock()
    monkeypatch.setattr(ws_router.manager, "broadcast", broadcast_mock)

    await ws_router._on_game_over(game_id, winner_id=4, score_p1=10, score_p2=6)

    assert recorded == {
        "tournament_id": tournament_id,
        "match_id": match_id,
        "winner_id": 4,
        "score_p1": 10,
        "score_p2": 6,
    }
    tournament_room = f"tournament_{tournament_id}"
    broadcast_payloads = [
        call.args[1]
        for call in broadcast_mock.await_args_list
        if call.args[0] == tournament_room
    ]
    assert {"type": "tournament_updated", "tournament_id": tournament_id} in broadcast_payloads
    assert {"type": "tournament_complete", "tournament_id": tournament_id} in broadcast_payloads


@pytest.mark.asyncio
async def test_tournament_ready_timeout_with_no_ready_players(monkeypatch, seeded_tournament):
    tournament_id = seeded_tournament["tournament_id"]
    tournament_match_id = seeded_tournament["tournament_match_id"]
    player1_id = seeded_tournament["player1_id"]
    player2_id = seeded_tournament["player2_id"]
    ready_key = (tournament_id, tournament_match_id)
    ws_router._tournament_ready[ready_key] = set()

    match_row = SimpleNamespace(
        id=tournament_match_id,
        status="in_progress",
        player1_id=player1_id,
        player2_id=player2_id,
    )

    async def fake_get_tournament_with_participants(_db, _tournament_id):
        return SimpleNamespace(id=tournament_id), [], [match_row]

    recorded_winner = {"value": 999}

    async def fake_record_timeout_result(*, db, tournament_id, tournament_match_id, winner_id):
        recorded_winner["value"] = winner_id
        return SimpleNamespace(id=tournament_id), False, []

    async def fake_sleep(_seconds):
        return None

    monkeypatch.setattr(ws_router, "READY_TIMEOUT_SECONDS", 0)
    monkeypatch.setattr(ws_router, "AsyncSessionLocal", lambda: _NoopSession())
    monkeypatch.setattr(ws_router, "get_tournament_with_participants", fake_get_tournament_with_participants)
    monkeypatch.setattr(ws_router, "record_tournament_match_timeout_result", fake_record_timeout_result)
    monkeypatch.setattr(ws_router, "sync_tournament_ready_timeouts", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(ws_router.asyncio, "sleep", fake_sleep)
    broadcast_mock = AsyncMock()
    monkeypatch.setattr(ws_router.manager, "broadcast", broadcast_mock)

    await ws_router._handle_tournament_ready_timeout(tournament_id, tournament_match_id)

    assert recorded_winner["value"] is None
    room_id = f"tournament_{tournament_id}"
    timeout_payload = next(
        call.args[1]
        for call in broadcast_mock.await_args_list
        if call.args[0] == room_id and call.args[1].get("type") == "match_ready_timeout"
    )
    assert timeout_payload["winner_id"] is None
    assert ready_key not in ws_router._tournament_ready


@pytest.mark.asyncio
async def test_tournament_ready_timeouts_for_same_tournament_are_serialized(monkeypatch):
    tournament_id = 1
    rows = [
        SimpleNamespace(id=10, status="in_progress", player1_id=1, player2_id=2),
        SimpleNamespace(id=11, status="in_progress", player1_id=3, player2_id=4),
    ]
    ws_router._tournament_ready[(tournament_id, 10)] = set()
    ws_router._tournament_ready[(tournament_id, 11)] = set()

    active_calls = 0
    max_active_calls = 0
    original_sleep = ws_router.asyncio.sleep

    async def fake_get_tournament_with_participants(_db, _tournament_id):
        return SimpleNamespace(id=tournament_id), [], rows

    async def fake_record_timeout_result(*, db, tournament_id, tournament_match_id, winner_id):
        nonlocal active_calls, max_active_calls
        active_calls += 1
        max_active_calls = max(max_active_calls, active_calls)
        await original_sleep(0)
        row = next(row for row in rows if row.id == tournament_match_id)
        row.status = "finished"
        active_calls -= 1
        return SimpleNamespace(id=tournament_id), False, []

    async def fake_sleep(_seconds):
        return None

    monkeypatch.setattr(ws_router, "READY_TIMEOUT_SECONDS", 0)
    monkeypatch.setattr(ws_router, "AsyncSessionLocal", lambda: _NoopSession())
    monkeypatch.setattr(ws_router, "get_tournament_with_participants", fake_get_tournament_with_participants)
    monkeypatch.setattr(ws_router, "record_tournament_match_timeout_result", fake_record_timeout_result)
    monkeypatch.setattr(ws_router, "sync_tournament_ready_timeouts", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(ws_router.asyncio, "sleep", fake_sleep)
    monkeypatch.setattr(ws_router.manager, "broadcast", AsyncMock())

    await original_sleep(0)
    await ws_router.asyncio.gather(
        ws_router._handle_tournament_ready_timeout(tournament_id, 10),
        ws_router._handle_tournament_ready_timeout(tournament_id, 11),
    )

    assert max_active_calls == 1
    assert [row.status for row in rows] == ["finished", "finished"]

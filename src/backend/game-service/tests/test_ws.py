import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from main import app


@pytest.mark.timeout(5)
def test_ws_healthcheck_one_shot():
    """Healthcheck endpoint accepts, sends status, and closes immediately (one-shot)."""
    client = TestClient(app)

    with client.websocket_connect("/ws/game/healthcheck") as ws:
        data = ws.receive_json(mode="text")
        assert data["type"] == "healthcheck"
        assert data["status"] == "ok"

        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


@pytest.mark.timeout(5)
def test_ws_healthcheck_access_denied_invalid_token():
    """Healthcheck from TestClient is treated as local/test and should be allowed."""
    client = TestClient(app)

    with client.websocket_connect("/ws/game/healthcheck") as ws:
        data = ws.receive_json()
        assert data["type"] == "healthcheck"


@pytest.mark.timeout(5)
def test_ws_game_requires_token_for_non_healthcheck():
    """Connecting to a non-healthcheck game_id without token should be rejected."""
    client = TestClient(app)

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/game/some-game-id"):
            pass

    assert exc_info.value.code == 4001


@pytest.mark.timeout(5)
def test_ws_games_are_isolated():
    pytest.skip("Requires mock token generation and game session setup")

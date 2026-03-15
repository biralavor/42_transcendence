import threading
import queue
from starlette.testclient import TestClient
from main import app


def test_ws_game_connect_and_echo():
    """A connected client receives its own broadcast message."""
    client = TestClient(app)
    with client.websocket_connect("/ws/game/game1") as ws:
        ws.send_json({"type": "move", "player": 1, "velY": 5})
        data = ws.receive_json()
        assert data["type"] == "move"
        assert data["player"] == 1


def test_ws_game_broadcast_to_players():
    """Both players in the same game receive the move."""
    client = TestClient(app)
    with client.websocket_connect("/ws/game/game2") as ws1, \
         client.websocket_connect("/ws/game/game2") as ws2:
        ws1.send_json({"type": "move", "player": 1, "velY": -3})
        d1 = ws1.receive_json()
        d2 = ws2.receive_json()
        assert d1["type"] == "move"
        assert d2["type"] == "move"


def test_ws_games_are_isolated():
    """A move in game3 does not reach game4."""
    client = TestClient(app)
    with client.websocket_connect("/ws/game/game3") as ws3, \
         client.websocket_connect("/ws/game/game4") as ws4:
        ws3.send_json({"type": "move", "player": 1})
        d3 = ws3.receive_json()
        assert d3["type"] == "move"
        result = queue.Queue()
        def try_receive():
            try:
                result.put(ws4.receive_json())
            except Exception:
                result.put(None)
        t = threading.Thread(target=try_receive, daemon=True)
        t.start()
        t.join(timeout=0.5)
        assert result.empty() or result.get() is None

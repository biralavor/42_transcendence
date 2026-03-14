import sys
sys.path.insert(0, "src/backend/chat-service")
sys.path.insert(0, "src/backend")

import threading
import queue
from starlette.testclient import TestClient
from main import app


def test_ws_connect_and_echo():
    """A connected client receives its own broadcast message."""
    client = TestClient(app)
    with client.websocket_connect("/ws/chat/room1") as ws:
        ws.send_json({"content": "hello", "sender_id": "user1"})
        data = ws.receive_json()
        assert data["content"] == "hello"
        assert data["sender_id"] == "user1"


def test_ws_broadcast_to_multiple():
    """Both clients in the same room receive the message."""
    client = TestClient(app)
    with client.websocket_connect("/ws/chat/room2") as ws1, \
         client.websocket_connect("/ws/chat/room2") as ws2:
        ws1.send_json({"content": "broadcast"})
        d1 = ws1.receive_json()
        d2 = ws2.receive_json()
        assert d1["content"] == "broadcast"
        assert d2["content"] == "broadcast"


def test_ws_rooms_are_isolated():
    """A message in room3 does not leak to room4."""
    client = TestClient(app)
    with client.websocket_connect("/ws/chat/room3") as ws3, \
         client.websocket_connect("/ws/chat/room4") as ws4:
        ws3.send_json({"content": "private"})
        d3 = ws3.receive_json()
        assert d3["content"] == "private"
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

import os
import uuid
import asyncio
import threading
import queue
from starlette.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker as async_sessionmaker

from main import app
from persistence import get_or_create_room, save_message


def _get_db_url():
    user = os.environ.get("POSTGRES_USER") or os.environ["DB_USER"]
    password = os.environ.get("POSTGRES_PASSWORD") or os.environ["DB_PASSWORD"]
    host = os.environ["DB_HOST"]
    db = os.environ.get("POSTGRES_DB") or os.environ["DB_NAME"]
    return f"postgresql+asyncpg://{user}:{password}@{host}/{db}"


def test_ws_connect_and_echo():
    """A connected client receives its own broadcast message."""
    client = TestClient(app)
    with client.websocket_connect("/ws/chat/room-echo") as ws:
        ws.send_json({"content": "hello", "sender": "user1"})
        data = ws.receive_json()
        assert data["content"] == "hello"
        assert data["sender"] == "user1"


def test_ws_broadcast_to_multiple():
    """Both clients in the same room receive the message."""
    client = TestClient(app)
    with client.websocket_connect("/ws/chat/room-bcast") as ws1, \
         client.websocket_connect("/ws/chat/room-bcast") as ws2:
        ws1.send_json({"content": "broadcast", "sender": "alice"})
        d1 = ws1.receive_json()
        d2 = ws2.receive_json()
        assert d1["content"] == "broadcast"
        assert d2["content"] == "broadcast"


def test_ws_rooms_are_isolated():
    """A message in room-a does not leak to room-b."""
    client = TestClient(app)
    with client.websocket_connect("/ws/chat/room-iso-a") as ws_a, \
         client.websocket_connect("/ws/chat/room-iso-b") as ws_b:
        ws_a.send_json({"content": "private", "sender": "x"})
        d_a = ws_a.receive_json()
        assert d_a["content"] == "private"
        result = queue.Queue()
        def try_receive():
            try:
                result.put(ws_b.receive_json())
            except Exception:
                result.put(None)
        t = threading.Thread(target=try_receive, daemon=True)
        t.start()
        t.join(timeout=0.5)
        assert result.empty() or result.get() is None


def test_ws_message_is_persisted():
    """A message sent over WS is saved to the DB."""
    from service.models.message import Message
    from service.models.chat_room import ChatRoom
    from sqlalchemy import select

    client = TestClient(app)
    with client.websocket_connect("/ws/chat/room-persist") as ws:
        ws.send_json({"content": "saved?", "sender": "tester"})
        ws.receive_json()  # consume broadcast

    async def check():
        engine = create_async_engine(_get_db_url())
        Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with Session() as db:
            room_result = await db.execute(
                select(ChatRoom).where(ChatRoom.room_name == "room-persist")
            )
            room = room_result.scalar_one_or_none()
            assert room is not None
            msg_result = await db.execute(
                select(Message).where(
                    Message.room_id == room.id,
                    Message.content == "saved?",
                    Message.sender_name == "tester",
                )
            )
            msg = msg_result.scalar_one_or_none()
            assert msg is not None
        await engine.dispose()

    asyncio.run(check())


def test_ws_history_delivered_on_connect():
    """Pre-inserted messages are delivered to a newly connected client."""
    # Use a unique slug per run so repeated test runs don't accumulate history rows.
    room_slug = f"room-history-{uuid.uuid4().hex[:8]}"

    async def seed():
        engine = create_async_engine(_get_db_url())
        Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with Session() as db:
            room = await get_or_create_room(db, room_slug)
            await save_message(db, room.id, "Alice", "first message")
            await save_message(db, room.id, "Bob", "second message")
        await engine.dispose()

    asyncio.run(seed())

    client = TestClient(app)
    with client.websocket_connect(f"/ws/chat/{room_slug}") as ws:
        msg1 = ws.receive_json()
        msg2 = ws.receive_json()
        assert msg1["content"] == "first message"
        assert msg1["sender"] == "Alice"
        assert msg2["content"] == "second message"
        assert msg2["sender"] == "Bob"

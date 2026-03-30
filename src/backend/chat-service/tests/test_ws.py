import os
import uuid
import asyncio
import threading
import queue
from unittest.mock import patch, AsyncMock
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


# ---------------------------------------------------------------------------
# Helpers for block-filter tests (no real DB needed)
# ---------------------------------------------------------------------------

def _make_fake_room(room_id=1):
    """Return a minimal fake room object for WS router mocking."""
    class FakeRoom:
        id = room_id
    return FakeRoom()


def _ws_db_patches(is_blocked_fn=None, sender_uid=None):
    """Return a list of patch context managers that mock all DB calls in ws/router.py.

    sender_uid: when set, patches _uid_from_token to return this value so DM
                rooms accept the connection without a real JWT.
    """
    import contextlib
    from unittest.mock import MagicMock

    fake_room = _make_fake_room()

    async def mock_get_or_create_room(db, slug):
        return fake_room

    async def mock_get_room_history(db, room_id):
        return []

    async def mock_save_message(db, room_id, sender, content):
        pass

    @contextlib.asynccontextmanager
    async def mock_session():
        yield MagicMock()

    patches = [
        patch("service.ws.router.get_or_create_room", side_effect=mock_get_or_create_room),
        patch("service.ws.router.get_room_history", side_effect=mock_get_room_history),
        patch("service.ws.router.save_message", side_effect=mock_save_message),
        patch("service.ws.router.AsyncSessionLocal", new=mock_session),
    ]
    if is_blocked_fn is not None:
        patches.append(patch("service.ws.router.is_blocked", side_effect=is_blocked_fn))
    if sender_uid is not None:
        patches.append(patch("service.ws.router._uid_from_token", return_value=sender_uid))
    return patches


# ---------------------------------------------------------------------------
# Typing-event tests
# ---------------------------------------------------------------------------

def test_typing_event_broadcast():
    """A typing event is broadcast to other clients; type and sender are preserved."""
    import contextlib
    with contextlib.ExitStack() as stack:
        for p in _ws_db_patches():
            stack.enter_context(p)
        client = TestClient(app)
        with client.websocket_connect("/ws/chat/room-typing") as ws1, \
             client.websocket_connect("/ws/chat/room-typing") as ws2:
            ws1.send_json({"type": "typing", "sender": "alice"})
            data = ws2.receive_json()
            assert data == {"type": "typing", "sender": "alice"}


def test_typing_event_not_persisted():
    """Typing events are broadcast but save_message is never called for them."""
    import contextlib
    save_calls = []

    async def tracking_save(db, room_id, sender, content):
        save_calls.append(content)

    with contextlib.ExitStack() as stack:
        for p in _ws_db_patches():
            stack.enter_context(p)
        # Override the no-op save_message with a tracking version (applied last → wins)
        stack.enter_context(patch("service.ws.router.save_message", side_effect=tracking_save))
        client = TestClient(app)
        with client.websocket_connect("/ws/chat/room-typing-persist") as ws:
            ws.send_json({"type": "typing", "sender": "alice"})
            # Send a real message after — when its broadcast arrives we know both were processed
            ws.send_json({"content": "hello", "sender": "alice"})
            ws.receive_json()  # consume the chat broadcast

    assert save_calls == ["hello"]


# ---------------------------------------------------------------------------
# Block-filter tests
# ---------------------------------------------------------------------------

def test_dm_without_token_rejected():
    """Connecting to a DM room without a token is rejected with close code 4001."""
    import contextlib
    import pytest
    from starlette.websockets import WebSocketDisconnect

    with contextlib.ExitStack() as stack:
        for p in _ws_db_patches():
            stack.enter_context(p)
        client = TestClient(app)
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect("/ws/chat/DM-1-2"):
                pass
        assert exc_info.value.code == 4001


def test_blocked_sender_message_not_delivered():
    """If is_blocked returns True for (recipient, sender), message is dropped."""
    import contextlib
    room = "DM-10-20"

    async def mock_is_blocked(db, blocker_id, blocked_id):
        return blocker_id == 10 and blocked_id == 20

    with contextlib.ExitStack() as stack:
        for p in _ws_db_patches(is_blocked_fn=mock_is_blocked, sender_uid=20):
            stack.enter_context(p)
        client = TestClient(app)
        with client.websocket_connect(f"/ws/chat/{room}") as ws_blocker, \
             client.websocket_connect(f"/ws/chat/{room}") as ws_sender:
            ws_sender.send_json({"sender": "bob", "content": "blocked msg"})

            result = queue.Queue()
            def try_recv():
                try:
                    result.put(ws_blocker.receive_json())
                except Exception:
                    result.put(None)
            t = threading.Thread(target=try_recv, daemon=True)
            t.start()
            t.join(timeout=0.5)
            received = result.get() if not result.empty() else None
            assert received is None or received.get("content") != "blocked msg"


def test_unblocked_sender_message_delivered():
    """Without a block, messages are delivered normally in DM rooms."""
    import contextlib

    async def mock_is_blocked(db, blocker_id, blocked_id):
        return False

    with contextlib.ExitStack() as stack:
        for p in _ws_db_patches(is_blocked_fn=mock_is_blocked, sender_uid=30):
            stack.enter_context(p)
        client = TestClient(app)
        room = "DM-30-40"
        with client.websocket_connect(f"/ws/chat/{room}") as ws1, \
             client.websocket_connect(f"/ws/chat/{room}") as ws2:
            ws1.send_json({"sender": "alice", "content": "hello"})
            d = ws2.receive_json()
            assert d["content"] == "hello"


def test_non_dm_room_unaffected_by_block_logic():
    """Non-DM rooms (no DM-{a}-{b} slug) are not filtered even with user_id."""
    import contextlib

    with contextlib.ExitStack() as stack:
        for p in _ws_db_patches():
            stack.enter_context(p)
        client = TestClient(app)
        room = "general-chat-nomock"
        with client.websocket_connect(f"/ws/chat/{room}") as ws1, \
             client.websocket_connect(f"/ws/chat/{room}") as ws2:
            ws1.send_json({"sender": "alice", "content": "hi all", "user_id": 99})
            d = ws2.receive_json()
            assert d["content"] == "hi all"

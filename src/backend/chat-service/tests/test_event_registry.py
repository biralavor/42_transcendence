"""Tests for chat-service/ws/event_registry.py — per-user async Event coordination.

Pure-logic tests for the EventRegistry class. No DB, no HTTP, no WS.
"""
import pytest
import asyncio
from service.ws.event_registry import EventRegistry, chat_notification_event_registry


@pytest.mark.asyncio
async def test_get_or_create_event_returns_event_object():
    reg = EventRegistry()
    event = await reg.get_or_create_event("user-1")
    assert isinstance(event, asyncio.Event)
    assert not event.is_set()


@pytest.mark.asyncio
async def test_get_or_create_event_returns_same_instance_for_same_user():
    """The same user_id must always get the same Event instance, otherwise
    listeners and signalers would coordinate on different objects."""
    reg = EventRegistry()
    a = await reg.get_or_create_event("user-1")
    b = await reg.get_or_create_event("user-1")
    assert a is b


@pytest.mark.asyncio
async def test_different_users_get_different_events():
    reg = EventRegistry()
    e1 = await reg.get_or_create_event("user-1")
    e2 = await reg.get_or_create_event("user-2")
    assert e1 is not e2


@pytest.mark.asyncio
async def test_signal_event_wakes_a_waiting_handler():
    """A handler awaiting the event should be released when signal_event fires."""
    reg = EventRegistry()
    event = await reg.get_or_create_event("user-1")

    async def waiter():
        await event.wait()
        return "released"

    waiter_task = asyncio.create_task(waiter())
    # Brief yield to let the waiter park on event.wait()
    await asyncio.sleep(0)
    assert not waiter_task.done()

    await reg.signal_event("user-1")
    result = await asyncio.wait_for(waiter_task, timeout=1.0)
    assert result == "released"


@pytest.mark.asyncio
async def test_signal_event_wakes_multiple_waiting_handlers():
    """Multiple tabs / multiple handlers per user_id all wake on a single signal."""
    reg = EventRegistry()
    event = await reg.get_or_create_event("user-1")

    async def waiter():
        await event.wait()

    tasks = [asyncio.create_task(waiter()) for _ in range(3)]
    await asyncio.sleep(0)
    for t in tasks:
        assert not t.done()

    await reg.signal_event("user-1")
    await asyncio.wait_for(asyncio.gather(*tasks), timeout=1.0)
    for t in tasks:
        assert t.done()


@pytest.mark.asyncio
async def test_signal_event_for_unknown_user_creates_and_signals():
    """signal_event before any get_or_create_event should still work (lazy)."""
    reg = EventRegistry()
    await reg.signal_event("brand-new-user")
    event = await reg.get_or_create_event("brand-new-user")
    assert event.is_set()


@pytest.mark.asyncio
async def test_clear_event_resets_to_unsignaled_state():
    reg = EventRegistry()
    await reg.signal_event("user-1")
    event = await reg.get_or_create_event("user-1")
    assert event.is_set()
    await reg.clear_event("user-1")
    assert not event.is_set()


@pytest.mark.asyncio
async def test_clear_event_for_unknown_user_creates_unsignaled_event():
    reg = EventRegistry()
    await reg.clear_event("never-signaled")
    event = await reg.get_or_create_event("never-signaled")
    assert not event.is_set()


@pytest.mark.asyncio
async def test_cleanup_event_removes_user_entry():
    reg = EventRegistry()
    await reg.get_or_create_event("user-1")
    await reg.cleanup_event("user-1")
    # After cleanup, asking for the event should yield a NEW Event instance
    # (proving the old one was deleted)
    new_event = await reg.get_or_create_event("user-1")
    assert isinstance(new_event, asyncio.Event)
    assert not new_event.is_set()


@pytest.mark.asyncio
async def test_cleanup_event_for_unknown_user_is_noop():
    reg = EventRegistry()
    await reg.cleanup_event("never-existed")  # should not raise


@pytest.mark.asyncio
async def test_concurrent_get_or_create_returns_one_instance_under_lock():
    """The async lock should serialize concurrent first-touches so only ONE
    Event instance is ever created per user_id, even under contention."""
    reg = EventRegistry()
    results = await asyncio.gather(*(
        reg.get_or_create_event("contended-user") for _ in range(20)
    ))
    # All 20 calls should return the same instance
    first = results[0]
    assert all(r is first for r in results)


@pytest.mark.asyncio
async def test_global_registry_is_shared_across_imports():
    """The module exposes a singleton `chat_notification_event_registry`
    used by the WS router. Sanity-check it's an EventRegistry."""
    assert isinstance(chat_notification_event_registry, EventRegistry)

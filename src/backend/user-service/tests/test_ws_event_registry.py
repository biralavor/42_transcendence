"""Tests for user-service/ws/event_registry.py — per-user async Event coordination.

The user-service has the same EventRegistry class as chat-service but exposes
TWO global instances: `notification_event_registry` and `presence_event_registry`.
These tests verify the class behavior plus the per-instance isolation.
"""
import pytest
import asyncio
from service.ws.event_registry import (
    EventRegistry,
    notification_event_registry,
    presence_event_registry,
)


@pytest.mark.asyncio
async def test_get_or_create_event_returns_event_object():
    reg = EventRegistry()
    event = await reg.get_or_create_event("user-1")
    assert isinstance(event, asyncio.Event)
    assert not event.is_set()


@pytest.mark.asyncio
async def test_same_user_id_returns_same_event_instance():
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
async def test_signal_wakes_a_waiting_handler():
    reg = EventRegistry()
    event = await reg.get_or_create_event("user-1")

    async def waiter():
        await event.wait()
        return "released"

    task = asyncio.create_task(waiter())
    await asyncio.sleep(0)
    assert not task.done()

    await reg.signal_event("user-1")
    assert (await asyncio.wait_for(task, timeout=1.0)) == "released"


@pytest.mark.asyncio
async def test_signal_wakes_multiple_handlers_for_same_user():
    """Multi-tab use case: 3 active WS connections for one user_id all wake on a single signal."""
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
async def test_signal_for_unknown_user_creates_lazily():
    reg = EventRegistry()
    await reg.signal_event("brand-new")
    event = await reg.get_or_create_event("brand-new")
    assert event.is_set()


@pytest.mark.asyncio
async def test_clear_event_resets_to_unsignaled():
    reg = EventRegistry()
    await reg.signal_event("user-1")
    event = await reg.get_or_create_event("user-1")
    assert event.is_set()
    await reg.clear_event("user-1")
    assert not event.is_set()


@pytest.mark.asyncio
async def test_cleanup_removes_user_entry():
    reg = EventRegistry()
    e_before = await reg.get_or_create_event("user-1")
    await reg.cleanup_event("user-1")
    e_after = await reg.get_or_create_event("user-1")
    # New instance because the old one was deleted
    assert e_after is not e_before
    assert not e_after.is_set()


@pytest.mark.asyncio
async def test_concurrent_first_touches_serialize_under_lock():
    reg = EventRegistry()
    results = await asyncio.gather(*(
        reg.get_or_create_event("contended") for _ in range(20)
    ))
    first = results[0]
    assert all(r is first for r in results)


# ─── User-service-specific: two separate registries ─────────────────────────

@pytest.mark.asyncio
async def test_notification_and_presence_registries_are_isolated():
    """Same user_id should get DIFFERENT Event instances from each registry —
    otherwise a notification signal would also wake presence handlers."""
    notif_event = await notification_event_registry.get_or_create_event("user-iso-1")
    presence_event = await presence_event_registry.get_or_create_event("user-iso-1")
    assert notif_event is not presence_event

    # Signal one, the other stays unsignaled
    await notification_event_registry.signal_event("user-iso-1")
    assert notif_event.is_set()
    assert not presence_event.is_set()

    # Cleanup
    await notification_event_registry.cleanup_event("user-iso-1")
    await presence_event_registry.cleanup_event("user-iso-1")


@pytest.mark.asyncio
async def test_global_singletons_are_correct_type():
    assert isinstance(notification_event_registry, EventRegistry)
    assert isinstance(presence_event_registry, EventRegistry)
    assert notification_event_registry is not presence_event_registry

# src/backend/user-service/ws/event_registry.py
"""EventRegistry for event-driven WebSocket notification delivery.

Bridges REST endpoint notification creation and WebSocket handler wakeup.
Provides per-user events that multiple handlers can wait on.
When broadcast() sends data, it signals the event to wake all listening handlers.

Architecture:
  1. Handler connects → registers with EventRegistry → waits on asyncio.Event()
  2. REST endpoint → creates notification in DB → calls broadcast()
  3. broadcast() → sends JSON to connected clients → signals event via registry
  4. Event fires → handlers wake immediately → process → clear event → loop
  5. Client disconnects → handler caught by CancelledError → cleanup → exit
"""

import asyncio
import logging
from typing import Dict

logger = logging.getLogger(__name__)


class EventRegistry:
    """Central registry of per-user notification/presence events.

    Enables immediate handler wakeup when data is ready (vs polling).
    Thread-safe using asyncio.Lock for dict mutations.
    Lazy creation: events only created on first handler for that user.
    Cleanup on disconnect: events removed to prevent memory leaks.
    """

    def __init__(self):
        self._events: Dict[str, asyncio.Event] = {}
        self._lock = asyncio.Lock()

    async def get_or_create_event(self, user_id: str) -> asyncio.Event:
        """Get existing event or create new one for user_id.

        Args:
            user_id: User ID as string key

        Returns:
            asyncio.Event for this user_id (creates if doesn't exist)
        """
        async with self._lock:
            if user_id not in self._events:
                self._events[user_id] = asyncio.Event()
                logger.debug(f"Created event for user {user_id}")
            return self._events[user_id]

    async def signal_event(self, user_id: str) -> None:
        """Signal that data is ready for user_id.

        Called by broadcast() after sending JSON to connected clients.
        Wakes ALL handlers waiting on this user's event.

        Args:
            user_id: User ID as string key
        """
        event = await self.get_or_create_event(user_id)
        event.set()
        logger.debug(f"Signaled event for user {user_id}")

    async def clear_event(self, user_id: str) -> None:
        """Clear event for next notification cycle.

        Called by handler after processing broadcasted data.
        Resets event to unsignaled state so handler can wait again.

        Args:
            user_id: User ID as string key
        """
        event = await self.get_or_create_event(user_id)
        event.clear()
        logger.debug(f"Cleared event for user {user_id}")

    async def cleanup_event(self, user_id: str) -> None:
        """Remove event when no more handlers are listening.

        Called during handler disconnect to avoid memory leak.
        Prevents stale events from accumulating.

        Args:
            user_id: User ID as string key
        """
        async with self._lock:
            if user_id in self._events:
                del self._events[user_id]
                logger.debug(f"Cleaned up event for user {user_id}")


# Global instances
# Each service (or handler type) should have its own registry to avoid conflicts
notification_event_registry = EventRegistry()
presence_event_registry = EventRegistry()

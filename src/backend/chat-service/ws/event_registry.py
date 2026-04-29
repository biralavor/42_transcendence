"""Event registry for WebSocket notification handlers.

Bridges chat message persistence and WebSocket real-time delivery.
Each user has one event that all their notification handlers wait on.
When a DM or room notification is broadcast, event.set() wakes all listeners.
"""

import asyncio
from typing import Dict


class EventRegistry:
    """Central registry of per-user chat notification events.
    
    Bridges rest endpoint creation and WebSocket handler wakeup.
    Each user has one event that multiple handlers can wait on.
    When notification is broadcast, event.set() wakes all listeners.
    """

    def __init__(self):
        self._events: Dict[str, asyncio.Event] = {}
        self._lock = asyncio.Lock()

    async def get_or_create_event(self, user_id: str) -> asyncio.Event:
        """Get existing event or create new one for user_id.
        
        Args:
            user_id: User ID as string (typically str(uid))
            
        Returns:
            asyncio.Event for this user
        """
        async with self._lock:
            if user_id not in self._events:
                self._events[user_id] = asyncio.Event()
            return self._events[user_id]

    async def signal_event(self, user_id: str) -> None:
        """Signal that data is ready for user_id.
        
        Called by broadcast() after sending JSON.
        Wakes all handlers waiting on this user's event.
        
        Args:
            user_id: User ID as string
        """
        event = await self.get_or_create_event(user_id)
        event.set()

    async def clear_event(self, user_id: str) -> None:
        """Clear event for next notification cycle.
        
        Called by handler after processing broadcasted data.
        Resets event to unsignaled state.
        
        Args:
            user_id: User ID as string
        """
        event = await self.get_or_create_event(user_id)
        event.clear()

    async def cleanup_event(self, user_id: str) -> None:
        """Remove event when no more handlers are listening.
        
        Called during handler disconnect to avoid memory leak.
        
        Args:
            user_id: User ID as string
        """
        async with self._lock:
            if user_id in self._events:
                del self._events[user_id]


# Global instance for chat service notifications
chat_notification_event_registry = EventRegistry()

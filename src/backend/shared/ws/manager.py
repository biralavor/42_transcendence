from __future__ import annotations
import logging
from typing import TYPE_CHECKING, Dict, Set

if TYPE_CHECKING:
    from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections grouped by room/game id."""

    def __init__(self) -> None:
        self._rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: "WebSocket") -> None:
        await websocket.accept()
        self._rooms.setdefault(room_id, set()).add(websocket)

    def disconnect(self, room_id: str, websocket: "WebSocket") -> None:
        room = self._rooms.get(room_id, set())
        room.discard(websocket)
        if not room:
            self._rooms.pop(room_id, None)

    async def broadcast(self, room_id: str, message: dict) -> None:
        for ws in list(self._rooms.get(room_id, set())):
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to client in room {room_id}: {e}")
                self.disconnect(room_id, ws)
        
        # Signal handlers that data is ready (event-driven delivery)
        # Try both user-service and chat-service registries (safe for any service)
        try:
            # Try user-service registry first (most common)
            try:
                from service.ws.event_registry import notification_event_registry
                await notification_event_registry.signal_event(room_id)
            except (ImportError, AttributeError):
                # Fall back to chat-service registry if available
                try:
                    from service.ws.event_registry import chat_notification_event_registry
                    await chat_notification_event_registry.signal_event(room_id)
                except (ImportError, AttributeError):
                    # No registry available, skip signaling (graceful fallback)
                    pass
        except Exception as e:
            # Non-blocking: signaling is best-effort, don't fail broadcast
            logger.debug(f"Failed to signal notification event for room {room_id}: {e}")
        
        # Signal handlers that data is ready (event-driven delivery)
        # Handlers waiting on event.wait() are now woken immediately
        # Safe for test environments: swallows all exceptions
        try:
            await notification_event_registry.signal_event(room_id)
        except ImportError:
            # In test environment, service module may not be importable
            pass
        except Exception as e:
            # Log but don't fail: signaling is best-effort, not required for message delivery
            logger.debug(f"Failed to signal notification event for room {room_id}: {e}")

    def active_connections(self, room_id: str) -> int:
        return len(self._rooms.get(room_id, set()))

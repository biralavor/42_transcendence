from __future__ import annotations
import logging
from typing import TYPE_CHECKING, Dict, Set, Optional, Callable, Awaitable

if TYPE_CHECKING:
    from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections grouped by room/game id.
    
    Optionally signals an event registry when broadcasts occur.
    Designed for dependency injection: each service provides its own signal callback.
    """

    def __init__(self, signal_callback: Optional[Callable[[str], Awaitable[None]]] = None) -> None:
        self._rooms: Dict[str, Set[WebSocket]] = {}
        self._signal_callback = signal_callback

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

        # Signal event registry if callback provided (event-driven delivery)
        if self._signal_callback:
            try:
                await self._signal_callback(room_id)
            except Exception as e:
                # Non-blocking: signaling is best-effort, don't fail broadcast
                logger.debug(f"Failed to signal event for room {room_id}: {e}")

    def active_connections(self, room_id: str) -> int:
        return len(self._rooms.get(room_id, set()))

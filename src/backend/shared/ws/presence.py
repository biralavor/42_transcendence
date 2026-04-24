from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Awaitable, Callable, Dict, Optional, Set

if TYPE_CHECKING:
    from fastapi import WebSocket

logger = logging.getLogger(__name__)


SignalCallback = Callable[[str], Awaitable[None]]


class PresenceManager:
    """Tracks active WebSocket connections per user_id for presence broadcast."""

    def __init__(self, signal_callback: Optional[SignalCallback] = None) -> None:
        self._users: Dict[int, Set[WebSocket]] = {}
        self._signal_callback = signal_callback

    def set_signal_callback(self, signal_callback: Optional[SignalCallback]) -> None:
        """Inject a service-owned callback used to wake presence listeners."""
        self._signal_callback = signal_callback

    async def connect(self, user_id: int, ws: "WebSocket") -> None:
        await ws.accept()
        self._users.setdefault(user_id, set()).add(ws)

    def disconnect(self, user_id: int, ws: "WebSocket") -> None:
        sockets = self._users.get(user_id, set())
        sockets.discard(ws)
        if not sockets:
            self._users.pop(user_id, None)

    def is_online(self, user_id: int) -> bool:
        return bool(self._users.get(user_id))

    async def broadcast_to(self, user_id: int, message: dict) -> None:
        for ws in list(self._users.get(user_id, set())):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(user_id, ws)

        if self._signal_callback is not None:
            try:
                await self._signal_callback(str(user_id))
            except Exception:
                logger.debug("Presence signal callback failed for user %s", user_id, exc_info=True)


presence_manager = PresenceManager()

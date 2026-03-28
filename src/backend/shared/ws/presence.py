from __future__ import annotations

from typing import TYPE_CHECKING, Dict, Set

if TYPE_CHECKING:
    from fastapi import WebSocket


class PresenceManager:
    """Tracks active WebSocket connections per user_id for presence broadcast."""

    def __init__(self) -> None:
        self._users: Dict[int, Set[WebSocket]] = {}

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


presence_manager = PresenceManager()

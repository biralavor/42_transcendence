from __future__ import annotations

from typing import TYPE_CHECKING, Dict, Set

if TYPE_CHECKING:
    from fastapi import WebSocket


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
            except Exception:
                pass

    def active_connections(self, room_id: str) -> int:
        return len(self._rooms.get(room_id, set()))

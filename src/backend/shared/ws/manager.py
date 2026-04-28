from __future__ import annotations
import logging
from typing import TYPE_CHECKING, Awaitable, Callable, Dict, Optional, Set, Tuple

if TYPE_CHECKING:
    from fastapi import WebSocket

logger = logging.getLogger(__name__)

_VALID_ROLES = ("player", "spectator")


class ConnectionManager:
    """Manages WebSocket connections grouped by room/game id.

    Optionally signals an event registry when broadcasts occur.
    Designed for dependency injection: each service provides its own signal callback.

    Role tracking is additive — callers that don't pass `role` to `connect()`
    are recorded as 'player' for backward compatibility. The role map is kept
    in lockstep with `_rooms`, so disconnects always clean both.
    """

    def __init__(self, signal_callback: Optional[Callable[[str], Awaitable[None]]] = None) -> None:
        self._rooms: Dict[str, Set["WebSocket"]] = {}
        self._roles: Dict[Tuple[str, "WebSocket"], str] = {}
        self._signal_callback = signal_callback

    async def connect(self, room_id: str, websocket: "WebSocket", role: str = "player") -> None:
        if role not in _VALID_ROLES:
            raise ValueError(f"role must be one of {_VALID_ROLES}, got {role!r}")
        await websocket.accept()
        self._rooms.setdefault(room_id, set()).add(websocket)
        self._roles[(room_id, websocket)] = role

    def disconnect(self, room_id: str, websocket: "WebSocket") -> None:
        room = self._rooms.get(room_id, set())
        room.discard(websocket)
        self._roles.pop((room_id, websocket), None)
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

    def player_count(self, room_id: str) -> int:
        return sum(
            1 for (rid, _ws), role in self._roles.items()
            if rid == room_id and role == "player"
        )

    def spectator_count(self, room_id: str) -> int:
        return sum(
            1 for (rid, _ws), role in self._roles.items()
            if rid == room_id and role == "spectator"
        )

from __future__ import annotations

import asyncio
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

    def __init__(
        self,
        signal_callback: Optional[Callable[[str], Awaitable[None]]] = None,
        send_timeout: float | None = None,
    ) -> None:
        self._rooms: Dict[str, Set["WebSocket"]] = {}
        self._roles: Dict[Tuple[str, "WebSocket"], str] = {}
        # Per-room role counters maintained in lockstep with `_rooms` / `_roles` so
        # `player_count(room)` / `spectator_count(room)` are O(1) instead of
        # O(total connections). Hot paths: GET /api/games/live (per-row) and
        # the spectator join/leave broadcast.
        self._player_counts: Dict[str, int] = {}
        self._spectator_counts: Dict[str, int] = {}
        self._signal_callback = signal_callback
        self._send_timeout = send_timeout

    async def connect(self, room_id: str, websocket: "WebSocket", role: str = "player") -> None:
        if role not in _VALID_ROLES:
            raise ValueError(f"role must be one of {_VALID_ROLES}, got {role!r}")
        await websocket.accept()
        self._rooms.setdefault(room_id, set()).add(websocket)
        self._roles[(room_id, websocket)] = role
        if role == "player":
            self._player_counts[room_id] = self._player_counts.get(room_id, 0) + 1
        else:  # spectator (already validated by _VALID_ROLES)
            self._spectator_counts[room_id] = self._spectator_counts.get(room_id, 0) + 1

    def disconnect(self, room_id: str, websocket: "WebSocket") -> None:
        role = self._roles.pop((room_id, websocket), None)
        room = self._rooms.get(room_id, set())
        room.discard(websocket)
        if role == "player":
            new = self._player_counts.get(room_id, 0) - 1
            if new <= 0:
                self._player_counts.pop(room_id, None)
            else:
                self._player_counts[room_id] = new
        elif role == "spectator":
            new = self._spectator_counts.get(room_id, 0) - 1
            if new <= 0:
                self._spectator_counts.pop(room_id, None)
            else:
                self._spectator_counts[room_id] = new
        if not room:
            self._rooms.pop(room_id, None)

    async def _send_to_client(
        self,
        room_id: str,
        websocket: "WebSocket",
        message: dict,
    ) -> tuple["WebSocket", Exception | None]:
        try:
            if self._send_timeout is None:
                await websocket.send_json(message)
            else:
                await asyncio.wait_for(
                    websocket.send_json(message), timeout=self._send_timeout
                )
            return websocket, None
        except asyncio.TimeoutError as e:
            logger.warning(
                f"Send to client in room {room_id} exceeded {self._send_timeout}s; disconnecting slow client"
            )
            return websocket, e
        except Exception as e:
            logger.warning(f"Failed to send to client in room {room_id}: {e}")
            return websocket, e

    async def broadcast(self, room_id: str, message: dict) -> None:
        sockets = list(self._rooms.get(room_id, set()))
        if sockets:
            results = await asyncio.gather(
                *(self._send_to_client(room_id, ws, message) for ws in sockets)
            )

            for ws, error in results:
                if error is not None:
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
        return self._player_counts.get(room_id, 0)

    def spectator_count(self, room_id: str) -> int:
        return self._spectator_counts.get(room_id, 0)

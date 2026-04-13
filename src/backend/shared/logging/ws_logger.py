"""
WebSocket Logger for Backend - Tracks payloads and latency for game sessions
Usage:
    from shared.logging.ws_logger import ws_logger
    ws_logger.ready(game_id, player_id, payload)
    ws_logger.receive(game_id, player_id, payload)
    ws_logger.latency('ready_to_broadcast', start_time)
"""

import os
import logging
import time
import json
from typing import Any, Dict, Optional, List
from dataclasses import dataclass, asdict
from datetime import datetime

logger = logging.getLogger(__name__)

# Enable WS logging only if explicitly requested via environment variable (default: disabled for production)
# Automatically enabled when using `make seed` for development/debugging
# Can also be enabled manually: WS_LOG_DEBUG=true make re-back
WS_LOG_ENABLED = os.getenv('WS_LOG_DEBUG', 'false').lower() == 'true'


@dataclass
class WSLogEntry:
    """Represents a single WebSocket log entry"""
    type: str
    room_id: str
    timestamp: float
    iso_timestamp: str
    payload: Optional[Dict[str, Any]] = None
    player_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
    latency_ms: Optional[float] = None


class WebSocketLogger:
    """Shared logging utility for WebSocket communication"""

    def __init__(self, max_events: int = 100):
        self.events: List[WSLogEntry] = []
        self.max_events = max_events

    def get_timestamp(self) -> float:
        """Get current timestamp in milliseconds"""
        return time.time() * 1000

    def get_iso_timestamp(self) -> str:
        """Get ISO 8601 formatted timestamp"""
        return datetime.utcnow().isoformat() + "Z"

    def _add_event(self, entry: WSLogEntry) -> None:
        """Add event to circular buffer"""
        self.events.append(entry)
        if len(self.events) > self.max_events:
            self.events.pop(0)

    def ready(
        self, game_id: str, player_id: int, payload: Dict[str, Any]
    ) -> None:
        """Log ready button click"""
        if not WS_LOG_ENABLED:
            return

        entry = WSLogEntry(
            type="ready_click",
            room_id=game_id,
            player_id=player_id,
            payload=payload,
            timestamp=self.get_timestamp(),
            iso_timestamp=self.get_iso_timestamp(),
        )

        self._add_event(entry)
        logger.info(
            f"[WS Ready] 🔘 Player {player_id} ready in game {game_id}: {json.dumps(payload)}"
        )

    def send(
        self, game_id: str, player_id: int, payload: Dict[str, Any]
    ) -> float:
        """Log message sent to client"""
        if not WS_LOG_ENABLED:
            return 0

        timestamp = self.get_timestamp()
        entry = WSLogEntry(
            type="send",
            room_id=game_id,
            player_id=player_id,
            payload=payload,
            timestamp=timestamp,
            iso_timestamp=self.get_iso_timestamp(),
        )

        self._add_event(entry)
        logger.debug(
            f"[WS Send] ↗️  Sent to player {player_id} in {game_id}: {json.dumps(payload)}"
        )

        return timestamp

    def broadcast(
        self, game_id: str, payload: Dict[str, Any], client_count: int = 0
    ) -> float:
        """Log message broadcasted to all clients"""
        if not WS_LOG_ENABLED:
            return 0

        timestamp = self.get_timestamp()
        entry = WSLogEntry(
            type="broadcast",
            room_id=game_id,
            payload=payload,
            timestamp=timestamp,
            iso_timestamp=self.get_iso_timestamp(),
            metadata={"client_count": client_count},
        )

        self._add_event(entry)
        logger.info(
            f"[WS Broadcast] 📡 Broadcasted to {client_count} clients in {game_id}: "
            f"{json.dumps(payload)}"
        )

        return timestamp

    def receive(
        self, game_id: str, player_id: int, payload: Dict[str, Any]
    ) -> float:
        """Log message received from client"""
        if not WS_LOG_ENABLED:
            return 0

        timestamp = self.get_timestamp()
        entry = WSLogEntry(
            type="receive",
            room_id=game_id,
            player_id=player_id,
            payload=payload,
            timestamp=timestamp,
            iso_timestamp=self.get_iso_timestamp(),
        )

        self._add_event(entry)
        logger.debug(
            f"[WS Receive] ↙️  Received from player {player_id} in {game_id}: "
            f"{json.dumps(payload)}"
        )

        return timestamp

    def connection(
        self, game_id: str, player_id: int, state: str, metadata: Optional[Dict] = None
    ) -> None:
        """Log connection state change (open/close/error)"""
        if not WS_LOG_ENABLED:
            return

        entry = WSLogEntry(
            type="connection",
            room_id=game_id,
            player_id=player_id,
            timestamp=self.get_timestamp(),
            iso_timestamp=self.get_iso_timestamp(),
            metadata=metadata or {},
        )

        self._add_event(entry)

        icon = "🔗" if state == "open" else "🔌"
        details = f" ({json.dumps(metadata)})" if metadata else ""
        logger.info(
            f"[WS Connection] {icon} Player {player_id} {state} in {game_id}{details}"
        )

    def session_state(self, game_id: str, state: Dict[str, Any]) -> None:
        """Log session state snapshot (players ready, score, etc)"""
        if not WS_LOG_ENABLED:
            return

        entry = WSLogEntry(
            type="session_state",
            room_id=game_id,
            payload=state,
            timestamp=self.get_timestamp(),
            iso_timestamp=self.get_iso_timestamp(),
        )

        self._add_event(entry)

        players_status = state.get("players", {})
        logger.debug(
            f"[WS Session] 🎮 Game {game_id} state: {json.dumps(state)}"
        )

    def latency(
        self, label: str, start_timestamp: float
    ) -> float:
        """Calculate and log latency between two points in time (in milliseconds)"""
        if not WS_LOG_ENABLED:
            return 0

        end_timestamp = self.get_timestamp()
        latency_ms = end_timestamp - start_timestamp

        entry = WSLogEntry(
            type="latency",
            room_id=label,
            timestamp=end_timestamp,
            iso_timestamp=self.get_iso_timestamp(),
            latency_ms=latency_ms,
        )

        self._add_event(entry)
        logger.info(
            f"[WS Latency] ⏱️  {label}: {latency_ms:.2f}ms"
        )

        return latency_ms

    def flow_start(self, game_id: str, label: str) -> float:
        """Log start of a flow (e.g., ready → broadcast → client update)"""
        if not WS_LOG_ENABLED:
            return 0

        timestamp = self.get_timestamp()
        logger.debug(f"[WS Flow] ▶️  Starting {label} in {game_id}")
        return timestamp

    def flow_end(self, game_id: str, label: str, start_timestamp: float) -> float:
        """Log completion of a flow with total latency"""
        if not WS_LOG_ENABLED:
            return 0

        latency_ms = self.latency(f"{label} (complete flow)", start_timestamp)
        logger.info(
            f"[WS Flow] ✅ Completed {label} in {game_id}: {latency_ms:.2f}ms total"
        )

        return latency_ms

    def error(self, game_id: str, player_id: Optional[int], message: str, exc: Optional[Exception] = None) -> None:
        """Log WebSocket errors"""
        if not WS_LOG_ENABLED:
            return

        entry = WSLogEntry(
            type="error",
            room_id=game_id,
            player_id=player_id,
            timestamp=self.get_timestamp(),
            iso_timestamp=self.get_iso_timestamp(),
            metadata={"message": message, "exception": str(exc) if exc else None},
        )

        self._add_event(entry)
        logger.error(f"[WS Error] ❌ Game {game_id} Player {player_id}: {message}", exc_info=exc)

    def export(self) -> Dict[str, Any]:
        """Export all logged events for debugging"""
        return {
            "exported_at": self.get_iso_timestamp(),
            "event_count": len(self.events),
            "events": [asdict(e) for e in self.events],
        }

    def clear(self) -> None:
        """Clear all logged events"""
        self.events.clear()
        logger.debug("[WS Logger] 🗑️  Cleared all events")

    def summary(self) -> Dict[str, Any]:
        """Get summary statistics of logged events"""
        summary = {
            "total_events": len(self.events),
            "by_type": {},
            "time_span_ms": None,
        }

        for event in self.events:
            summary["by_type"][event.type] = summary["by_type"].get(event.type, 0) + 1

        if len(self.events) > 1:
            first = self.events[0].timestamp
            last = self.events[-1].timestamp
            summary["time_span_ms"] = round(last - first, 2)

        return summary


# Create singleton instance
ws_logger = WebSocketLogger()

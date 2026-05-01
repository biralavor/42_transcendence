# Event-Driven Notification Architecture — ft_transcendence

**Version**: 2.0
**Last Updated**: 2026-05-01
**Status**: Production

---

## Overview

Notifications in ft_transcendence cross three microservices (user-service, game-service,
chat-service) and a React SPA. The transport is **WebSocket-first with REST fallback**:
the server pushes notification frames over a per-user WS channel, and the client also
exposes REST endpoints for listing, marking read, and deleting notifications. The
client uses smart polling against the REST surface only when the WS is disconnected
or the document is hidden.

The internal wakeup path between REST handlers and WS handlers is **event-driven** via
`asyncio.Event()`. REST endpoints persist the notification, then call
`ConnectionManager.broadcast()`, which sends the JSON frame to connected sockets and
signals an `EventRegistry` keyed by `user_id`. WS handlers wait on that event in a
race against client-disconnect detection, so delivery latency is bounded by network
RTT rather than a polling interval.

---

## Architecture

### Components

| Layer | File | Role |
|-------|------|------|
| Persistence | `src/backend/user-service/notifications.py` | CRUD over the `notifications` table (savepoint-scoped writes) |
| Model | `src/backend/user-service/models/notification.py` | SQLAlchemy `Notification` row (incl. `from_user_id`) |
| REST | `src/backend/user-service/main.py` (`/notifications`, `/game-invites`, `/game-invite/response`, `/friends/...`) | Creates rows, commits, then broadcasts |
| WS handler (user) | `src/backend/user-service/ws/notification_router.py` | `/ws/notifications/{user_id}` listen-only channel |
| WS handler (chat) | `src/backend/chat-service/ws/router.py` | `/ws/notifications` listen-only channel for DM previews |
| Connection mgr | `src/backend/shared/ws/manager.py` | `ConnectionManager` with optional `signal_callback` |
| Event registry (user) | `src/backend/user-service/ws/event_registry.py` | `notification_event_registry`, `presence_event_registry` |
| Event registry (chat) | `src/backend/chat-service/ws/event_registry.py` | `chat_notification_event_registry` |
| Game-service hook | `src/backend/game-service/notifications.py` | HTTP-calls user-service `/game-invites` for tournament events |
| Achievement hook | `src/backend/game-service/persistence.py` (`insert_game_achievement`) | Inserts directly into `notifications` (cross-service write) |
| Frontend consumer | `src/frontend/src/context/notificationContext.jsx` | WS subscriber + REST fallback poller, achievement toast queue, dedupe by id |
| Frontend UI | `src/frontend/src/Components/NotificationPanel.jsx` | Renders the merged notification list |

### `notifications` table

Defined in `src/backend/user-service/models/notification.py`:

| Column | Type | Notes |
|--------|------|-------|
| `id` | int (pk) | |
| `user_id` | int (fk users.id, CASCADE) | recipient |
| `from_user_id` | int (fk users.id, SET NULL), nullable | sender for game-invite-style events; added by alembic `20260412_a1b2c3d4e5f7_add_from_user_id_to_notifications.py` |
| `type` | varchar(50) | one of `friend_request`, `friend_request_accepted`, `friend_request_declined`, `game_invite`, `game_invite_response`, `game_invite_timeout`, `tournament_full`, `tournament_match_available`, `tournament_complete`, `game_achievement`, plus `new_dm` which is broadcast-only (chat-service does not persist DM notifications in this table) |
| `message` | text | <= 256 chars (validated in `create_notification`) |
| `read` | bool, default false | |
| `created_at` | timestamptz | server default `now()` |

The complete list of types accepted by the REST response schema lives in
`src/backend/user-service/schemas.py` (`NOTIFICATION_TYPES` literal,
`NotificationResponse`).

### EventRegistry

Per-service registry that maps `str(user_id)` to a single `asyncio.Event`. Same shape
in user-service and chat-service:

```python
class EventRegistry:
    def __init__(self):
        self._events: Dict[str, asyncio.Event] = {}
        self._lock = asyncio.Lock()

    async def get_or_create_event(self, user_id: str) -> asyncio.Event: ...
    async def signal_event(self, user_id: str) -> None: ...   # event.set()
    async def clear_event(self, user_id: str) -> None: ...    # event.clear()
    async def cleanup_event(self, user_id: str) -> None: ...  # del on last disconnect
```

Three global instances exist:

- `notification_event_registry` — user-service `/ws/notifications/{user_id}`
- `presence_event_registry` — user-service `/ws/presence`
- `chat_notification_event_registry` — chat-service `/ws/notifications`

### ConnectionManager and signal injection

`shared/ws/manager.py::ConnectionManager` accepts an optional `signal_callback` in its
constructor. Each broadcast walks the connected sockets, sends JSON, and then awaits
the callback if one was provided:

```python
async def broadcast(self, room_id: str, message: dict) -> None:
    sockets = list(self._rooms.get(room_id, set()))
    if sockets:
        results = await asyncio.gather(
            *(self._send_to_client(room_id, ws, message) for ws in sockets)
        )
        for ws, error in results:
            if error is not None:
                self.disconnect(room_id, ws)

    if self._signal_callback:
        try:
            await self._signal_callback(room_id)
        except Exception as e:
            logger.debug(f"Failed to signal event for room {room_id}: {e}")
```

The user-service notification manager and the chat-service notifications manager are
both wired with the appropriate `signal_event` callback at module import time
(`notification_router.py:18`, `chat-service/ws/router.py:20`).

---

## How event-driven notifications work in this project

The end-to-end path for a single notification has five stages. The same pattern
applies for friend requests, game invites, tournament events, and chat-service DMs;
only the producer differs.

### 1. A producer creates the notification

Producers fall into three categories:

- **user-service REST endpoints** (`main.py`): `/friends/request/...`,
  `/friends/requests/...`, `/game-invites`, `/game-invite/response`. They call
  `notifications.create_notification(...)`, `await session.commit()`, then
  `notification_manager.broadcast(str(recipient_id), _notif_payload(notif))`.
- **chat-service WS handler** (`chat-service/ws/router.py`): when a DM message is
  saved, it broadcasts a `new_dm` payload on the chat-service notifications manager
  to `str(recipient_uid)`. DM notifications are not persisted in the user-service
  `notifications` table — they are surfaced live and the client renders unread
  counts from the chat side.
- **game-service**: two paths exist.
  - **HTTP fan-in**: tournament events (`tournament_match_available`,
    `tournament_complete`, etc.) call
    `game-service/notifications.py::send_tournament_notification`, which `POST`s to
    `user-service /game-invites` with the player's bearer token. user-service then
    runs the standard create-then-broadcast flow.
  - **Direct DB write**: `game-service/persistence.py::insert_game_achievement`
    inserts an achievement row and a `notifications` row in a single CTE
    (`type='game_achievement'`). Because the row is inserted by a service other than
    user-service, no in-memory broadcast happens for achievements — the client
    picks them up via REST polling, or via the WS push path that fires when any
    later user-service request triggers a broadcast for the same recipient.

### 2. The broadcast envelope

`main.py::_notif_payload(notif)` produces the WS frame:

```json
{
  "type": "notification",
  "notification": {
    "id": 123,
    "user_id": 7,
    "from_user_id": 4,
    "type": "game_invite",
    "message": "alice invited you to play Pong [ROOM_ID:...]",
    "read": false,
    "created_at": "2026-05-01T12:34:56+00:00"
  }
}
```

DM frames from the chat-service use a different shape — `{type: "new_dm",
from_user_id, from_username, room_slug, preview}` — they are not persisted
notification rows.

### 3. ConnectionManager fan-out + event signal

`broadcast(str(user_id), payload)` sends the frame to every connected socket
registered under that user's room key. After the JSON sends, it calls the injected
`signal_callback`, which is `EventRegistry.signal_event(user_id)`. That sets the
`asyncio.Event` for that user.

### 4. WS handler wakes and loops

Both `/ws/notifications/{user_id}` (user-service,
`ws/notification_router.py:67-126`) and `/ws/notifications` (chat-service,
`ws/router.py:248-294`) use the same race pattern:

```python
while True:
    event = await registry.get_or_create_event(room)
    notify_task = asyncio.create_task(event.wait())
    disconnect_task = asyncio.create_task(websocket.receive_text())

    done, pending = await asyncio.wait(
        [notify_task, disconnect_task],
        timeout=10.0,
        return_when=asyncio.FIRST_COMPLETED,
    )
    for task in pending:
        task.cancel()
        try: await task
        except asyncio.CancelledError: pass

    if disconnect_task in done:
        # client closed or sent unexpected data on a listen-only channel — exit
        break
    if notify_task in done:
        await registry.clear_event(room)
    # else: 10s fail-safe timeout, loop continues
```

Important properties of this loop:

- The handler does not actually re-send the frame from inside the loop. The frame
  was already pushed by `broadcast()` before `signal_event` was called. The event
  exists so the WS task can stay parked without a polling sleep, while still being
  able to react to disconnects.
- Racing `event.wait()` against `websocket.receive_text()` lets the handler detect
  client disconnect immediately instead of waiting for the next timeout tick. The
  channel is listen-only; if the client ever sends data, the handler logs a
  warning and exits.
- The 10-second timeout is a fail-safe: if neither task fires, the loop simply
  re-enters the wait. Worst-case stuck-socket detection is bounded by this.
- On final disconnect (when `active_connections(room) == 0`), the handler calls
  `cleanup_event(room)` to free the registry slot.

### 5. The frontend consumes WS first, REST as fallback

`src/frontend/src/context/notificationContext.jsx` runs four effects keyed by the
authenticated user id:

1. Resolve `userId` via `/api/users/auth/me`.
2. One-shot `GET /api/users/notifications` to seed the list.
3. Open `wss://.../api/users/ws/notifications/{userId}?token=...`. On message,
   parse the frame, ignore anything where `frame.type !== 'notification'`, route
   `notif.type === 'game_achievement'` to a separate `achievementQueue` (toast
   pipeline, deduped by id, capped at 20), and otherwise prepend to the main
   notification list with `setNotifications(prev => [entry, ...prev.filter(n =>
   n.id !== notif.id)].slice(0, 20))`. The `filter(n => n.id !== notif.id)`
   pre-step is the primary client-side dedupe — the same notification can arrive
   via both WS push and the REST fallback poller without double-rendering.
4. **Smart polling**: a recursive `setTimeout` runs only when
   `!wsConnectedRef.current || document.hidden`. Base interval 5 s, exponential
   backoff up to 15 s on consecutive failures. Polling is paused on
   `visibilitychange → hidden` and resumed on visible+disconnected.

The `unread_chat` pseudo-notifications (synthetic entries built from
`useUnread()` DM unread counts) are merged into the same list in `combinedNotifications`,
sorted by `created_at` descending.

---

## Channels

| Service | Endpoint | Direction | Registry | Purpose |
|---------|----------|-----------|----------|---------|
| user-service | `/ws/notifications/{user_id}` | listen-only | `notification_event_registry` | All persisted notifications addressed to `user_id` |
| user-service | `/ws/presence` | listen-only | `presence_event_registry` | Friend online/offline transitions |
| chat-service | `/ws/notifications` | listen-only | `chat_notification_event_registry` | Live `new_dm` previews (not persisted) |
| chat-service | `/ws/chat/{room_slug}` | bi-directional | — | Chat messages (input-driven, no event registry needed) |
| game-service | `/ws/game/{game_id}` | bi-directional | — | Authoritative game state, input-driven |

Bi-directional channels are not part of the event-driven path: their broadcasts are
already triggered by inbound client frames or by the game loop, so there is no
polling latency to remove.

---

## Cross-service notification triggers

| Producer | Mechanism | Notes |
|----------|-----------|-------|
| user-service REST → user-service WS | In-process: `create_notification` + `notification_manager.broadcast` | Default path for friend/game-invite/tournament-response flows |
| game-service tournament events | HTTP `POST /game-invites` to user-service with player bearer token (`game-service/notifications.py`) | `tournament_full`, `tournament_match_available`, `tournament_complete`. Best-effort: errors are swallowed to avoid blocking the tournament progression |
| game-service achievements | Direct `INSERT INTO notifications` inside the achievement CTE (`game-service/persistence.py:1410-1416`) | Cross-database write within the shared Postgres instance. No live broadcast — achievement toasts surface on the client's next REST poll or via a subsequent WS event for the same user |
| chat-service DMs | Live broadcast only on `chat-service /ws/notifications` | DM frames are not stored in the `notifications` table; unread counts are tracked client-side via `useUnread()` |

---

## REST endpoints (user-service)

Defined in `src/backend/user-service/main.py`, mounted via the user-service router:

| Method | Path | Behaviour |
|--------|------|-----------|
| GET | `/notifications` | Last 20 notifications for the caller, newest first (`get_notifications`) |
| PUT | `/notifications/{id}/read` | Mark one as read; 404 if not owned by caller |
| PUT | `/notifications/read-all` | Mark all caller's notifications read |
| DELETE | `/notifications/{id}` | Delete one; 404 if not owned by caller |
| POST | `/game-invites` | Create + broadcast a game/tournament notification (used by the game-service HTTP path and by the frontend invite UI) |
| POST | `/game-invite/response` | Create + broadcast `game_invite_response` (accepted/declined/timeout); rejects self-targeting |

All write endpoints commit the row before calling `notification_manager.broadcast(...)`,
so a WS push is never observed before the row is durable.

`notifications.create_notification` runs inside `db.begin_nested()` (savepoint) so
its failure does not roll back the surrounding transaction (e.g. the friendship
acceptance in `respond_to_request`). Producers that need the friendship to outlive a
notification failure call `await session.commit()` before attempting the
notification, and log a warning instead of raising on `ValueError` (message length).

---

## Client-side dedupe

The same notification can be observed by the client via two paths:

- WS push from `notification_manager.broadcast(...)`
- REST poll from `GET /notifications` (during smart polling, or the seed fetch on
  reconnect)

Dedupe is by `notification.id`. The WS handler in `notificationContext.jsx`
applies `prev.filter(n => n.id !== notif.id)` before prepending, and the
achievement queue applies `prev.some(a => a.id === notif.id)`. The REST seed
replaces the list wholesale, so any in-flight WS-only entries are reconciled on
the next render. DM pseudo-notifications use a synthetic id (`dm-{slug}`) that
will never collide with backend ids.

---

## Why event-driven instead of a sleep loop

The original handler shape was `await asyncio.sleep(1)` followed by a DB read. That
introduced ~1 s of avoidable latency on every notification and kept the handler in
runnable state continuously. The current shape parks each handler on
`asyncio.Event` and on `websocket.receive_text()` simultaneously, so:

- WS push latency is bounded by network RTT plus the `gather` over connected
  sockets in `broadcast`. There is no idle polling delay.
- Idle handlers consume effectively no CPU — they sit in `asyncio.wait(...)`.
- Disconnects are detected as soon as the TCP/WebSocket close is observed,
  without waiting on the 10-second fail-safe.
- All handlers for the same `user_id` share one event, so a single `event.set()`
  wakes every connected tab.

---

## Adding a new event-driven channel

1. Create or reuse an `EventRegistry` instance in your service's `ws/`.
2. Construct a `ConnectionManager` with
   `signal_callback=my_registry.signal_event`.
3. In your WS handler, follow the race pattern from
   `user-service/ws/notification_router.py:67-126`:
   - `notify_task = asyncio.create_task(event.wait())`
   - `disconnect_task = asyncio.create_task(websocket.receive_text())`
   - `asyncio.wait([...], timeout=10.0, return_when=FIRST_COMPLETED)`
   - cancel the loser, clear the event on notify, break on disconnect
4. Producers commit the DB row first, then call `manager.broadcast(...)` — the
   manager runs the signal callback automatically.
5. On final disconnect, call `registry.cleanup_event(room)` to drop the slot.

---

## References

- `src/backend/user-service/notifications.py` — persistence
- `src/backend/user-service/main.py` — REST surface and broadcast call sites
- `src/backend/user-service/ws/notification_router.py` — WS handler
- `src/backend/user-service/ws/event_registry.py` — registry implementation
- `src/backend/user-service/alembic/versions/20260412_a1b2c3d4e5f7_add_from_user_id_to_notifications.py`
- `src/backend/chat-service/ws/router.py` — `/ws/chat` and `/ws/notifications`
- `src/backend/chat-service/ws/event_registry.py`
- `src/backend/game-service/notifications.py` — tournament HTTP fan-in
- `src/backend/game-service/persistence.py` — achievement CTE
- `src/backend/shared/ws/manager.py` — `ConnectionManager`
- `src/frontend/src/context/notificationContext.jsx` — WS subscriber + smart polling
- `src/frontend/src/Components/NotificationPanel.jsx` — UI
- `docs/WEBSOCKET_LOGGING.md` — observability conventions
- `docs/ARCHITECTURE.md`, `docs/AUTHENTICATION.md`

# About WebSockets — Bira's Study Notes

These are my own notes from learning WebSockets while building ft_transcendence. Two halves:

- **Part I — Theory**: what WebSockets are, why HTTP can't do this, the handshake, frames, close codes.
- **Part II — Our project**: how WebSockets are actually wired into our 3-microservice backend + React frontend. File paths included so I can jump back to the code.

---

## Part I — Theory

### 1. The problem WebSockets solve

HTTP is request/response. The client asks; the server answers; the connection ends. That's fine for "give me /profile/3.json", but it's a terrible model for:

- A chat where another user types something and I should see it instantly.
- A multiplayer game where the ball must move at 30+ frames per second.
- "X is online now" presence dots.
- "Alice invited you to a Pong match" toasts.

People worked around HTTP for years with three patterns, all bad:

| Workaround | How it works | Why it stinks |
|---|---|---|
| Polling | Client asks every N seconds: "anything new?" | Wastes bandwidth + battery; latency = N. |
| Long polling | Server holds the request open until something happens, then replies. | One full HTTP round-trip per event; doesn't scale. |
| Server-Sent Events | Server pushes a one-way stream over HTTP. | Server → client only. No client → server channel without a second connection. |

WebSocket fixes this with a **single TCP connection that stays open and sends frames in either direction**, with low overhead per frame. RFC 6455 (2011).

### 2. The handshake — HTTP becomes WS

A WS connection starts as an ordinary HTTP/1.1 GET with two special headers:

```
GET /ws/chat/lobby HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

If the server agrees, it answers `101 Switching Protocols` and from that point the same TCP socket stops speaking HTTP and starts speaking WS frames. The `Sec-WebSocket-Key` is a nonce; the server hashes it with a fixed GUID and returns `Sec-WebSocket-Accept`. This is purely an anti-cache / accidental-upgrade safeguard, not real security.

Important consequence: **any proxy on the path must understand and forward the Upgrade headers**. If it strips them, the upgrade never happens. (See nginx section in Part II — this bit me.)

### 3. Frames

After upgrade, both sides send/receive *frames*. A frame has a small binary header (a few bytes) and a payload. Frame types I care about:

- **Text** (opcode 0x1) — UTF-8 string, almost always JSON in our app.
- **Binary** (0x2) — raw bytes; we don't use this.
- **Ping / Pong** (0x9 / 0xA) — keep-alive. Browsers and servers handle these automatically.
- **Close** (0x8) — graceful shutdown with a 16-bit code + optional reason string.

Compared to HTTP/1.1 where every message has dozens of header bytes, a WS frame is tiny. That's what makes 30Hz game broadcasts feasible.

### 4. Close codes I actually see in our project

Standard codes (RFC 6455):

- `1000` — normal close.
- `1001` — going away (tab closed, server shutdown).
- `1006` — abnormal close (no Close frame received). I get this when wifi drops.
- `1011` — server error.

Application codes (4000–4999) — we define our own:

- `4001` — auth failed (bad/missing token, user not found).
- `4002` — DB error during connect (chat-service uses this if `get_or_create_room` fails).
- `4003` — forbidden (token valid, but not the right user / not a participant / spectator tried to send input).
- `4004` — not found (game session doesn't exist, tournament doesn't exist).

### 5. Lifecycle of one connection

```
client: new WebSocket(url)
       │
       │  HTTP GET + Upgrade headers
       ▼
server: receives, validates, accepts → sends 101
       │
       ▼
   [open] ←──── frames flow either direction ────→
       │
       │  client closes tab / network drops / server kicks
       ▼
   [close] both sides see a close event/exception
```

On the browser, `WebSocket` exposes 4 events: `onopen`, `onmessage`, `onclose`, `onerror`. On the FastAPI side, the handler is an `async` function that calls `await websocket.accept()`, then loops on `receive_*()` until a `WebSocketDisconnect` exception is raised.

### 6. Things that surprised me

- **WS does NOT auto-reconnect.** If the network blinks, the socket dies and you're done unless you wrote reconnect logic. Browsers don't do it for you.
- **The browser `WebSocket` constructor cannot set custom headers.** You can't put `Authorization: Bearer <jwt>` on a WS handshake. Workarounds: pass token via `?token=<jwt>` query string, send a first frame with the token after open, or use cookies. We use the query string.
- **Backpressure is your problem.** If a client is slow, `send_json` can block. The game-service sets a 0.5s send timeout per client and disconnects slow ones so the 30Hz loop doesn't stall. (Other services don't bother — chat is human-paced.)
- **Horizontal scaling needs a broker.** Our `ConnectionManager` is a Python dict in process memory. Two replicas can't see each other's sockets; you'd need Redis pub/sub. For our project (single container per service) it's fine.
- **`while True` is not a busy loop.** `await websocket.receive_json()` parks the coroutine. The event loop reuses the thread for thousands of idle sockets. This is what makes async servers good at WS.

### 7. WebSocket vs SSE vs HTTP/2 push

- **SSE** is one-way (server → client) over HTTP. Simpler, auto-reconnects, but no client → server frames. Good for stock tickers; bad for games.
- **HTTP/2 server push** is unrelated — it pushes resources for caching, not application messages.
- **WS** is the only one of the three that gives bidirectional, low-overhead, real-time framing.

---

## Part II — How WebSockets work in our project

### 8. The big picture

We have 3 backend microservices, each with its own WS endpoints:

```
                          ┌────────── user-service (8001) ───────────┐
                          │  /ws/presence              (per-user)     │
                          │  /ws/notifications/{id}    (per-user)     │
                          └───────────────────────────────────────────┘
browser ─→ nginx (443) ─→ ┌────────── game-service (8002) ───────────┐
                          │  /ws/game/{game_id}        (per-room)     │
                          │  /ws/tournament/{id}       (per-tourney)  │
                          └───────────────────────────────────────────┘
                          ┌────────── chat-service (8003) ───────────┐
                          │  /ws/chat/{room_slug}      (per-room)     │
                          │  /ws/notifications         (per-user)     │
                          └───────────────────────────────────────────┘
```

nginx terminates TLS on `443/8443`, then proxies based on the URL prefix. Browser-side, the URL the client opens is always `wss://host/api/{service}/ws/...?token=<jwt>`.

### 9. nginx — making the upgrade work

`services/nginx/nginx.conf.template`. Three pieces matter for WS:

```nginx
# 1) Map to translate Upgrade header → Connection header value.
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;     # if no Upgrade header, this is plain HTTP — close after request
}

# 2) On each /api/* location:
location /api/users/ {
    proxy_pass             http://user-service/;
    proxy_http_version     1.1;                          # HTTP/1.0 cannot upgrade
    proxy_set_header       Upgrade $http_upgrade;
    proxy_set_header       Connection $connection_upgrade;
    proxy_read_timeout     3600s;                        # otherwise idle WS dies after 60s
    proxy_send_timeout     3600s;
    proxy_buffering        off;                          # don't buffer frames!
}
```

The `proxy_buffering off` line is the one I keep forgetting. Without it nginx buffers small frames waiting for "more" data, adding latency that's deadly for the game loop. The 3600s timeout matters because nginx defaults are short and would silently kill idle WS like the presence channel.

`/api/users/`, `/api/game/`, `/api/chat/` blocks all carry the same WS upgrade headers. `/api/games/` (plural — REST endpoints for live-games listing) does *not* — it's HTTP only.

### 10. Connection state lives in memory — `shared/ws/manager.py`

This is the single most important class to understand. Lives at `src/backend/shared/ws/manager.py`.

```python
class ConnectionManager:
    def __init__(self, signal_callback=None, send_timeout=None):
        self._rooms: Dict[str, Set[WebSocket]] = {}
        self._roles: Dict[Tuple[str, WebSocket], str] = {}     # 'player' | 'spectator'
        self._player_counts: Dict[str, int] = {}
        self._spectator_counts: Dict[str, int] = {}
        self._signal_callback = signal_callback                 # for event-driven wakeup
        self._send_timeout = send_timeout                       # backpressure guard

    async def connect(self, room_id, websocket, role="player"):
        await websocket.accept()
        self._rooms.setdefault(room_id, set()).add(websocket)
        # ...track role + counts...

    def disconnect(self, room_id, websocket):
        # ...remove socket; prune empty rooms to avoid memory leak...

    async def broadcast(self, room_id, message):
        sockets = list(self._rooms.get(room_id, set()))         # snapshot!
        results = await asyncio.gather(
            *(self._send_to_client(room_id, ws, message) for ws in sockets)
        )
        for ws, error in results:                                # evict dead sockets
            if error is not None:
                self.disconnect(room_id, ws)
        if self._signal_callback:                                # event-driven wakeup
            await self._signal_callback(room_id)
```

Things I learned reading this code:

1. **`_rooms` is a plain dict in the uvicorn process.** Cross-process broadcast would need Redis pub/sub. We don't.
2. **The `list()` snapshot before iterating** is mandatory. If a socket dies and gets removed mid-iteration, the set mutates and Python raises `RuntimeError: Set changed size during iteration`.
3. **`asyncio.gather` parallel send.** All clients in a room get the frame in parallel; one slow client doesn't delay the others.
4. **Send timeout (game-service only).** `manager = ConnectionManager(send_timeout=0.5)` in `game-service/ws/router.py:32`. Slow clients are disconnected so the 30Hz game loop doesn't stall. Chat doesn't need this — humans aren't 30Hz.
5. **Role tracking + counts** are kept in lockstep with `_rooms`. Used by the live-games endpoint and the spectator banner.
6. **Pruning empty rooms** (`if not room: self._rooms.pop(...)`) prevents the dict from growing forever as games come and go.

`PresenceManager` (`shared/ws/presence.py`) is a sibling class keyed by `user_id: int` instead of `room_id: str`. Same shape, different key — because presence is "is this user online anywhere?", not "what's in this room?"

### 11. The two auth patterns

We have two ways the server figures out who you are on a WS connection. I keep forgetting which is which.

**Pattern A: `get_me(token, session)` — user-service only.** Decodes the JWT `sub` claim (which is a username), then `SELECT … FROM users WHERE username = …`. This is the source-of-truth auth, but it touches two tables (credentials + users) so it's a bit slower.

**Pattern B: `_uid_from_token(token)` + DB lookup — game-service and chat-service.** Decodes locally, extracts `credential_id`, then `SELECT id FROM users WHERE credential_id = :cid`. One small query, no inter-service network call, ~5ms. This is the "hybrid" path.

Both rely on the same trick to get the token in the first place: `?token=<jwt>` in the WS URL, because browsers can't set Authorization headers on WS.

### 12. WebSocket channel inventory

| nginx URL | Service | FastAPI route | Auth | Direction | Purpose |
|---|---|---|---|---|---|
| `/api/users/ws/presence` | user-service | `/ws/presence` | `get_me` | server→client | Friend online/offline events |
| `/api/users/ws/notifications/{id}` | user-service | `/ws/notifications/{user_id}` | `get_me` + ownership | server→client | Friend events, game invites, achievements |
| `/api/game/ws/game/{id}` | game-service | `/ws/game/{game_id}` | `credential_id` (optional, for player) | bidirectional | Pong inputs + state; spectators when no token |
| `/api/game/ws/tournament/{id}` | game-service | `/ws/tournament/{tournament_id}` | `credential_id` | bidirectional | Tournament ready/start signaling |
| `/api/chat/ws/chat/{slug}` | chat-service | `/ws/chat/{room_slug}` | `credential_id` (DM-required) | bidirectional | Chat messages + typing |
| `/api/chat/ws/notifications` | chat-service | `/ws/notifications` | `credential_id` | server→client | DM unread pings |

### 13. Event-driven listen-only handlers

This is a recent change (April 2026, see `docs/EVENT_DRIVEN_NOTIFICATIONS.md`) that I want to remember.

Listen-only channels (`/ws/presence`, `/ws/notifications/{id}`, chat-service `/ws/notifications`) used to do this in their main loop:

```python
while True:
    await asyncio.sleep(1)   # poll
```

That works but the latency floor was 1 second. We replaced it with `asyncio.Event` + a registry per service:

```python
# src/backend/user-service/ws/event_registry.py
class EventRegistry:
    def __init__(self):
        self._events: Dict[str, asyncio.Event] = {}

    async def signal_event(self, user_id):
        event = await self.get_or_create_event(user_id)
        event.set()                                 # wakes the handler instantly
```

The `ConnectionManager` constructor takes a `signal_callback`. After every `broadcast()`, it calls that callback with the room id, which calls `event.set()`, which wakes the parked handler. End-to-end notification latency went from ~1000ms to ~5–50ms.

The handler pattern (see `src/backend/user-service/ws/notification_router.py:67`):

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
    # cancel pending; if disconnect_task in done → break; else clear event and loop
```

Two things I had to read twice:

1. **Why race a `receive_text()` we don't want to read?** Because that's the only way to detect disconnect promptly. `event.wait()` alone would never wake on disconnect, and the OS can take minutes to time out a dead TCP socket. Racing the two means whichever comes first wins — notification fires *or* the client goes away.
2. **Why a 10s timeout?** Fail-safe. If both tasks somehow stall, we don't want a handler stuck forever. Loop and try again.

### 14. Presence — `src/backend/user-service/ws/presence_router.py`

Presence answers "is this user online?". Two interesting bits beyond the channel mechanics:

```python
# 1. Send "alice is online" only on the FIRST connection of that user.
already_online = presence_manager.is_online(user_id)
await presence_manager.connect(user_id, websocket)
if not already_online:
    friends = await get_friends(user_id, db_session)
    for friend in friends:
        if presence_manager.is_online(friend.id):
            await presence_manager.broadcast_to(friend.id,
                {"type": "presence", "user_id": user_id, "status": "online"})
    await set_user_status(user_id, "online", db_session)

# 2. On disconnect, send "alice is offline" only if NO sockets remain for that user.
presence_manager.disconnect(user_id, websocket)
if not presence_manager.is_online(user_id):
    # broadcast offline to friends + update DB
```

`set_user_status` writes `users.status` so the REST API (`/profile/{id}`, `/friends`) returns the correct dot color even before a friend's WS map has loaded. The frontend uses the WS as the live source and falls back to the REST status field.

Frame shape: `{"type": "presence", "user_id": 42, "status": "online" | "offline"}`.

### 15. User-service notifications — listen-only, ownership-enforced

`src/backend/user-service/ws/notification_router.py`. Important rules:

- Only the authenticated owner may connect (`me.id != user_id` → close 4003).
- Clients **cannot send** notifications. Any inbound frame is logged as a warning. Delivery happens server-side via `POST /api/users/game-invites`, which:
  1. Injects `from_user_id` and `from_username` from the JWT (anti-impersonation).
  2. Persists a `notifications` row.
  3. `notification_manager.broadcast(str(target_id), raw_payload)` — the FriendsSidebar uses this to render an invite popup.
  4. `notification_manager.broadcast(str(target_id), notification_envelope)` — the bell badge consumes this.

Two broadcasts per game event = two WS frames the recipient gets. The frontend filters by `frame.type === 'notification'` for the bell, and the raw frame for the invite UI.

Notification envelope:

```json
{
  "type": "notification",
  "notification": {"id": 7, "type": "game_invite", "message": "alice invited you to play Pong", "read": false}
}
```

### 16. Chat — `src/backend/chat-service/ws/router.py`

Two endpoints:

**`/ws/chat/{room_slug}`** — bidirectional. Public rooms tolerate anonymous senders (no token → connect as anonymous). DM rooms (slug like `DM-3-7`) **require** a valid token *and* require the sender to be one of the two participant IDs:

```python
# router.py:78–134
dm_participants = _parse_dm_participants(room_slug)   # returns (lo, hi) or None
sender_uid = ... # resolve from token
if dm_participants is not None:
    if sender_uid is None:
        await websocket.close(code=4001); return
    if sender_uid not in dm_participants:
        await websocket.close(code=4003); return
```

The slug pattern `DM-{lo}-{hi}` (sorted user ids) means there's exactly one canonical DM room for each pair — `DM-3-7`, never `DM-7-3`. Frontend (`Chat.jsx`) computes the slug deterministically when opening a DM.

On every persisted message in a DM, the chat-service also pushes a `new_dm` frame to the recipient's per-user notification socket:

```python
# router.py:201–211
await notifications_manager.broadcast(str(recipient_uid), {
    "type": "new_dm",
    "from_user_id": sender_uid,
    "from_username": message_sender,
    "room_slug": room_slug,
    "preview": data["content"][:80],
})
```

Block list is enforced inside `_sender_is_blocked` before broadcast/persist — if the recipient blocked the sender, the message is silently dropped (not persisted, not delivered).

**`/ws/notifications`** — the per-user channel. Pure server-push: any client frame triggers a warning log. This is what the unreadContext on the frontend uses to count DM badges.

### 17. Game — `src/backend/game-service/ws/router.py`

The most complex WS handler in the project. ~1500 lines. Key pieces:

**Player vs spectator classification (lines ~961–977).** Token is *optional*. The flow:

1. Decode token → `credential_id` → `SELECT id FROM users WHERE credential_id = …`. No row, JWT failure, or no token → `caller_user_id = None` → spectator.
2. Resolve the room's player IDs by checking, in priority order: live `GameSession`, `_waiting_room_players`, `_setup_sessions`, parsed from `invite-{p1}-{p2}-…` URL.
3. If `caller_user_id` is in the resolved player tuple → **player** path; otherwise → **spectator** path.

Spectators are **read-only**. Any inbound frame triggers `close(4003)`. The first thing they receive is a state snapshot so they don't have to wait for the next tick. `manager.broadcast(... spectator_count ...)` notifies everyone in the room when audience size changes.

**Ready/start state machine.** Players hit `player_ready`, server tracks `_waiting_room_ready: dict[str, set[int]]`. When both players are in the set, server `broadcast`s `game_start` and creates the `GameSession`. There's a 90s `READY_TIMEOUT_SECONDS` on the waiting room — if both players haven't readied up, the match is cancelled (or, in tournaments, recorded as a forfeit).

**Live game loop.** `GameSession` runs at 30Hz in a separate task. Each tick, it builds a state snapshot and calls `_broadcast_state(game_id, snapshot)` → `manager.broadcast(game_id, {"type": "state", ball:{}, paddles:{}, score:{}})`. This is the only WS broadcast that fires continuously; everything else is event-driven.

**Disconnect grace.** Two grace windows, both 30s (`DISCONNECT_GRACE_SECONDS`):

- **One player drops, the other stays.** Server pauses the session, broadcasts a per-second `opponent_disconnected` countdown to the surviving player, and starts `_disconnect_countdown(game_id, winner_id)` that awards a forfeit win on timeout. If the dropped player reconnects (same `player_id` rejoins the room), the timer is cancelled and the session resumes.
- **Both players drop simultaneously** — happens during the waiting-room → game-page React route transition. Server pauses the session, starts `_both_disconnect_grace(game_id)`, deletes the session if neither player reconnects in 30s.

Disconnect logic lives in the `finally:` block at `router.py:1281–1385`. It branches on: AI game vs PvP, last-player-out vs one-still-here, active session vs already-game-over.

**AI games.** `POST /api/game/ai` (`router.py:826`) creates the match row + `GameSession` with `player2_id = AI_PLAYER_ID` and returns a `game_id`. The client then opens `/ws/game/{game_id}?token=<jwt>` and the same handler runs, just with one human and AI input being computed inside `GameSession`.

**Tournament endpoint** `/ws/tournament/{tournament_id}` is separate (`router.py:1412`). Only registered participants can connect (close 4003 otherwise). Used to coordinate per-match ready states: when both players in a bracket pair are ready, the server creates a tournament-scoped game room id (`tournament-{t_id}-match-{match_id}`) and broadcasts `match_start`. Same 90s ready timeout.

### 18. Frontend — `src/frontend/src/utils/wsClient.js`

Tiny wrapper (~50 lines). Two reasons to exist:

1. **JSON serialization** — `ws.send(JSON.stringify(data))` on send, `JSON.parse(event.data)` on receive.
2. **Exponential-backoff reconnect** — start at 1s, double on each failure up to 30s, reset to 1s on a successful open.

```js
ws.onclose = () => {
  if (intentionallyClosed) return     // ← user closed → don't reconnect
  onClose?.()
  retryTimer = setTimeout(connect, retryDelay)
  retryDelay = Math.min(retryDelay * 2, 30_000)
}
```

The `intentionallyClosed` flag is the key distinction between "user logged out" (don't reconnect — would only flap with a stale token) and "wifi blinked" (reconnect please). `client.close()` sets it; `ws.onclose` from the network does not.

Used by:

- `pages/Chat.jsx` — chat room WS.
- `pages/GameWaitingRoom.jsx` — waiting-room WS to game-service.
- `pages/Tournament.jsx` — tournament WS.
- `utils/gameInviteChannel.js` — wraps user-service notification WS for `FriendsSidebar`.

### 19. Frontend — three context providers, three background WS

These three providers live high in the React tree (`main.jsx`) and each open exactly one WS for the whole authenticated session. Together they power presence dots, the bell badge, and DM unread counts.

**`presenceContext.jsx`** — bare `new WebSocket(...)` (no `createWsClient`). Reason: presence is a session singleton; on logout React unmounts and calls `ws.close()`, which is intentional. We don't want reconnect loops with a stale token.

```jsx
const url = `${scheme}//${host}/api/users/ws/presence?token=${access_token}`
const ws = new WebSocket(url)
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  if (data.type === 'presence')
    setPresenceMap(prev => ({ ...prev, [data.user_id]: data.status }))
}
return () => ws.close()
```

`presenceMap` is `{ user_id: "online" | "offline" }`. Components read it via `usePresence()`:

```jsx
<span className={`status-${presenceMap[friend.id] ?? friend.status}`} />
```

The `??` falls back to the REST `status` field, so dots are correct even before the WS finishes connecting.

**`notificationContext.jsx`** — opens user-service `/ws/notifications/{id}`. Two-step auth because the JWT `sub` is the username, not the integer id:

```
Step 1: GET /api/users/auth/me  → { id: 7 }
Step 2: open WS /api/users/ws/notifications/7?token=<jwt>
```

Filters `frame.type === 'notification'` (ignores raw game_invite frames; FriendsSidebar handles those). Routes `notif.type === 'game_achievement'` to a separate toast queue. Caps the list at 20 with deduplication on `notif.id`.

There's also a smart polling fallback: if `wsConnectedRef.current === false` *or* `document.hidden`, it polls `/api/users/notifications` every 5s (with backoff up to 15s on failure). When the WS is healthy and the tab is visible, no polling. This survives the case where the WS silently dies (1006) and the reconnect attempt fails.

**`unreadContext.jsx`** — opens chat-service `/ws/notifications`. Listens for `new_dm` frames and increments per-room unread counts (`unreadCounts: { [slug]: number }`). Skips the increment if `activeRoomRef.current === room_slug` (user is already viewing that DM). Also tracks the latest sender username per slug (`dmSenders`), so the notification list can show "3 unread messages from alice" instead of just "3 unread messages".

The Navbar bell badge sums `notifications.unreadCount + sum(unreadCounts)` so users see one number for everything pending.

### 20. The full journey of one message

#### Chat message in a public room

```
Browser            nginx              chat-service
  │                  │                      │
  │  WS frame ──────▶│                      │
  │  {sender,content}│  proxy frame ───────▶│
  │                  │                      │ receive_json()
  │                  │                      │ validate
  │                  │                      │ save_message(db, …)
  │                  │                      │ manager.broadcast(slug, data)
  │                  │◀──── frame (ws1) ────│
  │◀── frame (ws1) ──│                      │
  │                  │◀──── frame (ws2) ────│  (other client in room)
  (other browser) ◀──│                      │
```

#### DM (Alice → Bob, Bob is on /home, not in the chat tab)

```
Alice browser     nginx          chat-service          Bob browser
  │                 │                 │                       │
  │ WS /chat/DM-1-2│                 │                       │
  │  ?token=alice ▶│ upgrade ───────▶│ uid=1                 │
  │                │                 │ manager.connect       │
  │                │                 │  ("DM-1-2", aws)      │
  │                │                 │                       │
  │                │                 │◀── WS /notifications ─│
  │                │                 │   ?token=bob          │
  │                │                 │ uid=2                 │
  │                │                 │ notifications_mgr     │
  │                │                 │  .connect("2", bws)   │
  │                │                 │                       │
  │ {sender:alice, │                 │                       │
  │  content:"hi"} ▶ frame ─────────▶│                       │
  │                │                 │ save_message()        │
  │                │                 │ manager.broadcast     │
  │                │                 │  ("DM-1-2", msg) → echoes to alice
  │                │                 │ notifications_mgr     │
  │                │                 │  .broadcast("2", {    │
  │                │                 │    type:"new_dm",     │
  │                │                 │    from_username:     │
  │                │                 │     "alice",          │
  │                │                 │    room_slug:         │
  │                │                 │     "DM-1-2",         │
  │                │                 │    preview:"hi"})     │
  │                │                 │ ── frame ────────────▶│ unreadContext:
  │                │                 │                       │  unreadCounts["DM-1-2"]++
  │                │                 │                       │  dmSenders["DM-1-2"]="alice"
  │                │                 │                       │
  │                │                 │                       │ Navbar bell badge = ... + 1
```

Bob's unreadContext and notificationContext are on **two separate WS** in two different services. The bell badge sums their counts.

#### Game invite (Alice clicks "Invite Bob to Pong")

```
Alice browser      nginx           user-service          Bob browser
  │                   │                  │                       │
  │  persistent WS ──▶│ upgrade ────────▶│ room "1" registered   │
  │   /ws/notifications/1                │                       │
  │   ?token=alice    │                  │                       │
  │                                      │   ◀── persistent WS ──│
  │                                      │   /ws/notifications/2 │
  │                                      │   ?token=bob          │
  │                                      │ room "2" registered   │
  │                   │                  │                       │
  │ POST /game-invites│                  │                       │
  │ {to_user_id:2,   ──── HTTP ────────▶│                       │
  │  type:game_invite,                   │                       │
  │  room_id:"invite-1-2-…"}             │                       │
  │                                      │ inject from_user_id   │
  │                                      │  /from_username       │
  │                                      │ persist Notification  │
  │                                      │ broadcast("2", raw)   │
  │                                      │ broadcast("2", env)   │
  │                                      │ ──── 2 frames ───────▶│ FriendsSidebar:
  │                                      │                       │  show invite popup
  │                                      │                       │ NotificationPanel:
  │                                      │                       │  bell badge +1
```

Both clients keep their persistent WS open the whole time. Sending the invite is just an HTTP POST — the server is the sole writer to Bob's WS room.

#### Pong tick (live game)

```
Player1 browser    nginx           game-service          Player2 browser
  │                   │                  │                       │
  │ {type:"input",   ─── frame ─────────▶│                       │
  │  direction:"up"}  │                  │ handle_player_input() │
  │                   │                  │                       │
  │                                      │ GameSession runs at 30Hz
  │                                      │ each tick:
  │                                      │   snapshot = {ball, paddles, score}
  │                                      │   _broadcast_state(game_id, snapshot)
  │                                      │   manager.broadcast(game_id, {type:"state", …})
  │ ◀────── frame ────────────────────── │
  │                                      │ ──── frame ──────────▶│
  │                                      │                       │
  │  (and any spectators in the room)    │                       │
```

### 21. How I test WS locally

- `tests/TranscendenceHealthCheck.sh` does an actual `curl -H "Upgrade: websocket"` against each endpoint and asserts `101`. It's a real handshake test, not a mock.
- `make logs` tails uvicorn — I see `[CONNECTION] Player N connected to room ...` and `[DISCONNECT]` lines from `ws_logger`.
- Browser DevTools → Network → WS tab shows the open sockets with their frames in real time. Easiest way to spot a missing event.
- `WS_LOG_DEBUG=true make re-back` enables the per-event WS logger (`shared/logging/ws_logger.py`) — verbose, only useful when chasing a specific bug.

### 22. Open questions / things I still want to learn

- How would I add a Redis pub/sub layer to `ConnectionManager` without rewriting every consumer? Probably wrap `broadcast()` to also publish, and add a subscribe loop that calls the local `broadcast()` for incoming pub messages. But naively that double-broadcasts to local sockets. Need to mark origin somehow.
- The 30Hz game broadcast sends a full state snapshot each tick. Could be diff-based to save bandwidth. Probably not worth it for 2 players + N spectators.
- Should I add a heartbeat ping at the application layer? Browsers + uvicorn handle the protocol-level pings, but if a NAT silently drops a connection, we won't notice until the next send fails. The 10s timeout in the event-driven handlers is one defence; an explicit "every 30s if-idle ping" would be tighter.
- What happens to `_disconnect_timers` if the uvicorn process restarts mid-grace-window? Answer: they evaporate, the session is gone, the surviving player gets a 1006 close, and the next reconnect attempt hits a non-existent room and gets `4004`. Not great. A persistent state store would help — but that's basically saying "use Redis".

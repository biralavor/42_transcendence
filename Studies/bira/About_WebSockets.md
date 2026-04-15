# How WebSocket Works — Using Our Code

## 📋 Update (2026-04-12): Event-Driven Notification Architecture

**Major architectural change deployed**: Listen-only WebSocket handlers (`/ws/notifications`, `/ws/presence`) now use **event-driven delivery** instead of polling-based handlers.

### What Changed

**Notification Handlers** (user-service, chat-service):
- **Before**: `await asyncio.sleep(1)` → polling loop (wasteful)
- **After**: `await asyncio.Event().wait()` → event-driven (instant)
- **Benefit**: 1000ms latency → < 50ms (20-50x improvement)

**Example: Game Invite**
- Alice sends invite, handler receives it, broadcasts to Bob
- Bob's handler **wakes instantly** via `event.set()` signal
- GameInviteModal appears **immediately** (< 50ms)
- Before: Modal appeared after ~1s (polling delay)

### New Components

1. **EventRegistry** (`service/ws/event_registry.py` in each service)
   - Manages per-user events
   - `get_or_create_event(user_id)` — get or create async.Event for user
   - `signal_event(user_id)` — wake all handlers for user
   - `clear_event(user_id)` — reset for next notification
   - `cleanup_event(user_id)` — remove on last disconnect

2. **Event Signaling in broadcast()**
   - After sending JSON to clients, call `event_registry.signal_event(room_id)`
   - This wakes the handler that was waiting on `event.wait()`
   - Handler processes next notification, loops back

### Handler Pattern

Listen-only handlers now follow this pattern:

```python
@router.websocket("/ws/notifications/{user_id}")
async def notification_handler(websocket: WebSocket, user_id: str) -> None:
    await manager.connect(str(user_id), websocket)
    try:
        while True:
            event = await notification_event_registry.get_or_create_event(str(user_id))
            
            try:
                await asyncio.wait_for(event.wait(), timeout=10.0)
            except asyncio.TimeoutError:
                continue
            
            await notification_event_registry.clear_event(str(user_id))
            
    except asyncio.CancelledError:
        await notification_event_registry.cleanup_event(str(user_id))
        raise
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(str(user_id), websocket)
```

**Key points:**
- `event.wait()` alone is non-cancellable → `asyncio.wait_for()` with timeout makes it safe
- TimeoutError is expected and OK → handler just loops
- 10-second timeout ensures graceful disconnect detection
- Cleanup on CancelledError prevents memory leaks

### For Team Members

- **Measuring latency**: Expect ~5-50ms for notifications (was ~1000ms)
- **Testing**: Game invites now appear instantly (manual test)
- **Debugging**: If notifications delayed, check if handler uses new event-driven pattern

**See**: [EVENT_DRIVEN_NOTIFICATIONS.md](docs/EVENT_DRIVEN_NOTIFICATIONS.md) in docs/ for full architecture guide.

---

## WebSocket Channel Inventory

| nginx URL | Service | FastAPI route | Manager | Auth pattern | Direction | Purpose |
|-----------|---------|---------------|---------|--------------|-----------|---------|
| `/api/users/ws/presence` | user-service | `/ws/presence` | `PresenceManager` (per-user) | `get_me(token)` | server→client | Friend online/offline events |
| `/api/users/ws/notifications/{id}` | user-service | `/ws/notifications/{user_id}` | `ConnectionManager` (room=str(id)) | `get_me(token)` + ownership | server→client | Friend & game notifications (listen-only owner channel; server delivers via `POST /game-invites`) |
| `/api/chat/ws/chat/{room}` | chat-service | `/ws/chat/{room_slug}` | `ConnectionManager` (room=slug) | `credential_id` → DB | bidirectional | Real-time chat messages |
| `/api/chat/ws/notifications` | chat-service | `/ws/notifications` | `ConnectionManager` (room=str(uid)) | `credential_id` → DB | server→client | DM unread pushes with sender name (`from_username`) |
| `/api/game/ws/game/{id}` | game-service | `/ws/game/{game_id}` | `ConnectionManager` (room=game_id) | `credential_id` → DB | bidirectional | Pong game state + inputs |

**Auth patterns:**
- `get_me(token)` — user-service only; decodes JWT `sub` claim and queries by username. Source of truth.
- `credential_id → DB` — game/chat-service hybrid; decodes JWT locally, extracts `credential_id`, queries `SELECT id FROM users WHERE credential_id = ?`. ~5ms fast path, no network call.

---

## 1. The Handshake (nginx)

Every WS connection enters through `services/nginx/nginx.conf.template`. Without these three lines, the upgrade dies at the proxy:

```nginx
proxy_http_version     1.1;          -- HTTP/1.0 can't upgrade — this was our bug
proxy_set_header       Upgrade $http_upgrade;
proxy_set_header       Connection "upgrade";
```

nginx forwards the `101 Switching Protocols` response back to the browser, and from that point the TCP connection is **owned by the WS protocol** — nginx just passes raw frames through.

---

## 2. Server Accepts the Connection (router.py)

After nginx passes the upgrade, FastAPI/Starlette handles it:

```python
# src/backend/chat-service/ws/router.py
@router.websocket("/ws/chat/{room_id}")
async def chat_websocket(websocket: WebSocket, room_id: str) -> None:
    await manager.connect(room_id, websocket)   # ← sends the 101, registers the socket
    try:
        while True:                              # ← holds the connection open forever
            data = await websocket.receive_json()
            await manager.broadcast(room_id, data)
    except WebSocketDisconnect:                  # ← client closed tab / lost network
        manager.disconnect(room_id, websocket)
```

The `while True` is not a bug — it *is* WebSocket. The coroutine parks itself waiting for the next frame. When a frame arrives, it broadcasts and parks again. When the client disconnects, Starlette raises `WebSocketDisconnect` to break out cleanly.

---

## 3. Connection State Lives in Memory (manager.py)

This is the most important architectural piece:

```python
# src/backend/shared/ws/manager.py
class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: Dict[str, Set[WebSocket]] = {}   # room_id → all sockets in that room

    async def connect(self, room_id: str, websocket: "WebSocket") -> None:
        await websocket.accept()
        self._rooms.setdefault(room_id, set()).add(websocket)

    def disconnect(self, room_id: str, websocket: "WebSocket") -> None:
        room = self._rooms.get(room_id, set())
        room.discard(websocket)
        if not room:
            self._rooms.pop(room_id, None)   # ← prune empty rooms or memory leaks forever

    async def broadcast(self, room_id: str, message: dict) -> None:
        for ws in list(self._rooms.get(room_id, set())):   # ← snapshot before iterating
            try:
                await ws.send_json(message)
            except Exception:
                pass                           # ← one dead socket can't kill the broadcast
```

`_rooms` is a plain Python dict that lives **in the uvicorn process**. This is why horizontal scaling is hard — if player A connects to pod 1 and player B connects to pod 2, `broadcast()` on pod 1 can't reach pod 2's sockets. You'd need Redis pub/sub as a broker. For our project (single container), this is fine.

The `list()` snapshot on broadcast matters: if a socket dies mid-loop, the set would change size during iteration — a runtime error. The snapshot prevents that.

---

## 4. Per-User Presence Tracking (presence.py)

`ConnectionManager` groups sockets by **room** — the key is a string like `"DM-1-2"`. That model doesn't work for presence: we need to know whether a specific **user** is online, not which room they're in.

`PresenceManager` in `src/backend/shared/ws/presence.py` uses `user_id` (int) as the key instead:

```python
class PresenceManager:
    def __init__(self) -> None:
        self._users: Dict[int, Set[WebSocket]] = {}   # user_id → all sockets for that user

    async def connect(self, user_id: int, ws: WebSocket) -> None:
        await ws.accept()
        self._users.setdefault(user_id, set()).add(ws)

    def disconnect(self, user_id: int, ws: WebSocket) -> None:
        sockets = self._users.get(user_id, set())
        sockets.discard(ws)
        if not sockets:
            self._users.pop(user_id, None)   # ← prune empty sets — same memory-leak guard

    def is_online(self, user_id: int) -> bool:
        return bool(self._users.get(user_id))

    async def broadcast_to(self, user_id: int, message: dict) -> None:
        for ws in list(self._users.get(user_id, set())):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(user_id, ws)   # ← evict dead socket inline
```

A module-level singleton `presence_manager = PresenceManager()` is the shared instance — the same pattern `ConnectionManager` uses in chat/game services.

---

## 5. Presence Endpoint — Auth via Query Param (presence_router.py)

The `/ws/presence` endpoint in `src/backend/user-service/ws/presence_router.py` has one key difference from all other endpoints: **authentication via query param**, not the `Authorization` header.

**Why?** The browser's native `WebSocket` constructor does not support custom headers. Every WS connection must authenticate a different way. The solution is `?token=<jwt>`:

```python
@router.websocket("/ws/presence")
async def presence_endpoint(websocket: WebSocket, session: SessionDep, token: str = ""):
    if not token:
        await websocket.close(code=4001)   # ← 4001 = custom app-level: Unauthorized
        return
    try:
        me = await get_me(token, session)
    except Exception as exc:
        logger.warning("WS /presence auth failed: %s", exc)
        await websocket.close(code=4001)
        return

    user_id = me.id
    await presence_manager.connect(user_id, websocket)

    friends = await get_friends(user_id, session)
    for friend in friends:
        if presence_manager.is_online(friend.id):
            await presence_manager.broadcast_to(
                friend.id,
                {"type": "presence", "user_id": user_id, "status": "online"},
            )

    await set_user_status(user_id, "online", session)

    try:
        while True:
            await websocket.receive_text()   # ← keep-alive; payload is ignored
    except WebSocketDisconnect:
        pass

    presence_manager.disconnect(user_id, websocket)
    friends = await get_friends(user_id, session)
    for friend in friends:
        if presence_manager.is_online(friend.id):
            await presence_manager.broadcast_to(
                friend.id,
                {"type": "presence", "user_id": user_id, "status": "offline"},
            )
    await set_user_status(user_id, "offline", session)
```

WS close codes 4000–4999 are application-defined. We use:
- `4001` — authentication failed (missing or invalid token, or user not found in DB — `get_me` raises `HTTPException(401)` for all of these)

The event shape is always: `{"type": "presence", "user_id": 42, "status": "online"|"offline"}`

`set_user_status` updates `users.status` in Postgres so REST endpoints (`/profile/:id`, `/friends/:id`) also return accurate online state.

---

## 6. Notification Channel — Listen-Only + Ownership Enforced (notification_router.py)

`/ws/notifications/{user_id}` in `src/backend/user-service/ws/notification_router.py` is the official per-user channel for all real-time notification delivery. After the security hardening in issue #261, the channel is **listen-only and ownership-enforced** — only the authenticated owner may connect, and all client frames are silently discarded.

### Architecture

```
Server                                    Bob (owner, persistent listener)
  |                                              |
  |── persistent WS /ws/notifications/42 ──────>|
  |   owner only; 4003 if id mismatch            |
  |                                              |
Alice POSTs to HTTP /game-invites ─────────>  Server
  {type:"game_invite", to_user_id:42, ...}        |
                                                  | creates notification row in DB
                                                  | notification_manager.broadcast("42", raw_payload)
                                                  | notification_manager.broadcast("42", notif_envelope)
                                                  |──── WS frame (raw) ──────────────────>|
                                                  |──── WS frame (envelope) ─────────────>|
                                                                                           | onMessage() fires twice
                                                                                           | FriendsSidebar: handles raw game_invite
                                                                                           | Notification bell (#284): handles notification envelope
```

Server is the **sole delivery mechanism**. No client can inject messages into another user's channel.

### Authentication and authorization

```python
# src/backend/user-service/ws/notification_router.py
@router.websocket("/ws/notifications/{user_id}")
async def notification_endpoint(websocket, user_id, session, token=""):
    if not token:
        await websocket.close(code=4001)   # missing token
        return
    try:
        me = await get_me(token, session)  # user-service auth: validates JWT via sub claim
    except Exception:
        await websocket.close(code=4001)   # invalid token or user not found
        return
    if me.id != user_id:
        await websocket.close(code=4003)   # ownership: caller must own the channel
        return

    room = str(user_id)
    await notification_manager.connect(room, websocket)
    try:
        while True:
            await websocket.receive()      # blocks until disconnect; all frames discarded
    except WebSocketDisconnect:
        pass
    finally:
        notification_manager.disconnect(room, websocket)
```

**Close codes:**
- `4001` — authentication failed (missing/invalid token, or user not found)
- `4003` — forbidden (token is valid but caller is not the channel owner)

**Auth follows the user-service pattern:** `get_me(token, session)` decodes the JWT `sub` claim and queries by username. This is the source-of-truth path. Game/chat-service use `credential_id → DB` hybrid instead (see `Authentication-Pattern-Comparison.md`).

### Server-side delivery — `POST /game-invites`

Clients never write to the WS channel. Instead, they call the HTTP endpoint:

```
POST /api/users/game-invites
Authorization: Bearer <token>
{type, to_user_id, room_id, [status], [expires_at], ...}
```

The server:
1. Injects `from_user_id` and `from_username` from the JWT (prevents impersonation)
2. Persists a `Notification` row in the DB (type mapped per event, message localised)
3. Broadcasts the **raw game payload** to the target's WS room (for FriendsSidebar invite UI)
4. Broadcasts the **notification envelope** to the same room (for the notification bell #284)

```python
# main.py — deliver_game_notification
payload = {**body.model_dump(...), "from_user_id": current_user.id, ...}
notif = await _notifications.create_notification(session, body.to_user_id, body.type, message)
await notification_manager.broadcast(str(body.to_user_id), payload)           # raw — invite popup
await notification_manager.broadcast(str(body.to_user_id), _notif_payload(notif))  # envelope — bell
```

### Notification envelope format

All server-pushed notifications (friend events + game events) share this WS frame shape:

```json
{"type": "notification", "notification": {"id": 1, "type": "friend_request", "message": "Alice sent you a friend request", "read": false}}
```

### Notification types and messages

| `notification.type` | Trigger endpoint | Message template |
|---|---|---|
| `friend_request` | `POST /friends/{id}/request/{addr}` | `"{sender} sent you a friend request"` |
| `friend_request_accepted` | `PUT /friends/{id}/requests/{req}` (accept) | `"{acceptor} accepted your friend request"` |
| `game_invite` | `POST /game-invites` (type=game_invite) | `"{sender} invited you to play Pong"` |
| `game_invite_response` | `POST /game-invites` (type=game_invite_response) | `"{sender} accepted/declined your game invite"` |
| `game_invite_timeout` | `POST /game-invites` (type=game_invite_timeout) | `"Your game invite with {sender} has expired"` |

### Two broadcasts per game event

For game events, the recipient's WS channel receives **two frames** per POST:

| Frame | `type` field | Consumer |
|---|---|---|
| Raw game payload | `"game_invite"` / `"game_invite_response"` / `"game_invite_timeout"` | `FriendsSidebar.jsx` invite popup |
| Notification envelope | `"notification"` | Notification bell (#284) |

The notification bell handler must filter to `type === "notification"` only — ignoring the raw game frames.

### nginx routing

No dedicated location block needed. The existing `/api/users/` block already handles WS upgrade:

```nginx
location /api/users/ {
    proxy_pass         http://user-service/;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection $connection_upgrade;
}
```

### Frontend (gameInviteChannel.js)

`src/frontend/src/utils/gameInviteChannel.js` is the abstraction for game invite signaling.

`createGameChannelClient(userId, token, handlers)` opens a **persistent listen-only WS** to `/api/users/ws/notifications/{userId}` — used by `FriendsSidebar.jsx` to receive incoming game events.

`sendGameChannelMessage(_channelId, payload, token)` now calls **`fetch POST /api/users/game-invites`** — the `_channelId` parameter is kept for call-site compatibility but unused. The server injects `from_user_id`/`from_username` from the JWT.

```js
// gameInviteChannel.js — sendGameChannelMessage (post security fix)
export async function sendGameChannelMessage(_channelId, payload, token, options = {}) {
  const resp = await fetch('/api/users/game-invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  if (!resp.ok)
    throw new Error('Unable to send the game invite event.')
}
```

**History:** Prior to #261, this function opened a transient WS to the target's channel and wrote the payload directly. That was the relay pattern — replaced by the HTTP endpoint for security (server now controls identity injection and DB persistence).

---

## 7. Chat Notification Channel (chat-service ws/router.py)

Chat-service has its own per-user notification channel at `/ws/notifications` (no `user_id` in the path):

```python
# src/backend/chat-service/ws/router.py
notifications_manager = ConnectionManager()   # separate instance from chat manager

@router.websocket("/ws/notifications")
async def notifications_websocket(websocket, token=""):
    credential_id = _uid_from_token(token)        # hybrid: decode locally
    # ... resolve credential_id → user.id via DB
    await notifications_manager.connect(str(uid), websocket)
    # server-push only: client messages are discarded
```

**Auth follows the chat-service hybrid pattern:** `credential_id` is extracted from the JWT locally (no network call), then resolved to `user.id` via `SELECT id FROM users WHERE credential_id = :cid`.

**Push-only:** unlike the user-service notification channel, clients cannot write to this socket — received messages are discarded. Only the server pushes events (DM notifications from `chat_websocket`).

**Event shape:** `{"type": "new_dm", "from_user_id": int, "from_username": str, "room_slug": str, "preview": str}`

`from_username` was added (commit `b976f7f`) so the frontend can show sender name in the notification bell without a separate REST lookup.

Frontend (`unreadContext.jsx`) connects at `/api/chat/ws/notifications?token=<jwt>` and updates two pieces of state on each `new_dm` event:
- `unreadCounts: { [slug]: number }` — per-room unread badge count; incremented unless the user is already viewing that room (`activeRoomRef`)
- `dmSenders: { [slug]: string }` — latest sender username per room; set from `from_username`; cleared alongside `unreadCounts` when `clearUnread(slug)` is called

Both are exposed from `useUnread()` and consumed by `notificationContext.jsx` to build DM pseudo-notifications with sender context.

---

## 8. Browser Side (wsClient.js)


The browser's native `WebSocket` is fire-and-forget — it doesn't reconnect. Our wrapper adds that:

```js
// src/frontend/src/utils/wsClient.js
export function createWsClient(url, { onMessage, onOpen, onClose } = {}) {
  let ws;
  let retryDelay = 1000;
  let intentionallyClosed = false;

  function connect() {
    ws = new WebSocket(url);

    ws.onopen = () => {
      retryDelay = 1000;    // ← reset backoff on successful connect
      onOpen?.();
    };

    ws.onclose = () => {
      onClose?.();
      if (!intentionallyClosed) {
        setTimeout(connect, retryDelay);               // ← schedule reconnect
        retryDelay = Math.min(retryDelay * 2, 30_000); // ← exponential backoff, cap 30s
      }
    };
  }

  connect();
  return {
    send(data) {
      if (ws.readyState === WebSocket.OPEN)   // ← guard: drop silently if reconnecting
        ws.send(JSON.stringify(data));
    },
    close() {
      intentionallyClosed = true;   // ← tells onclose NOT to reconnect
      ws.close();
    },
  };
}
```

The `intentionallyClosed` flag is the key distinction between "user closed the tab" (don't reconnect) and "network hiccup" (do reconnect). Without it, `client.close()` would trigger a reconnect loop immediately.

---

## 9. Frontend Presence Session (presenceContext.jsx)

`createWsClient` in `wsClient.js` is designed for **room-scoped** connections (chat, game) and reconnects automatically. Presence is different: it is a **session-level** singleton that lives for the entire authenticated session, and it doesn't need a room — it just needs to know the user's JWT.

`PresenceProvider` in `src/frontend/src/context/presenceContext.jsx` owns that single connection:

```jsx
export function PresenceProvider({ children }) {
  const { auth } = useAuth()
  const [presenceMap, setPresenceMap] = useState({})

  useEffect(() => {
    if (!auth.access_token) return            // ← not logged in: no connection
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${scheme}//${window.location.host}/api/users/ws/presence?token=${auth.access_token}`
    const ws = new WebSocket(url)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'presence') {
          setPresenceMap(prev => ({ ...prev, [data.user_id]: data.status }))
        }
      } catch { /* ignore non-JSON frames */ }
    }

    ws.onclose = () => { setPresenceMap({}) }   // ← clear stale map on disconnect

    return () => { ws.close() }                 // ← React cleanup on logout / token change
  }, [auth.access_token])

  return (
    <PresenceContext.Provider value={presenceMap}>
      {children}
    </PresenceContext.Provider>
  )
}
```

`presenceMap` is a plain object keyed by `user_id` (number → `"online"|"offline"`). The `onclose` handler clears it so that when the WS drops (e.g., network loss, logout), stale green dots disappear immediately.

`PresenceProvider` wraps `App` inside `AuthProvider` in `main.jsx`, so the map is available everywhere. Consumer components read it via `usePresence()`:

```jsx
// FriendsSidebar.jsx
const presenceMap = usePresence()
// ...
<span className={`friends-status-dot friends-status-${presenceMap[friend.id] ?? friend.status}`} />
```

The `??` fallback means: use the live WS map when available, fall back to the REST `status` field fetched at page load. This gives correct dots even before the WS connection is established (or if the user has presence disabled).

**Why not use `createWsClient` here?** `createWsClient` reconnects on close. That's correct for chat (you want to stay in the room). For presence, reconnecting with a stale token is wrong — when the user logs out, React tears down the component and calls `ws.close()`, which is intentional. A reconnect loop would attempt to re-authenticate with an invalid token and log auth failures.

---

## 10. Frontend Notification System (notificationContext + NotificationPanel)

Implemented in PR #288 (commits `7af9cd1` → `b976f7f`). The frontend notification system is built from three cooperating pieces.

### 10.1 NotificationContext — two-step WS auth

`src/frontend/src/context/notificationContext.jsx` cannot use a user_id from the JWT because the JWT `sub` claim is the **username**, not an integer id. It resolves the integer via a separate REST call first:

```
Step 1: fetch GET /api/users/auth/me  →  { id: 7, username: "alice" }
Step 2: open  WS  /api/users/ws/notifications/7?token=<jwt>
```

This two-step pattern matches how `Chat.jsx` resolves its user id, and mirrors what the backend expects: the `user_id` path parameter must equal the token owner's `me.id`.

```jsx
// notificationContext.jsx — simplified
useEffect(() => {
    if (!auth.access_token) {
        setUserId(null)
        setNotifications([])
        dmFirstSeenRef.current = {}
        return                              // logout: clear everything
    }
    apiCall('/api/users/auth/me')
        .then(r => r.json())
        .then(me => setUserId(me.id))
}, [auth.access_token])

useEffect(() => {
    if (!userId || !auth.access_token) return
    const url = `...${window.location.host}/api/users/ws/notifications/${userId}?token=${auth.access_token}`
    const ws = new WebSocket(url)
    ws.onmessage = (event) => {
        const frame = JSON.parse(event.data)
        if (frame.type !== 'notification') return   // ignore raw game frames
        const notif = frame.notification
        const suppressed = notif.type === 'game_invite' && inviteVisibleRef.current
        const entry = { ...notif, read: notif.read || suppressed }
        setNotifications(prev =>
            [entry, ...prev.filter(n => n.id !== notif.id)].slice(0, 20)
        )
    }
    return () => ws.close()
}, [userId, auth.access_token])
```

**Key design decisions:**

| Decision | Rationale |
|---|---|
| Filter `frame.type !== 'notification'` | The same WS channel delivers raw game frames (`game_invite`, etc.) for `FriendsSidebar`. The bell must only consume the `notification` envelope. |
| Suppression: insert as `read: true` | When `inviteVisibleRef.current` is true (FriendsSidebar is showing the invite), inserting as already-read means `totalUnreadCount` (derived from `filter(n => !n.read)`) naturally excludes it — no separate suppressed-ids tracking needed. |
| Cap at 20 with deduplication | `[entry, ...prev.filter(n => n.id !== notif.id)].slice(0, 20)` — new entry wins (updated server state), list never grows unbounded. |
| Logout clears `notifications` + `dmFirstSeenRef` | Token → null would close the WS but leave stale notifications from the previous user visible until the next page load. Explicit reset on token loss prevents that. |

### 10.2 DM pseudo-notifications

`NotificationContext` imports `{ unreadCounts, clearUnread, dmSenders }` from `useUnread()` and merges DM unread state into the notification list as **pseudo-notification objects**:

```jsx
const combinedNotifications = useMemo(() => {
    const dmNotifs = Object.entries(unreadCounts).map(([slug, count]) => {
        if (!dmFirstSeenRef.current[slug])
            dmFirstSeenRef.current[slug] = new Date().toISOString()  // stable timestamp
        const senderName = dmSenders[slug]
        const message = senderName
            ? `${count} unread message${count !== 1 ? 's' : ''} from ${senderName}`
            : `${count} unread message${count !== 1 ? 's' : ''}`
        return {
            id: `dm-${slug}`,          // synthetic id; prefix avoids collision with real notif ids
            type: 'unread_chat',
            message,
            read: false,
            created_at: dmFirstSeenRef.current[slug],   // set once, never updated → stable sort
            room_slug: slug,
            other_user_id: ...,
        }
    })
    return [...dmNotifs, ...notifications]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}, [notifications, unreadCounts, userId, dmSenders])
```

`dmFirstSeenRef` (a `useRef` map, not state) stores the first-seen timestamp per slug once and never updates it. Without this, `new Date().toISOString()` called on every memo recompute would change timestamps and cause sort-order flicker as the count increments.

When `markRead('dm-DM-1-7')` is called, it strips the `dm-` prefix and calls `clearUnread(slug)`, which removes the entry from both `unreadCounts` and `dmSenders` in `unreadContext`.

**`unreadCount` (exported) is system-only:** `notifications.filter(n => !n.read).length` — DM unreads are excluded to prevent double-counting. The Navbar adds them separately.

### 10.3 NotificationPanel component

`src/frontend/src/Components/NotificationPanel.jsx` renders the combined list:

- Calls `fetchNotifications()` on mount to hydrate from the REST endpoint
- Each `<li>` item has `tabIndex={0}` + `onKeyDown` (Enter/Space) for keyboard accessibility
- Clicking an unread system notification calls `markRead(id)` + updates DB via `PUT /api/users/notifications/{id}/read`
- Clicking a DM pseudo-notification (`id.startsWith('dm-')`) calls `markRead(id)` which routes to `clearUnread(slug)` (no HTTP call, DM unreads live in client state only)
- Clicking a DM notification also navigates to `/chat/{room_slug}` via `useNavigate`
- "Mark all as read" calls `markAllRead()` which PUTs `/read-all` and calls `clearUnread` for every slug in `unreadCounts`
- Empty state: "No notifications" when list is empty

### 10.4 Navbar bell integration

`src/frontend/src/Components/Navbar.jsx` shows a single bell badge:

```jsx
const { unreadCount } = useNotifications()   // system notifications only
const { unreadCounts } = useUnread()         // DM unread counts

const dmUnreadTotal = Object.values(unreadCounts).reduce((a, b) => a + b, 0)

// Bell badge = system + DM combined
{(unreadCount + dmUnreadTotal) > 0 && (
    <span data-testid="bell-badge">{unreadCount + dmUnreadTotal}</span>
)}
```

The Chat navbar link has **no separate DM badge** — the bell is the sole unread indicator. This was an explicit design decision (commit `1391548`, `a234a83`): a Chat-link badge duplicated the bell count and created confusion about which was authoritative.

---

## 11. Health Check Verifies the Full Path (TranscendenceHealthCheck.sh)

```bash
# tests/TranscendenceHealthCheck.sh
ws_handshake() {
    local url="$1"
    local code
    code=$(curl -sk -o /dev/null -w "%{http_code}" \
        --max-time 5 \
        -H "Upgrade: websocket" \
        -H "Connection: Upgrade" \
        -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
        -H "Sec-WebSocket-Version: 13" \
        "$url" 2>/dev/null)
    [[ "$code" == "101" ]]
}
```

curl simulates the browser handshake. `101` means nginx forwarded the upgrade, the service accepted it, and the TCP connection upgraded — the full stack works. curl then times out (it's not a real WS client), which is expected and harmless now that we removed the `|| echo "000"` that was concatenating `"000"` onto `"101"`.

---

## The Full Journey of One Message

### Chat message

```
Browser                nginx               chat-service
  |                      |                      |
  |-- WS frame --------->|                      |
  |   {"content":"hi"}   |-- proxy frame ------>|
  |                      |                      | receive_json()
  |                      |                      | manager.broadcast("room1", data)
  |                      |<-- frame (ws1) -------|
  |<-- frame (ws1) ------|                      |
  |                      |<-- frame (ws2) -------|  (other client in same room)
  (other browser) <------|                      |
```

The `room_id` in `/ws/chat/{room_id}` is the key that `ConnectionManager._rooms` uses to decide who gets the broadcast. Two players in `room1` both receive every message sent by either of them. A player in `room2` receives nothing — isolated by the dict key.

### DM notification (Alice sends a message, Bob is not in the chat room)

```
Alice's browser      nginx         chat-service           Bob's browser
  |                    |                 |                       |
  | WS /chat/DM-1-2 -->|-- upgrade ----->|                       |
  |                    |                 | manager.connect       |
  |                    |                 |  ("DM-1-2", alice_ws) |
  |                    |                 |                       |
  |                    |                 |<-- WS /notifications --|
  |                    |                 |   ?token=<bob_jwt>    |
  |                    |                 | credential_id → uid=2 |
  |                    |                 | notifications_manager |
  |                    |                 |  .connect("2", bob_ws)|
  |                    |                 |                       |
  | send {"content":   |                 |                       |
  |  "Hey!", "sender": |                 |                       |
  |  "alice"} -------->|-- frame ------->|                       |
  |                    |                 | save_message()        |
  |                    |                 | manager.broadcast     |
  |                    |                 |  ("DM-1-2", msg)  (Alice sees own message echoed)
  |                    |                 | notifications_manager |
  |                    |                 |  .broadcast("2", {    |
  |                    |                 |    type:"new_dm",     |
  |                    |                 |    from_user_id:1,    |
  |                    |                 |    from_username:     |
  |                    |                 |     "alice",          |
  |                    |                 |    room_slug:         |
  |                    |                 |     "DM-1-2",         |
  |                    |                 |    preview:"Hey!"})   |
  |                    |                 |-- WS frame ---------->|
  |                    |                 |                       | unreadContext.onmessage()
  |                    |                 |                       | unreadCounts["DM-1-2"]++
  |                    |                 |                       | dmSenders["DM-1-2"]="alice"
  |                    |                 |                       |
  |                    |                 |                       | notificationContext useMemo
  |                    |                 |                       | builds pseudo-notif:
  |                    |                 |                       | { type:"unread_chat",
  |                    |                 |                       |   message:"1 unread message
  |                    |                 |                       |            from alice",
  |                    |                 |                       |   read:false }
  |                    |                 |                       |
  |                    |                 |                       | Navbar bell badge = 0+1 = 1
```

Bob's `unreadContext` and `notificationContext` both connect over **two separate WS channels** that happen to be in different services. The notification bell count is the sum of `unreadCount` (system, from user-service) + `dmUnreadTotal` (DMs, from chat-service).

---

### Game invite (Alice invites Bob)

```
Alice's browser         nginx           user-service            Bob's browser
  |                       |                   |                       |
  | -- persistent WS ---->|-- upgrade ------->|                       |
  |  /ws/notifications/1  |                   | room "1" registered   |
  |   ?token=<alice_jwt>  |                   |                       |
  |                       |                   |                       |
  |                                           |  <- persistent WS ---|
  |                                           |  /ws/notifications/2  |
  |                                           |  ?token=<bob_jwt>    |
  |                                           | room "2" registered   |
  |                       |                   |                       |
  | transient WS open --->|-- upgrade ------->|                       |
  |  /ws/notifications/2  |                   |                       |
  |   ?token=<alice_jwt>  |                   | get_me(alice_jwt) ✓  |
  |                       |                   | connect to room "2"   |
  | send game_invite ----->|-- frame -------->|                       |
  |  {type:"game_invite", |                   | broadcast(room "2",   |
  |   room_id:"invite-…"} |                   |   payload)            |
  |                       |                   |-- WS frame ---------->|
  |                       |                   |                       | onMessage()
  |                       |                   |                       | show toast
  | transient WS close ---|                   |                       |
  |                       |                   |                       |
  |                       |         Bob accepts:                      |
  |                       |           transient WS to room "1"        |
  |                       |           send game_invite_response        |
  |                       |           broadcast(room "1", response)   |
  |<-- WS frame ----------|-----------|                               |
  | onMessage()           |           |                               |
  | navigate to           |           |                               |
  | waiting room          |                                           |
```

---

### Presence event (user comes online)

```
Alice's browser        nginx            user-service           Bob's browser
  |                      |                    |                      |
  |-- GET /ws/presence   |                    |                      |
  |   ?token=<jwt> ----->|-- upgrade -------->|                      |
  |                      |                    | get_me(token)        |
  |                      |                    | presence_manager     |
  |                      |                    |  .connect(alice_id)  |
  |                      |                    | get_friends(alice)   |
  |                      |                    |  → [bob, ...]        |
  |                      |                    | is_online(bob) → ✓  |
  |                      |                    | broadcast_to(bob,    |
  |                      |                    |  {type:"presence",   |
  |                      |                    |   user_id: alice_id, |
  |                      |                    |   status:"online"})  |
  |                      |<-- WS frame --------|                      |
  |                      |                    |-- WS frame --------->|
  |                      |                    |                      | onmessage()
  |                      |                    |                      | presenceMap[alice_id]
  |                      |                    |                      |  = "online"
  |                      |                    |                      | dot → green
```

`broadcast_to(bob_id, ...)` looks up `_users[bob_id]` in the in-process dict and pushes the frame directly to Bob's socket — no DB round-trip, no HTTP call. The map update on Bob's browser is synchronous with `onmessage`, so the dot turns green within one RTT of Alice's WS handshake completing.

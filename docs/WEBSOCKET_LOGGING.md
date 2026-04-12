# WebSocket Logging Utilities

Shared logging utilities for tracking WebSocket payloads and measuring latency across the 42 Transcendence game waiting room flow.

## 📁 Files

- **Frontend**: `src/frontend/src/utils/wsLogger.js`
- **Backend**: `src/backend/shared/logging/ws_logger.py`
- **Frontend Example**: `src/frontend/src/pages/GameWaitingRoom.LOGGER_EXAMPLE.jsx`
- **Backend Example**: `src/backend/game-service/ws/ROUTER_LOGGER_EXAMPLE.py`

## 🎯 Purpose

Track the complete flow of a game invitation acceptance through WebSocket:

```
1. Player clicks "Ready" button
   ↓
2. Frontend sends { type: "player_ready" } via WebSocket
   ↓
3. Backend receives message and broadcasts state
   ↓
4. Frontend receives updated state and updates UI
   ↓
5. Both players show as ready
```

With this logger, you can measure latency at each step:
- Ready click → Send (browser processing)
- Send → Receive (network latency)
- Receive → Broadcast (server processing)
- Broadcast → UI Update (browser rendering)
- **Total**: Click → Both players ready

---

## 🚀 Frontend Usage (JavaScript)

### Import

```javascript
import wsLogger from '../utils/wsLogger'
```

### Logging Methods

#### 1. Ready Button Click
```javascript
const handleReady = () => {
  const flowStart = wsLogger.flowStart(roomId, 'ready_click')
  const payload = { type: 'player_ready' }
  
  wsLogger.ready(roomId, payload)
  ws.send(payload)
  wsLogger.send(roomId, payload)
  
  wsLogger.latency('ready_to_send', flowStart)
}
```

**Output**:
```
[14:23:45.123Z] [INFO] [GameWaitingRoom] 🔘 Ready button clicked
{roomId: "game-inv-1-2-1234", payload: {type: "player_ready"}, ts: 1234.56}

[14:23:45.124Z] [INFO] [WS Send] ↗️  Payload sent
{roomId: "game-inv-1-2-1234", payload: {type: "player_ready"}}

[14:23:45.124Z] [INFO] [Latency] ⏱️  ready_to_send
{latencyMs: "0.87ms"}
```

#### 2. Receive Message
```javascript
onMessage: (data) => {
  wsLogger.receive(roomId, data)
  
  if (data.type === 'player_ready') {
    setCurrentReady(true)
    wsLogger.uiUpdate(roomId, { currentReady: true })
  }
}
```

**Output**:
```
[14:23:45.234Z] [INFO] [WS Receive] ↙️  Payload received
{roomId: "game-inv-1-2-1234", payload: {type: "player_ready", player_id: 2}}

[14:23:45.235Z] [INFO] [UI Update] 🎨 State updated
{roomId: "game-inv-1-2-1234", updateData: {currentReady: true}}
```

#### 3. Connection Events
```javascript
onOpen: () => {
  wsLogger.connection(roomId, 'open', {
    player1_id: 1,
    player2_id: 2
  })
},

onClose: () => {
  wsLogger.connection(roomId, 'close')
}
```

#### 4. Calculate Latency Between Two Points
```javascript
const startTime = wsLogger.getTimestamp()
// ... do something ...
const latencyMs = wsLogger.latency('my_operation_name', startTime)
console.log(`Operation took ${latencyMs}ms`)
```

#### 5. Export All Logs (for debugging)
```javascript
// In browser console:
wsLogger.export()
// Returns:
{
  exportedAt: "2026-04-12T14:23:45.123Z",
  eventCount: 42,
  events: [
    {type: "ready_click", roomId: "...", payload: {...}, timestamp: 1234.56},
    {type: "send", roomId: "...", payload: {...}, timestamp: 1234.57},
    ...
  ]
}
```

#### 6. Get Summary
```javascript
wsLogger.summary()
// Returns:
{
  totalEvents: 42,
  byType: {
    ready_click: 1,
    send: 3,
    receive: 5,
    ui_update: 5,
    latency: 12,
    ...
  },
  timeSpan: "2345.67ms"
}
```

### Browser Console API

```javascript
// Create debug endpoint in window
window.wsDebug = () => {
  console.log('=== WebSocket Logger Debug ===')
  console.log('Events:', wsLogger.export())
  console.log('Summary:', wsLogger.summary())
}

// Now use:
wsDebug()  // View all logs
```

---

## 🚀 Backend Usage (Python)

### Import

```python
from shared.logging import ws_logger
```

### Logging Methods

#### 1. Player Ready
```python
@router.websocket("/ws/game/{game_id}")
async def game_websocket(websocket: WebSocket, game_id: str):
    await websocket.accept()
    player_id = extract_player_id(token)
    
    # Log connection
    ws_logger.connection(game_id, player_id, 'open', {
        'token_valid': token is not None
    })
    
    # Receive and log
    data = await websocket.receive_json()
    ws_logger.receive(game_id, player_id, data)
    
    if data.get("type") == "player_ready":
        ws_logger.ready(game_id, player_id, data)
```

**Output**:
```
[2026-04-12 14:23:45] [INFO] [WS Connection] 🔗 Player 1 open in game-inv-1-2-1234 ({'token_valid': True})
[2026-04-12 14:23:45] [DEBUG] [WS Receive] ↙️  Received from player 1 in game-inv-1-2-1234: {"type": "player_ready"}
[2026-04-12 14:23:45] [INFO] [WS Ready] 🔘 Player 1 ready in game-inv-1-2-1234: {"type": "player_ready"}
```

#### 2. Broadcast State
```python
state_snapshot = {
    'p1_ready': True,
    'p2_ready': True,
    'players': [
        {'id': 1, 'username': 'alice', 'ready': True},
        {'id': 2, 'username': 'bob', 'ready': True}
    ]
}

broadcast_ts = ws_logger.broadcast(
    game_id, 
    state_snapshot,
    client_count=2
)
await manager.broadcast(game_id, state_snapshot)
```

**Output**:
```
[2026-04-12 14:23:45] [INFO] [WS Broadcast] 📡 Broadcasted to 2 clients in game-inv-1-2-1234: {"p1_ready": true, "p2_ready": true, ...}
```

#### 3. Measure Latency
```python
start_time = ws_logger.flow_start(game_id, 'ready_to_broadcast')

# ... process message ...

latency_ms = ws_logger.latency('ready_to_broadcast', start_time)
# Output: [2026-04-12 14:23:45] [INFO] [WS Latency] ⏱️  ready_to_broadcast: 45.67ms
```

#### 4. Complete Flow
```python
flow_start = ws_logger.flow_start(game_id, 'handle_ready')

data = await websocket.receive_json()
ws_logger.receive(game_id, player_id, data)

# ... process ...

await manager.broadcast(game_id, state)
ws_logger.broadcast(game_id, state, len(connections))

total_latency = ws_logger.flow_end(game_id, 'handle_ready', flow_start)
# Output: [2026-04-12 14:23:45] [INFO] [WS Flow] ✅ Completed handle_ready in game-inv-1-2-1234: 112.45ms total
```

#### 5. Error Logging
```python
try:
    # ... WebSocket code ...
except Exception as e:
    ws_logger.error(game_id, player_id, "Failed to process ready", exc=e)
    # Output: [2026-04-12 14:23:45] [ERROR] [WS Error] ❌ Game game-inv-1-2-1234 Player 1: Failed to process ready
```

#### 6. Export Logs (for debugging)
```python
logs = ws_logger.export()
# Returns:
{
    'exported_at': '2026-04-12T14:23:45Z',
    'event_count': 18,
    'events': [
        {
            'type': 'ready_click',
            'room_id': 'game-inv-1-2-1234',
            'player_id': 1,
            'payload': {'type': 'player_ready'},
            'timestamp': 1712950425123.45,
            'iso_timestamp': '2026-04-12T14:23:45Z'
        },
        ...
    ]
}
```

#### 7. Get Summary
```python
summary = ws_logger.summary()
# Returns:
{
    'total_events': 18,
    'by_type': {
        'connection': 2,
        'receive': 5,
        'ready': 1,
        'broadcast': 3,
        'latency': 7
    },
    'time_span_ms': 345.67
}
```

---

## 📊 Example Flow: Ready → Both Players Ready

### Timeline

```
T+0.00ms   : Alice clicks Ready button
T+0.87ms   : Alice's payload sent to server
T+45.34ms  : Server receives Alice's message
T+45.45ms  : Server updates state (Alice ready)
T+45.67ms  : Server broadcasts state to both clients
T+100.12ms : Bob's browser receives updated state
T+100.15ms : Bob's UI shows Alice as ready
---
Total:     100.15ms from click to UI update
```

### Log Output

**Frontend (Alice)**:
```
[14:23:45.000Z] [INFO] [GameWaitingRoom] 🔘 Ready button clicked
[14:23:45.001Z] [INFO] [WS Send] ↗️  Payload sent
[14:23:45.001Z] [INFO] [Latency] ⏱️  ready_to_send: 0.87ms
[14:23:45.100Z] [INFO] [WS Receive] ↙️  Payload received (broadcast state)
[14:23:45.100Z] [INFO] [UI Update] 🎨 State updated: both ready
```

**Backend**:
```
[2026-04-12 14:23:45] [INFO] [WS Connection] 🔗 Player 1 (Alice) open
[2026-04-12 14:23:45] [DEBUG] [WS Receive] ↙️  Received from player 1: {"type": "player_ready"}
[2026-04-12 14:23:45] [INFO] [WS Ready] 🔘 Player 1 ready
[2026-04-12 14:23:45] [INFO] [WS Broadcast] 📡 Broadcasted to 2 clients
[2026-04-12 14:23:45] [INFO] [WS Latency] ⏱️  receive_to_broadcast: 0.22ms
```

---

## ⚙️ Configuration

### Enable/Disable Logging

**Frontend**:
```javascript
// In src/frontend/src/utils/wsLogger.js, line 6:
const WS_LOG_ENABLED = false  // Set to false to disable all logging
```

**Backend**:
```python
# In src/backend/shared/logging/ws_logger.py, line 15:
WS_LOG_ENABLED = False  # Set to False to disable all logging
```

### Adjust Memory Limit

**Frontend** (keep last N events):
```javascript
const wsLogger = new WebSocketLogger(maxEvents = 50)  // default 100
```

**Backend**:
```python
ws_logger = WebSocketLogger(max_events=50)  # default 100
```

---

## 🔍 Debugging Tips

### 1. View Real-Time Logs in Terminal

```bash
make logs | grep "\[WS"
```

### 2. View All Browser Logs

```javascript
wsLogger.export()  // Then copy to JSON viewer
```

### 3. Calculate Total Latency

```javascript
const summary = wsLogger.summary()
console.log(`Total time span: ${summary.timeSpan}ms`)
```

### 4. Find Slowest Operation

```javascript
const events = wsLogger.export().events
const latencies = events.filter(e => e.type === 'latency')
const slowest = latencies.reduce((max, e) => 
  e.latency_ms > max.latency_ms ? e : max
)
console.log(`Slowest: ${slowest.label} (${slowest.latency_ms}ms)`)
```

### 5. Export Logs for Analysis

```javascript
// Copy to clipboard and analyze
copy(JSON.stringify(wsLogger.export(), null, 2))
```

---

## 📈 Performance Expectations

Typical latencies for a local game waiting room:

| Operation | Expected | Max Acceptable |
|---|---|---|
| Ready click → Send | < 2ms | 5ms |
| Send → Receive (network) | < 50ms | 100ms |
| Receive → Broadcast | < 5ms | 10ms |
| Broadcast → UI Update | < 20ms | 50ms |
| **Total (click → ready)** | **< 80ms** | **200ms** |

If you see higher latencies:
1. Check network conditions
2. Monitor server load
3. Check browser performance (DevTools → Performance)
4. Profile websocket handlers

---

## 🐛 Common Issues

### Issue: Logs not appearing
- Check `WS_LOG_ENABLED` is true
- Check browser console (frontend) or server logs (backend)
- Verify logger is imported correctly

### Issue: High latency
- Check network tab in DevTools
- Look for slow broadcast operations
- Check server CPU usage
- Review database query performance

### Issue: Wrong timestamps
- Frontend: Uses `performance.now()` (milliseconds since page load)
- Backend: Uses `time.time() * 1000` (milliseconds since epoch)
- ISO timestamps always use UTC

---

## 📝 Notes

- Circular buffer (max 100 events by default) prevents memory leaks
- All timestamps include millisecond precision
- Logs are color-coded in browser console
- Backend logs go to stderr with timestamp
- No PII logged by default
- Safe to leave enabled in production (low overhead)

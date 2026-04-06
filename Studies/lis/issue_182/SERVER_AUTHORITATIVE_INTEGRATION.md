# Server-Authoritative Game Loop Implementation

## Overview

This document describes the implementation of the **server-authoritative game loop** and **latency filtering** for Pong multiplayer.

### Architecture

```
Frontend (React)                     Backend (FastAPI/Python)
├─ PongCanvasMultiplayer.jsx         ├─ game_session.py
├─ GamePage.jsx                      ├─ game_manager.py
└─ WebSocket Client                  └─ ws/router.py + WebSocket Server
         ↕️ (WebSocket Protocol)           ↕️
    /api/game/ws/game/{gameId}       game.GameManager (singleton)
                                     → GameSession (per game_id)
```

---

## Backend Implementation

### 1. GameSession (`game_session.py`)

The **GameSession** class is the server-side representation of a single Pong match. It:

- **Owns all game state** (ball position, paddle positions, score)
- **Runs physics calculations** (collision detection, ball movement)
- **Enforces game rules** (scoring, win condition)
- **Never trusts client input** — processes only paddle direction commands from clients

#### Key Methods

| Method | Purpose |
|--------|---------|
| `tick()` | Execute one game frame (called 30 times/sec) |
| `update_paddles()` | Move paddles based on stored input direction |
| `update_ball()` | Move ball by velocity |
| `check_collisions()` | Handle ball-wall and ball-paddle bounces |
| `check_scoring()` | Detect goals and update score |
| `get_state_snapshot()` | Return current state as dict for broadcasting |

#### Constants

```python
CANVAS_WIDTH = 1024
CANVAS_HEIGHT = 512
FPS = 30
TICK_INTERVAL = 1/30 ≈ 0.0333 seconds
WIN_SCORE = 10
PADDLE_SPEED = 5.0 px/tick
INITIAL_BALL_VX = 3.0 px/tick
```

---

### 2. GameManager (`game_manager.py`)

The **GameManager** is a singleton that:

- **Creates and destroys game sessions** per `game_id` (WebSocket room)
- **Runs the async game loop** at 30 FPS
- **Handles player input** with latency filtering
- **Broadcasts state** to both clients each tick

#### Key Methods

| Method | Purpose |
|--------|---------|
| `create_session()` | Initialize a new GameSession and start its loop |
| `delete_session()` | End a game and cancel its loop task |
| `handle_player_input()` | Process input with 300ms latency filter |
| `_run_game_loop()` | Main async loop: tick → broadcast → sleep → repeat |

#### Latency Filtering 

```python
server_now = int(time.time() * 1000)  # Current server time in ms
if client_ts is not None and (server_now - client_ts) > 300:
    return  # Discard stale input silently
```

**Why 300ms?** 
- Typical acceptable network latency is 50-200ms
- 300ms gives a safety margin while still filtering truly stale commands
- Prevents older commands from corrupting current game state

---

### 3. WebSocket Router (`ws/router.py`)

The **game_websocket** endpoint:

1. **Accepts** the WebSocket connection
2. **Receives messages** from connected clients
3. **Routes messages** to appropriate game manager methods
4. **Creates/updates** database match records

#### Protocol

**Client → Server:**
```json
{
  "type": "input",
  "direction": "up|down|stop",
  "client_ts": 1712150000000
}
```

**Server → Client:**
```json
{
  "type": "state",
  "ball": {"x": 512, "y": 256, "vx": 3, "vy": 1},
  "paddles": {"p1": 200, "p2": 250},
  "score": {"p1": 5, "p2": 3}
}
```

#### Message Flow

```
Client connects
  ↓
game_websocket accepts connection
  ↓
Client sends {"type": "game_start", "player1_id": 1, "player2_id": 2}
  ↓
Router calls game_manager.create_session() → starts 30 FPS loop
  ↓
Game loop broadcasts state to all connected clients 30 times/second
  ↓
Client sends {"type": "input", "direction": "up", "client_ts": ...}
  ↓
Router calls game_manager.handle_player_input()
  ↓
Latency filter checks timestamp
  ↓
If fresh: update session.p1_direction / session.p2_direction
If stale: silently discard
```

---

## Frontend Implementation

### 1. PongCanvasMultiplayer (`Components/PongCanvasMultiplayer.jsx`)

A React component that:

- **Connects** to `/api/game/ws/game/{gameId}` via WebSocket
- **Receives** server state each tick
- **Updates game state** in real-time
- **Sends inputs** with `client_ts` timestamp
- **Renders** the canvas based on server state

#### Key Props

| Prop | Type | Purpose |
|------|------|---------|
| `gameId` | string | WebSocket room ID |
| `player1Id` | number | Database ID of player 1 |
| `player2Id` | number | Database ID of player 2 |
| `onGameEnd` | function | Callback when game ends |

#### State Reception Loop

```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  
  if (message.type === 'state') {
    // Update game state from server
    gameStateRef.current.ball.position.x = message.ball.x
    gameStateRef.current.ball.position.y = message.ball.y
    gameStateRef.current.player1.position.y = message.paddles.p1
    gameStateRef.current.player2.position.y = message.paddles.p2
    gameStateRef.current.score.player1 = message.score.p1
    gameStateRef.current.score.player2 = message.score.p2
  }
}
```

#### Input Sending

```javascript
function sendInput(direction) {
  const clientTs = Date.now()  // Client-side timestamp in ms
  ws.send(JSON.stringify({
    type: 'input',
    direction: direction,
    client_ts: clientTs,
  }))
}
```

### 2. GamePage (`pages/GamePage.jsx`)

A page that:
- Is reached after GameWaitingRoom (both players ready)
- Renders the PongCanvasMultiplayer component
- Handles game end (navigation back to play page)

#### Route

```
/game/:roomId
```

---

## Testing Locally

### Backend Tests

```bash
# Test game session physics
cd /home/solismesmo/42_transcendence
python3 tests/test_game_session.py

# Test game manager with async loop
python3 tests/test_game_manager.py
```

Both tests should pass with ✅.

### Docker Testing

```bash
# Build and start all services
make

# Or just rebuild game-service
make up-game

# View logs
docker logs -f game-service

# Test with curl or WebSocket client
# Connect to: wss://localhost/api/game/ws/game/test-room-1
```

### Frontend Testing

1. Navigate to `/game/test-room-1` (with valid token)
2. Open browser DevTools → Console
3. Watch for WebSocket connection messages
4. Press W/S to send input commands
5. Server should broadcast state every ~33ms (30 FPS)

---

## Game Loop Timing

The server runs at **30 FPS** (frames per second):

```
1 second = 30 frames
1 frame = 1/30 sec ≈ 33.3 ms

Timeline:
T=0ms:    Tick 1 starts, processes input, updates ball/paddles, broadcasts state
T=33ms:   Tick 2 starts (client has had 33ms to react to previous state)
T=66ms:   Tick 3 starts
...
```

**Why 30 FPS?**
- Perceived smooth motion (vs local client-side which often runs 60+ FPS)
- Reduces network bandwidth (state broadcast 30 times/sec instead of 60)
- Accounts for network latency while maintaining playability
- Matches typical server tick rates for online games

---

## Collision Physics

### Ball-Wall Collision
When ball hits top/bottom wall, `vy` is inverted:
```python
if self.ball.y - BALL_RADIUS <= 0:
    self.ball.y = BALL_RADIUS
    self.ball.vy = abs(self.ball.vy)  # Bounce downward
```

### Ball-Paddle Collision

Determines angle based on **where** the ball hits the paddle:

```python
def _reflect_ball_off_paddle(self, paddle_y):
    # Hit position: 0.0 (top) to 1.0 (bottom)
    hit_position = (self.ball.y - paddle_y) / self.PADDLE_HEIGHT
    hit_position = max(0.0, min(1.0, hit_position))  # Clamp
    
    # Map to angle: -1.0 (up) to +1.0 (down)
    angle_factor = (hit_position - 0.5) * 2.0
    self.ball.vy = angle_factor * 2.5
```

### Scoring

Ball detected outside playing field → goal scored:
```python
if self.ball.x < 0:
    self.score.p2 += 1  # Player 2 scores
    self._reset_ball()  # Reset to center
```

---

## Known Limitations / Future Improvements

1. **No Client-Side Prediction**: Frontend renders exactly what server sends (may appear slightly laggy on high-ping connections). Future: implement client-side prediction + server correction.

2. **Simple Rendering**: Current PongCanvasMultiplayer does basic state updates. Could enhance with:
   - Interpolation between received states
   - Smooth paddle movement tweening
   - Ball trajectory prediction

3. **No Spectators**: Game state is only sent to connected players, not spectators.

4. **Simplified Latency Filter**: Fixed 300ms threshold. Could be:
   - Adaptive based on measured RTT
   - Configurable per match

---

## Troubleshooting

### WebSocket Connection Fails
- Check nginx routing: `/api/game/` should proxy to `game-service:8002`
- Verify game-service is running: `docker logs game-service`
- Check browser console for CORS or certificate errors

### Game Loop Not Ticking
- Check game_manager debug output
- Verify `create_session()` was called (need `game_start` message from client)
- Check for exceptions in `_run_game_loop()`

### Ball Doesn't Move
- Verify server is sending state broadcasts
- Check game_state_snapshot has correct ball.x, ball.y values
- Check client is receiving `type: "state"` messages

### Inputs Ignored
- Verify client is sending `client_ts` field
- Check timestamp is not > 300ms old
- Check player_id matches session.player1_id or session.player2_id

---

## References

- [PONG_GAME_MECHANICS.md](PONG_GAME_MECHANICS.md) — Game rules and physics reference
- [MICROSERVICES.md](MICROSERVICES.md) — Service layout and Docker structure
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture and routing

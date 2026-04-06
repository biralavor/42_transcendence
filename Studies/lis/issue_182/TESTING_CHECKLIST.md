# Server-Authoritative Game Loop - Testing Checklist

## Pre-Flight Checks

- [ ] WSL Debian has Python3, Docker, Docker Compose, Make installed
  ```bash
  python3 --version && docker --version && docker-compose --version && make --version
  ```

- [ ] All backend files compile without errors
  ```bash
  python3 -c "import sys; sys.path.insert(0, 'src/backend'); from game_service.game_session import GameSession; print('✓')"
  ```

- [ ] Unit tests pass
  ```bash
  python3 tests/test_game_session.py
  python3 tests/test_game_manager.py
  ```

---

## Docker Build & Startup

- [ ] Docker daemon is running in WSL
  ```bash
  sudo service docker start
  docker ps  # Should not show errors
  ```

- [ ] Build all services
  ```bash
  make up
  ```

- [ ] All containers are running
  ```bash
  docker ps
  # Should see: db, user-service, game-service, chat-service, frontend, nginx, adminer
  ```

- [ ] Wait for services to be healthy
  ```bash
  make wait
  ```

---

## Backend Testing (Docker)

### Game Service Logs
- [ ] Monitor game-service logs
  ```bash
  docker logs -f game-service
  # Should see: "Uvicorn running on 0.0.0.0:8002"
  ```

### Health Endpoint
- [ ] Test game-service health
  ```bash
  curl -k https://localhost/api/game/health
  # Expected: {"status": "ok", "service": "game-service"}
  ```

### WebSocket Endpoint (Optional)
- [ ] Test WebSocket connection with wscat or browser console
  ```javascript
  // In browser console:
  const ws = new WebSocket('wss://localhost/api/game/ws/game/test-1')
  ws.onopen = () => console.log('Connected!')
  ws.onmessage = (e) => console.log('Server:', e.data)
  ws.send(JSON.stringify({type: 'game_start', player1_id: 1, player2_id: 2}))
  ws.send(JSON.stringify({type: 'input', direction: 'up', client_ts: Date.now()}))
  ```

---

## Frontend Testing

### Navigation Flow
- [ ] Go to https://localhost and authenticate
- [ ] Navigate to Play / Multiplayer
- [ ] Invite a friend or create a match
- [ ] Both players reach GameWaitingRoom (/game/waiting/:roomId)
- [ ] Both players mark as "Ready"
- [ ] Both players are navigated to GamePage (/game/:roomId)

### Game Component
- [ ] PongCanvasMultiplayer component renders
- [ ] WebSocket status shows "connected"
- [ ] Canvas appears (black background with borders)

### State Reception
- [ ] Open browser DevTools → Console
- [ ] Filter for WebSocket messages:
  ```javascript
  // Watch for state messages
  ws.addEventListener('message', (e) => console.log(JSON.parse(e.data)))
  ```
- [ ] You should see state objects with:
  - `ball: {x, y, vx, vy}`
  - `paddles: {p1, p2}`
  - `score: {p1, p2}`
- [ ] State updates arrive approximately every 33ms (30 FPS)

### Input Handling
- [ ] Press `W` key (up): Check Console → should send input message
  ```json
  {"type": "input", "direction": "up", "client_ts": <timestamp>}
  ```
- [ ] Press `S` key (down): Check for input message with `direction: "down"`
- [ ] Release key: Check for input message with `direction: "stop"`

### Visual Feedback
- [ ] [ ] Ball is visible and moving on canvas
- [ ] Paddle 1 (left) moves when you press W/S
- [ ] Paddle 2 (right) moves when opponent presses their keys
- [ ] Ball bounces off walls and paddles
- [ ] Score updates when ball passes paddle

### Game End
- [ ] One player reaches 10 points
- [ ] Game ends and both players are navigated away
- [ ] Match result is saved in database

---

## Latency Filtering Test

### Testing 300ms Threshold

1. **In PongCanvasMultiplayer.jsx, temporarily modify:**
   ```javascript
   // Line ~97 in sendInput():
   const clientTs = Date.now() - 500  // 500ms ago (exceeds 300ms)
   ```

2. **Expected behavior:**
   - Press W: Paddle should NOT move
   - Server logs should show input being discarded
   - Change to `Date.now()` and verify paddle moves again

3. **Verify in server logs:**
   ```bash
   docker logs -f game-service
   # Should show: filtering/discarding old inputs
   ```

---

## Performance & Monitoring

### Game Loop Frequency
- [ ] Open DevTools → Network tab → WS connection
- [ ] Enable throttling to 3G
- [ ] Verify game loop still maintains ~30 FPS (state every ~33ms)
- [ ] Game should remain playable

### Memory Usage
- [ ] Monitor Docker stats:
  ```bash
  docker stats game-service
  # Check memory usage stays stable
  ```

### Concurrent Games
- [ ] Start multiple games simultaneously (in different browser windows)
- [ ] Each game should run independently
- [ ] No cross-game state contamination

---

## Error Scenarios

- [ ] **Network Disconnect:** 
  - Disconnect internet briefly
  - Expected: WebSocket reconnect or graceful error
  - Check status: "disconnected" / "error"

- [ ] **Player Disconnects:**
  - Close one browser during game
  - Expected: Game session cleaned up on server
  - Check: `docker logs game-service` for cleanup messages

- [ ] **Old/Late Inputs:**
  - Temporarily set `client_ts` to 5 seconds ago
  - Expected: Server discards input
  - Verify: Paddle doesn't respond

---

## Database Verification

### Using Adminer
- [ ] Go to http://localhost:8888
- [ ] Login: Postgres / (your DB credentials)
- [ ] Check `matches` table:
  - New match created when game started
  - Match marked as "finished" when game ended
  - winner_id, score_p1, score_p2 recorded correctly

---

## Final Sign-Off

- [ ] All unit tests pass
- [ ] Docker services start without errors
- [ ] Frontend connects to backend successfully
- [ ] Game loop runs at 30 FPS
- [ ] Ball physics looks correct
- [ ] Paddle collision detection works
- [ ] Scoring increments properly
- [ ] Latency filter discards old inputs
- [ ] Database records match results
- [ ] No console errors or warnings

---

## What to Do If Tests Fail

1. **Check game-service logs:**
   ```bash
   docker logs game-service
   ```

2. **Restart service:**
   ```bash
   make down-game && make up-game
   ```

3. **Check WebSocket connection:**
   ```javascript
   // Browser console:
   ws.readyState  // 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
   ```

4. **Look for Python exceptions:**
   - Check `docker logs game-service` for tracebacks
   - Check browser console for JS errors

5. **Verify ports:**
   ```bash
   netstat -tlnp | grep 8002  # game-service port
   docker port game-service
   ```

6. **Check nginx routing:**
   ```bash
   docker exec nginx cat /etc/nginx/conf.d/default.conf
   # Should show: location /api/game/ → http://game-service:8002
   ```

---

## References

- **Implementation Guide:** `docs/SERVER_AUTHORITATIVE_INTEGRATION.md`
- **Game Rules:** `docs/PONG_GAME_MECHANICS.md`
- **Architecture:** `docs/ARCHITECTURE.md`
- **Microservice Structure:** `docs/MICROSERVICES.md`

---

Good luck! 🎮

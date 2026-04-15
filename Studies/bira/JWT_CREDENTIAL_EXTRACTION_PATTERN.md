# JWT Credential Extraction Pattern - Developer Guide

**Context:** Real-time features requiring authenticated user ID in WebSocket messages

---

## Problem Statement

When building real-time features (chat, game, notifications), you need the authenticated user's ID to:
- Label WebSocket messages with source player
- Route responses to correct opponent
- Log activity with user attribution

The challenge: **Auth context may not contain user ID directly.**

---

## Why This Pattern Matters

### Common Mistakes

❌ **Mistake 1: Use navigation state**
```javascript
const userId = location.state?.currentUser?.id  // ← Breaks if state undefined
```
**Problem:** If user navigates directly without going through login flow, state is empty.

❌ **Mistake 2: Use auth context user field**
```javascript
const userId = auth?.user?.id  // Auth context has NO user field
```
**Problem:** Some auth implementations (like this one) only store tokens in context.

❌ **Mistake 3: Use hardcoded fallback**
```javascript
const userId = currentUser.id || 'local-player'  // ← Wrong in multiplayer!
```
**Problem:** All players get same ID, can't distinguish in real-time messages.

---

## Solution: Extract from JWT Token

JWT tokens (typically in `auth.access_token`) contain:
```json
{
  "sub": "username",
  "credential_id": 5,
  "exp": 1776043190,
  "iat": 1776040590
}
```

The `credential_id` is the **source of truth** for user ID.

---

## Implementation

### Step 1: Use Existing decodeJWT Utility

```javascript
import { decodeJWT } from '../utils/jwtUtils'

// Decode without verifying signature (we trust server-issued tokens)
const decoded = decodeJWT(auth.access_token)
const actualUserId = decoded?.credential_id  // e.g., 5
```

### Step 2: Apply in Any Real-Time Feature

#### Game Ready Message
```javascript
const handleReady = async () => {
  // Extract credential_id from JWT - most reliable source
  let actualUserId = null
  if (auth?.access_token) {
    const decoded = decodeJWT(auth.access_token)
    actualUserId = decoded?.credential_id
  }

  if (!actualUserId) {
    console.error('[GameWaitingRoom] Cannot send: unable to extract user ID')
    return
  }

  const payload = {
    type: 'player_ready',
    user_id: actualUserId,
    username: currentUser.username,
    room_id: gameId,
  }

  wsRef.current?.send(JSON.stringify(payload))
}
```

#### Chat Message
```javascript
const sendMessage = async (text) => {
  const decoded = decodeJWT(auth.access_token)
  const senderId = decoded?.credential_id

  if (!senderId) throw new Error('Authentication required')

  const message = {
    type: 'chat_message',
    sender_id: senderId,
    sender_name: currentUser.username,
    text,
    timestamp: new Date().toISOString(),
  }

  wsRef.current?.send(JSON.stringify(message))
}
```

#### Notification With User Context
```javascript
const notifyUserActivity = async (activity) => {
  const decoded = decodeJWT(auth.access_token)
  const userId = decoded?.credential_id

  return fetch('/api/notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-ID': String(userId),  // Also pass as header
    },
    body: JSON.stringify({
      user_id: userId,
      activity_type: activity.type,
      details: activity.details,
    }),
  })
}
```

---

## Handling Received Messages

### ID Matching on Receive

When receiving a message from opponent, match the sender's ID:

```javascript
const handlePlayerReady = (receivedMessage) => {
  const { user_id: incomingUserId } = receivedMessage

  // Normalize to string for comparison (handle both "5" and 5)
  const normalizedIncomingId = String(incomingUserId)
  const normalizedOpponentId = String(opponent.id)
  const normalizedCurrentId = String(currentPlayer.id)

  // Check if this is from opponent
  if (normalizedIncomingId === normalizedOpponentId) {
    setOpponentReady(true)  // It's from opponent
  } else if (normalizedIncomingId === normalizedCurrentId) {
    setCurrentReady(true)   // It's from current player (echo)
  } else {
    // ID doesn't match anyone - might be from 3rd party?
    console.debug('[GameWaitingRoom] Unexpected player ID:', {
      incoming: incomingUserId,
      opponent: opponent.id,
      current: currentPlayer.id,
    })
  }
}
```

### Handle ID Extraction Failure

```javascript
// Try to extract, but have a fallback
let senderId = null
try {
  const decoded = decodeJWT(auth.access_token)
  senderId = decoded?.credential_id
} catch (err) {
  console.error('Could not decode JWT:', err)
  senderId = null
}

if (!senderId) {
  // Fallback: Use username instead of ID
  senderId = currentUser.username
  // Note: This only works if sender and receiver both have unique usernames
}

const payload = {
  type: 'message',
  sender_id: senderId,
  sender_name: currentUser.username,
  text: messageText,
}
```

---

## Backend Validation

The backend should verify that the token's `credential_id` matches the sender:

```python
# example: game-service/ws/router.py
@websocket.on('player_ready')
async def handle_ready(ws, data):
    try:
        # Extract user ID from WebSocket connection context
        # (previously decoded from their JWT during connection)
        current_user_id = ws.user_id  # Already authenticated
        
        incoming_user_id = data.get('user_id')
        
        # Security: Verify the message sender matches the authenticated user
        if int(incoming_user_id) != current_user_id:
            logger.warning(
                f'Possible spoofing: claimed={incoming_user_id}, '
                f'actual={current_user_id}'
            )
            return  # Reject message
        
        # Process legitimate message
        await broadcast_to_room(
            room_id=data.get('room_id'),
            message=data,
        )
    except Exception as e:
        logger.error(f'Error handling ready: {e}')
```

---

## Testing This Pattern

### Unit Test: JWT Extraction

```javascript
import { decodeJWT } from '../utils/jwtUtils'

describe('JWT Credential Extraction', () => {
  it('should extract credential_id from valid JWT', () => {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJzdWIiOiJqb2FvIiwiY3JlZGVudGlhbF9pZCI6NCwiZXhwIjoxNzcmODEwNDMxOTB9.' +
      'signature'
    
    const decoded = decodeJWT(token)
    expect(decoded.credential_id).toBe(4)
    expect(decoded.sub).toBe('joao')
  })

  it('should return null for invalid token', () => {
    const decoded = decodeJWT('invalid.token')
    expect(decoded).toBeNull()
  })

  it('should return null for undefined token', () => {
    const decoded = decodeJWT(undefined)
    expect(decoded).toBeNull()
  })
})
```

### Integration Test: Full Message Flow

```javascript
describe('WebSocket Message With JWT ID', () => {
  it('should send message with JWT-extracted user ID', async () => {
    const auth = { access_token: validJWT }
    const component = render(<GameWaitingRoom />, { auth })

    const readyButton = screen.getByRole('button', { name: /ready/i })
    fireEvent.click(readyButton)

    await waitFor(() => {
      expect(mockWsClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"user_id":4')
      )
    })
  })

  it('should not send if JWT extraction fails', async () => {
    const auth = { access_token: 'invalid-token' }
    const component = render(<GameWaitingRoom />, { auth })

    const readyButton = screen.getByRole('button', { name: /ready/i })
    fireEvent.click(readyButton)

    expect(mockWsClient.send).not.toHaveBeenCalled()
  })
})
```

---

## Implementation Checklist

- [ ] Import `decodeJWT` utility in component
- [ ] Extract `credential_id` in any method sending WebSocket messages
- [ ] Add guard clause: `if (!actualUserId) return;`
- [ ] Include extracted ID in message payload
- [ ] Normalize IDs to string for comparison on receive
- [ ] Add debug logging for ID mismatches
- [ ] Document the pattern in component comments
- [ ] Add unit tests for JWT extraction
- [ ] Add integration tests for full message flow
- [ ] Update backend to validate sender ID matches token

---

## Performance Notes

- **JWT Decoding:** ~0.1ms per call (negligible)
- **Recommended:** Decode once per message send, cache if sending rapidly
- **Alternative:** Store decoded values in React context at login time

```javascript
// Example: Cache decoded token in context
const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(null)
  const [userId, setUserId] = useState(null)

  const login = async (credentials) => {
    const response = await authenticate(credentials)
    setAuth(response)
    // Decode once and cache
    setUserId(decodeJWT(response.access_token)?.credential_id)
  }

  return (
    <AuthContext.Provider value={{ auth, userId }}>
      {children}
    </AuthContext.Provider>
  )
}
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "user_id undefined after sending" | JWT extraction returned null | Check token is valid, add guard clause |
| "Opponent doesn't receive my message" | ID mismatch in routing | Verify same ID extracted on both clients |
| "Both players show as same ID" | Hardcoded fallback used | Always extract from JWT, never default |
| "Token looks different in parts" | Missing decoding step | Use `decodeJWT()` utility, don't parse raw |
| "Works in dev, fails in prod" | Token format changed | Verify JWT payload structure hasn't changed |

---

## Related Patterns

- **[Authentication Flow](../AUTHENTICATION.md)** - How tokens are issued and structured
- **[WebSocket Infrastructure](../about/About_webSockets.md)** - Message passing patterns
- **[Real-Time Features](../MICROSERVICES.md)** - Service communication via WebSocket

---

**Last Updated:** 2026-04-13  
**Status:** ✅ Tested and working  
**Example Feature:** Game invite ready synchronization

/**
 * INTEGRATION EXAMPLE: GameWaitingRoom.jsx with wsLogger
 * 
 * This file shows how to integrate the wsLogger utility into the existing
 * GameWaitingRoom component to track latency and payloads.
 * 
 * Key additions:
 * 1. Import wsLogger at top
 * 2. Call wsLogger.ready() when Ready button clicked
 * 3. Call wsLogger.receive() when state updates 
 * 4. Use wsLogger.latency() to measure delays
 * 5. Call wsLogger.export() in console to debug
 */

// ADD TO TOP OF FILE:
import wsLogger from '../utils/wsLogger'

// IN THE useEffect hook, REPLACE the onMessage handler:
onMessage: (data) => {
    // Track incoming payload
    wsLogger.receive(roomId, data)

    if (!data || typeof data !== 'object') return

    const incomingUserId = String(data.user_id ?? data.player_id ?? '')
    const isCurrentUser = incomingUserId && incomingUserId === String(currentUser.id)
    const isOpponent = incomingUserId && incomingUserId === String(opponent.id)

    // Track state update
    if (data.type === 'player_ready') {
        if (isCurrentUser) {
            setCurrentReady(true)
            wsLogger.uiUpdate(roomId, {
                currentReady: true,
                timestamp: performance.now()
            })
        }
        if (isOpponent) {
            setOpponentReady(true)
            wsLogger.uiUpdate(roomId, {
                opponentReady: true,
                timestamp: performance.now()
            })
        }
    }

    if (data.type === 'player_unready') {
        if (isCurrentUser) setCurrentReady(false)
        if (isOpponent) setOpponentReady(false)
    }

    if (data.type === 'cancel_waiting_room' || data.type === 'game_cancelled') {
        navigate('/play')
    }

    if (data.type === 'game_start') {
        setGameStartReceived(true)
        setSystemMessage('Both players are ready. Game start event received.')
        wsLogger.uiUpdate(roomId, {
            gameStart: true,
            timestamp: performance.now()
        })
    }
},

// ADD TO handleReady function:
const handleReady = () => {
    if (!wsRef.current) return

    const flowStartTime = wsLogger.flowStart(roomId, 'Ready button click')
    const payload = { type: 'player_ready' }

    // Log the ready click with payload and timestamp
    wsLogger.ready(roomId, payload)

    // Send through WebSocket
    wsRef.current.send(payload)

    // Log the send event
    wsLogger.send(roomId, payload)

    // Measure latency after message is sent
    wsLogger.latency('ready_click_to_send', flowStartTime)
}

// ADD TO onOpen callback:
onOpen: () => {
    setConnected(true)
    setSystemMessage('Connected to waiting room. Ready up when you are set.')

    // Log connection
    wsLogger.connection(roomId, 'open', {
        currentUser: currentUser.id,
        opponent: opponent.id
    })
},

    // ADD TO onClose callback:
    onClose: () => {
        setConnected(false)
        setSystemMessage('Connection lost. Trying to reconnect...')
        wsLogger.connection(roomId, 'close')
    },

        // OPTIONAL: Add console method to view all logs
        // Add this anywhere accessible:
        window.wsDebug = () => {
            console.log('=== WebSocket Logger Debug ===')
            console.log('Events:', wsLogger.export())
            console.log('Summary:', wsLogger.summary())
        }

// Usage in browser console:
// wsDebug()                    // View all logged events
// wsLogger.latency()           // See latency measurements
// wsLogger.flowEnd(roomId, 'complete')  // End a flow

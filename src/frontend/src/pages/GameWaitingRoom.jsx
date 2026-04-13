import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import { createWsClient } from '../utils/wsClient'
import './GameWaitingRoom.css'
import { useAuth } from '../context/authContext'
import { decodeJWT } from '../utils/jwtUtils'
import wsLogger from '../utils/wsLogger'

const DEFAULT_AVATAR = '/avatar_placeholder.jpg'

function normalizePlayer(player, fallback) {
  return {
    id: player?.id ?? fallback.id,
    username: player?.username ?? fallback.username,
    avatarUrl: player?.avatarUrl ?? fallback.avatarUrl,
  }
}

export default function GameWaitingRoom() {
  const { roomId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { auth } = useAuth()
  const wsRef = useRef(null)

  const hasInviteContext = Boolean(
    location.state?.currentUser || location.state?.opponent || location.state?.friendUsername
  )

  const currentUser = useMemo(() => (
    normalizePlayer(location.state?.currentUser, {
      id: 'local-player',
      username: 'You',
      avatarUrl: DEFAULT_AVATAR,
    })
  ), [location.state])

  const opponent = useMemo(() => (
    normalizePlayer(location.state?.opponent, {
      id: location.state?.friendId ?? 'remote-player',
      username: location.state?.friendUsername ?? 'Opponent',
      avatarUrl: DEFAULT_AVATAR,
    })
  ), [location.state])

  const [connected, setConnected] = useState(false)
  const [currentReady, setCurrentReady] = useState(false)
  const [opponentReady, setOpponentReady] = useState(false)
  const [systemMessage, setSystemMessage] = useState('Waiting for both players to get ready.')
  const [gameStartReceived, setGameStartReceived] = useState(false)

  useEffect(() => {
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    let url = `${scheme}//${window.location.host}/api/game/ws/game/${roomId}`

    if (auth?.access_token) {
      url += `?token=${auth.access_token}`
    }

    const ws = createWsClient(url, {
      onOpen: () => {
        setConnected(true)
        setSystemMessage('Connected to waiting room. Ready up when you are set.')
        wsLogger.connection(roomId, 'open', {
          currentUser: currentUser.id,
          opponent: opponent.id,
        })
      },
      onClose: () => {
        setConnected(false)
        setSystemMessage('Connection lost. Trying to reconnect...')
        wsLogger.connection(roomId, 'close')
      },
      onMessage: (data) => {
        if (!data || typeof data !== 'object')
          return

        // Log incoming payload
        wsLogger.receive(roomId, data)

        // Normalize IDs to strings for consistent comparison (backend sends numbers, state may have strings)
        const incomingUserId = String(data.user_id ?? data.player_id ?? '')
        const incomingUsername = data.username

        // Identify sender by normalized ID (most reliable) or username fallback if ID unavailable
        const currentUserId = String(currentUser.id ?? '')
        const opponentUserId = String(opponent.id ?? '')

        // Prefer ID matching; use username only if ID is missing/empty
        let isCurrentUser = false
        let isOpponent = false

        if (incomingUserId && currentUserId) {
          isCurrentUser = incomingUserId === currentUserId
        } else if (!incomingUserId && incomingUsername) {
          // Fallback to username if ID unavailable
          isCurrentUser = incomingUsername === currentUser.username
        }

        if (incomingUserId && opponentUserId) {
          isOpponent = incomingUserId === opponentUserId
        } else if (!incomingUserId && incomingUsername) {
          // Fallback to username if ID unavailable
          isOpponent = incomingUsername === opponent.username
        }

        if (data.type === 'player_ready') {
          if (isCurrentUser) {
            setCurrentReady(true)
            wsLogger.uiUpdate(roomId, { currentReady: true })
          }
          if (isOpponent) {
            setOpponentReady(true)
            wsLogger.uiUpdate(roomId, { opponentReady: true })
          }

          // Debug: log ID matching details
          if (!isCurrentUser && !isOpponent) {
            console.debug('[GameWaitingRoom] player_ready ID mismatch:', {
              incomingUserId: String(data.user_id ?? data.player_id ?? ''),
              currentUserId: String(currentUser.id ?? ''),
              opponentUserId: String(opponent.id ?? ''),
              isCurrentUser,
              isOpponent,
              rawData: data,
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
          wsLogger.uiUpdate(roomId, { gameStart: true })
        }
      },
    })

    wsRef.current = ws

    return () => ws.close()
  }, [roomId, currentUser.id, opponent.id, navigate, auth?.access_token])

  useEffect(() => {
    if (currentReady && opponentReady && !gameStartReceived) {
      setSystemMessage('Both players are ready. Waiting for backend game_start event...')
      // End the flow once both players are ready
      if (window._wsFlowStart) {
        wsLogger.flowEnd(roomId, 'ready_to_both_ready', window._wsFlowStart)
        delete window._wsFlowStart
      }
    }
  }, [currentReady, opponentReady, gameStartReceived])

  function handleReady() {
    if (currentReady || !wsRef.current)
      return

    // Start flow timing for ready click → broadcast
    const flowStartTime = wsLogger.flowStart(roomId, 'ready_click')

    // CRITICAL: Extract user ID from JWT token (most reliable source)
    // credential_id in JWT is the actual user ID (4 for João, 5 for Maria, etc.)
    let actualUserId = null
    if (auth?.access_token) {
      const decoded = decodeJWT(auth.access_token)
      actualUserId = decoded?.credential_id
    }

    if (!actualUserId) {
      console.warn('[GameWaitingRoom] Cannot send ready: unable to extract user ID from token')
      setSystemMessage('Error: Authentication not ready. Please refresh the page.')
      return
    }

    const payload = {
      type: 'player_ready',
      room_id: roomId,
      user_id: actualUserId,
      username: currentUser.username,
    }

    // Debug: log the actual user ID and context
    console.debug('[GameWaitingRoom] handleReady:', {
      actualUserId,
      auth_user_id: auth?.user?.id,
      opponent_id: opponent.id,
      currentUser_id: currentUser.id,
    })

    // Log the ready click with payload
    wsLogger.ready(roomId, payload)

    setCurrentReady(true)
    setSystemMessage('You are ready. Waiting for the other player...')

    // Send through WebSocket
    wsRef.current.send(payload)

    // Log the send event
    wsLogger.send(roomId, payload)

    // Measure latency from ready click to send
    wsLogger.latency('ready_click_to_send', flowStartTime)

    // Store flow start for later measurement in onMessage
    window._wsFlowStart = flowStartTime
  }

  function handleCancel() {
    // Extract user ID from JWT token
    let actualUserId = null
    if (auth?.access_token) {
      const decoded = decodeJWT(auth.access_token)
      actualUserId = decoded?.credential_id
    }

    if (!actualUserId) {
      console.warn('[GameWaitingRoom] Cannot send cancel: unable to extract user ID from token')
      navigate('/play')
      return
    }

    const cancelPayload = {
      type: 'cancel_waiting_room',
      room_id: roomId,
      user_id: actualUserId,
      username: currentUser.username,
    }

    wsLogger.send(roomId, cancelPayload)
    wsRef.current?.send(cancelPayload)

    navigate('/play')
  }

  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="arcade-content game-waiting-page">
        <section className="arcade-screen game-waiting-screen">
          <div className="arcade-panel game-waiting-panel">
            <div className="game-waiting-header">
              <div>
                <span className="arcade-display game-waiting-kicker">Remote match</span>
                <h1 className="game-waiting-title">Waiting Room</h1>
                <p className="game-waiting-copy">
                  Room <code>{roomId}</code>
                </p>
              </div>

              <span className={`game-connection-badge ${connected ? 'connected' : 'disconnected'}`}>
                {connected ? 'Connected' : 'Reconnecting'}
              </span>
            </div>

            {!hasInviteContext && (
              <div className="game-waiting-alert">
                This room was opened without invite context. Player names and avatars are using safe placeholders for now.
              </div>
            )}

            <div className="game-waiting-players">
              <article className={`game-player-card ${currentReady ? 'is-ready' : ''}`}>
                <span className="game-player-label">Player one</span>
                <img
                  src={currentUser.avatarUrl}
                  alt={`${currentUser.username} avatar`}
                  className="game-player-avatar"
                />
                <h2 className="game-player-name">{currentUser.username}</h2>
                <p className="game-player-status">
                  {currentReady ? 'Ready' : 'Not ready yet'}
                </p>
              </article>

              <div className="game-versus-badge">VS</div>

              <article className={`game-player-card ${opponentReady ? 'is-ready' : ''}`}>
                <span className="game-player-label">Player two</span>
                <img
                  src={opponent.avatarUrl}
                  alt={`${opponent.username} avatar`}
                  className="game-player-avatar"
                />
                <h2 className="game-player-name">{opponent.username}</h2>
                <p className="game-player-status">
                  {opponentReady ? 'Ready' : 'Waiting for ready'}
                </p>
              </article>
            </div>

            <div className="game-room-status">
              <p className="game-room-status-text">{systemMessage}</p>
              <div className="game-room-checks">
                <span className={`game-room-check ${currentReady ? 'done' : ''}`}>
                  You: {currentReady ? 'READY' : 'PENDING'}
                </span>
                <span className={`game-room-check ${opponentReady ? 'done' : ''}`}>
                  Opponent: {opponentReady ? 'READY' : 'PENDING'}
                </span>
              </div>
            </div>

            <div className="game-room-actions">
              <button
                type="button"
                className="arcade-btn arcade-btn-primary"
                onClick={handleReady}
                disabled={!connected || currentReady}
              >
                {currentReady ? 'Ready locked' : 'Ready'}
              </button>

              <button
                type="button"
                className="arcade-btn arcade-btn-secondary"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
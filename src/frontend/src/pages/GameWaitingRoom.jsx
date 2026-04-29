import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import { createWsClient } from '../utils/wsClient'
import './GameWaitingRoom.css'
import { useAuth } from '../context/authContext'
import wsLogger from '../utils/wsLogger'

const DEFAULT_AVATAR = '/avatar_placeholder.jpg'
const READY_TIMEOUT_SECONDS = 90

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
  const wsFlowStartRef = useRef(null)

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
  const [resolvedUserId, setResolvedUserId] = useState(null)
  const [readyDeadlineTs, setReadyDeadlineTs] = useState(null)
  const [readySecondsLeft, setReadySecondsLeft] = useState(READY_TIMEOUT_SECONDS)

  const formatCountdown = (seconds) => {
    const clamped = Math.max(0, Number(seconds) || 0)
    const mins = String(Math.floor(clamped / 60)).padStart(2, '0')
    const secs = String(clamped % 60).padStart(2, '0')
    return `${mins}:${secs}`
  }

  const normalizeDeadlineSeconds = (value) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return null
    return num > 1e12 ? num / 1000 : num
  }

  const resolvedSelfId = useMemo(() => {
    const fromState = currentUser.id !== 'local-player' ? currentUser.id : null
    const fallback = fromState ?? resolvedUserId
    if (fallback === null || fallback === undefined || fallback === '') {
      return null
    }
    const numeric = Number(fallback)
    return Number.isInteger(numeric) ? numeric : null
  }, [currentUser.id, resolvedUserId])

  const [canonicalPlayer1Id, canonicalPlayer2Id] = useMemo(() => {
    const stateP1 = Number(location.state?.player1_id)
    const stateP2 = Number(location.state?.player2_id)

    if (Number.isInteger(stateP1) && Number.isInteger(stateP2)) {
      return [stateP1, stateP2]
    }

    const opponentNumericId = Number(opponent.id)
    if (Number.isInteger(resolvedSelfId) && Number.isInteger(opponentNumericId)) {
      return resolvedSelfId <= opponentNumericId
        ? [resolvedSelfId, opponentNumericId]
        : [opponentNumericId, resolvedSelfId]
    }

    return [null, null]
  }, [location.state?.player1_id, location.state?.player2_id, opponent.id, resolvedSelfId])

  const existingMatchId = useMemo(() => {
    const matchId = Number(location.state?.matchId ?? location.state?.match_id)
    return Number.isInteger(matchId) ? matchId : null
  }, [location.state?.matchId, location.state?.match_id])

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
        setReadyDeadlineTs((prev) => prev ?? (Date.now() / 1000 + READY_TIMEOUT_SECONDS))
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
        // Prefer resolvedUserId (from server) over currentUser.id (which may be 'local-player' after hard refresh)
        const currentUserId = String(
          (resolvedUserId !== null ? resolvedUserId : null) || currentUser.id || ''
        )
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

        if (data.type === 'waiting_room_status') {
          const serverDeadline = normalizeDeadlineSeconds(data.timeout_deadline)
          setReadyDeadlineTs(serverDeadline ?? (Date.now() / 1000 + READY_TIMEOUT_SECONDS))

          const readyUsers = Array.isArray(data.ready_users)
            ? data.ready_users.map((id) => String(id))
            : []
          if (currentUserId && readyUsers.includes(currentUserId)) setCurrentReady(true)
          if (opponentUserId && readyUsers.includes(opponentUserId)) setOpponentReady(true)
        }

        if (data.type === 'cancel_waiting_room' || data.type === 'game_cancelled') {
          const targetTournamentId = Number(data.tournament_id ?? location.state?.tournamentId)
          if (Number.isInteger(targetTournamentId)) {
            navigate(`/tournaments/${targetTournamentId}`, { replace: true })
          } else {
            navigate('/play', { replace: true })
          }
        }

        if (data.type === 'ready_timeout') {
          setReadySecondsLeft(0)
          if (data.winner_id != null) {
            setSystemMessage('Ready timeout reached. Match resolved by WO.')
          } else {
            setSystemMessage('Ready timeout reached. No player ready, no winner.')
          }
          const targetTournamentId = Number(data.tournament_id ?? location.state?.tournamentId)
          if (Number.isInteger(targetTournamentId)) {
            navigate(`/tournaments/${targetTournamentId}`, { replace: true })
          } else {
            navigate('/play', { replace: true })
          }
        }

        if (data.type === 'game_start') {
          setGameStartReceived(true)
          setSystemMessage('Both players are ready. Game start event received.')
          wsLogger.uiUpdate(roomId, { gameStart: true })

          // Navigate to the actual game
          navigate(`/game/${roomId}`, {
            replace: true,
            state: {
              ...location.state,
              currentUser,
              opponent,
              player1_id: data.player1_id ?? canonicalPlayer1Id,
              player2_id: data.player2_id ?? canonicalPlayer2Id,
              matchId: data.match_id ?? existingMatchId,
            }
          })
        }
      },
    })

    wsRef.current = ws

    return () => ws.close()
  }, [
    roomId,
    currentUser.id,
    opponent.id,
    navigate,
    auth?.access_token,
    location.state,
    canonicalPlayer1Id,
    canonicalPlayer2Id,
    existingMatchId,
  ])

  // Fetch user ID from stable source (/auth/me) if location.state was lost (hard refresh/direct nav)
  useEffect(() => {
    if (currentUser.id && currentUser.id !== 'local-player') {
      // Already have a valid user ID from navigation state
      setResolvedUserId(currentUser.id)
      return
    }

    // Hard refresh or direct navigation: currentUser.id is fallback 'local-player'
    // Fetch real user ID from /auth/me
    if (!auth?.access_token) {
      return
    }

    let cancelled = false
    const fetchUserId = async () => {
      try {
        const response = await fetch('/api/users/auth/me', {
          headers: {
            Authorization: `Bearer ${auth.access_token}`,
          },
        })
        if (!response.ok) {
          throw new Error(`Failed to fetch user: ${response.status}`)
        }
        const me = await response.json()
        if (!cancelled && me?.id) {
          setResolvedUserId(me.id)
        }
      } catch (err) {
        console.warn('[GameWaitingRoom] Failed to resolve user ID on hard refresh:', err.message)
        if (!cancelled) {
          setSystemMessage('Error: Cannot identify user. Please navigate from the invite.')
        }
      }
    }

    void fetchUserId()
    return () => { cancelled = true }
  }, [currentUser.id, auth?.access_token])

  useEffect(() => {
    if (!readyDeadlineTs) return

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil(readyDeadlineTs - Date.now() / 1000))
      setReadySecondsLeft(remaining)
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [readyDeadlineTs])

  useEffect(() => {
    if (currentReady && opponentReady && !gameStartReceived) {
      setSystemMessage('Both players are ready. Waiting for backend game_start event...')
      // End the flow once both players are ready
      if (wsFlowStartRef.current) {
        wsLogger.flowEnd(roomId, 'ready_to_both_ready', wsFlowStartRef.current)
        wsFlowStartRef.current = null
      }
    }
  }, [currentReady, opponentReady, gameStartReceived, roomId])

  function handleReady() {
    if (currentReady || !wsRef.current)
      return

    // Start flow timing for ready click → broadcast
    const flowStartTime = wsLogger.flowStart(roomId, 'ready_click')

    // Use actual user ID from navigation state, resolved user ID (from /auth/me on hard refresh), or auth context
    // NOTE: JWT credential_id is Credentials.id, NOT Users.id — must use real user ID for ID matching
    const actualUserId = resolvedSelfId

    if (!Number.isInteger(actualUserId)) {
      console.warn('[GameWaitingRoom] Cannot send ready: missing valid user ID. Tried: location.state, /auth/me, auth context')
      setSystemMessage('Error: User identification failed. Please navigate from a game invite.')
      return
    }

    if (!Number.isInteger(canonicalPlayer1Id) || !Number.isInteger(canonicalPlayer2Id)) {
      setSystemMessage('Missing player ids for this room. Please re-open from the invite.')
      return
    }

    const payload = {
      type: 'player_ready',
      room_id: roomId,
      user_id: actualUserId,
      username: currentUser.username,
      player1_id: canonicalPlayer1Id,
      player2_id: canonicalPlayer2Id,
      match_id: existingMatchId,
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

    // Store flow start for later measurement in onMessage (component-scoped to avoid state leaks)
    wsFlowStartRef.current = flowStartTime
  }

  function handleCancel() {
    // Use actual user ID from navigation state, resolved user ID (from /auth/me on hard refresh), or auth context
    // NOTE: JWT credential_id is Credentials.id, NOT Users.id — must use real user ID for consistency
    const actualUserId = resolvedSelfId

    if (!Number.isInteger(actualUserId)) {
      console.warn('[GameWaitingRoom] Cannot send cancel: missing valid user ID. Tried: location.state, /auth/me, auth context')
      navigate('/play')
      return
    }

    const cancelPayload = {
      type: 'cancel_waiting_room',
      room_id: roomId,
      user_id: actualUserId,
      username: currentUser.username,
      player1_id: canonicalPlayer1Id,
      player2_id: canonicalPlayer2Id,
      match_id: existingMatchId,
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
              <p className="game-room-status-text">
                Ready timeout in: {formatCountdown(readySecondsLeft)}
              </p>
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

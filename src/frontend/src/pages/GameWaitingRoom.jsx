import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import { createWsClient } from '../utils/wsClient'
import './GameWaitingRoom.css'
import { useAuth } from '../context/authContext'

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
      },
      onClose: () => {
        setConnected(false)
        setSystemMessage('Connection lost. Trying to reconnect...')
      },
      onMessage: (data) => {
        if (!data || typeof data !== 'object')
          return

        const incomingUserId = String(data.user_id ?? data.player_id ?? '')
        const isCurrentUser = incomingUserId && incomingUserId === String(currentUser.id)
        const isOpponent = incomingUserId && incomingUserId === String(opponent.id)

        if (data.type === 'player_ready') {
          if (isCurrentUser) setCurrentReady(true)
          if (isOpponent) setOpponentReady(true)
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
        }
      },
    })

    wsRef.current = ws

    return () => ws.close()
  }, [roomId, currentUser.id, opponent.id, navigate, auth?.access_token])

  useEffect(() => {
    if (currentReady && opponentReady && !gameStartReceived) {
      setSystemMessage('Both players are ready. Waiting for backend game_start event...')
    }
  }, [currentReady, opponentReady, gameStartReceived])

  function handleReady() {
    if (currentReady || !wsRef.current)
      return

    setCurrentReady(true)
    setSystemMessage('You are ready. Waiting for the other player...')

    wsRef.current.send({
      type: 'player_ready',
      room_id: roomId,
      user_id: currentUser.id,
      username: currentUser.username,
    })
  }

  function handleCancel() {
    wsRef.current?.send({
      type: 'cancel_waiting_room',
      room_id: roomId,
      user_id: currentUser.id,
      username: currentUser.username,
    })

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
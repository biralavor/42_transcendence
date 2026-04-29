import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import PongCanvasMultiplayer from '../Components/PongCanvasMultiplayer'
import GameOverOverlay from '../Components/GameOverOverlay'
import './GamePage.css'
import { apiJson } from '../utils/apiClient'
import { useAuth } from '../context/authContext'
import {
  buildInviteRoomId,
  sendGameChannelMessage,
} from '../utils/gameInviteChannel'

export default function GamePage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isSpectator = searchParams.get('spectate') === 'true'
  const { isAuthenticated, isAuthReady } = useAuth()

  const currentUser = location.state?.currentUser ?? { id: location.state?.player1_id, username: 'Player 1', avatar_url: null }
  const opponent = location.state?.opponent ?? null

  const player1Id = location.state?.player1_id ?? currentUser?.id
  const player2Id = location.state?.player2_id ?? opponent?.id
  const isAiGame = Number(player2Id) === 0

  const [p1Name, setP1Name] = useState(currentUser?.username ?? 'Player 1')
  const [p2Name, setP2Name] = useState(isAiGame ? 'AI Opponent' : (opponent?.username ?? 'Player 2'))
  const [p1Avatar, setP1Avatar] = useState(currentUser?.avatarUrl ?? currentUser?.avatar_url ?? '/avatar_placeholder.jpg')
  const [p2Avatar, setP2Avatar] = useState(isAiGame ? '/avatar_placeholder.jpg' : (opponent?.avatarUrl ?? opponent?.avatar_url ?? '/avatar_placeholder.jpg'))

  // The current user's real ID and name — authoritative regardless of how this page was
  // navigated to (waiting-room state, tournament bracket state, or VsCpuCard state all
  // put different shapes in location.state, so we can't rely on player1Id being "me").
  const [myId, setMyId] = useState(currentUser?.id ?? null)
  const [myName, setMyName] = useState(currentUser?.username ?? 'Player 1')

  useEffect(() => {
    apiJson('/api/users/auth/me')
      .then(me => {
        setMyId(me.id)
        setMyName(me.display_name ?? me.username)
      })
      .catch(() => { })
  }, [])

  useEffect(() => {
    if (player1Id != null) {
      apiJson(`/api/users/profile/${player1Id}`)
        .then(p => {
          setP1Name(p.display_name ?? p.username)
          setP1Avatar(p.avatar_url || '/avatar_placeholder.jpg')
        })
        .catch(() => { })
    }
    if (player2Id != null && !isAiGame) {
      apiJson(`/api/users/profile/${player2Id}`)
        .then(p => {
          setP2Name(p.display_name ?? p.username)
          setP2Avatar(p.avatar_url || '/avatar_placeholder.jpg')
        })
        .catch(() => { })
    }
  }, [player1Id, player2Id])

  useEffect(() => {
    if (isAiGame) {
      setP2Avatar('/avatar_placeholder.jpg')
    }
  }, [isAiGame])

  const tournamentId = location.state?.tournamentId
  const tournamentMatchId = location.state?.tournamentMatchId
  // matchId supports both old (matchId) and new (tournamentMatchId) navigation state shapes
  const matchId = location.state?.matchId ?? tournamentMatchId
  const difficulty = location.state?.difficulty ?? 'medium'

  const [gameOverResult, setGameOverResult] = useState(null)
  const [spectatorCount, setSpectatorCount] = useState(0)
  const submittingRef = useRef(false)

  useEffect(() => {
    // Spectators don't have player IDs in location.state — they reach this
    // route via /games/live's Watch link. Skip the redirect for them.
    if (isSpectator) return

    // Players: require auth (route is no longer wrapped in PrivateRoute) and
    // the room/player IDs we need to drive the canvas.
    if (isAuthReady && !isAuthenticated) {
      navigate('/login', { replace: true })
      return
    }
    if (!roomId || player1Id == null || player2Id == null) {
      navigate('/play')
    }
  }, [isSpectator, isAuthReady, isAuthenticated, roomId, player1Id, player2Id, navigate])

  // Spectators arrive without location.state, so pull the game's player
  // names/avatars + initial spectator_count from /api/games/live.
  useEffect(() => {
    if (!isSpectator || !roomId) return
    let cancelled = false
    fetch('/api/games/live')
      .then(r => (r.ok ? r.json() : []))
      .then((games) => {
        if (cancelled || !Array.isArray(games)) return
        const g = games.find(x => x.game_id === roomId)
        if (!g) return
        setP1Name(g.player1?.display_name || g.player1?.username || 'Player 1')
        setP2Name(g.player2?.display_name || g.player2?.username || 'Player 2')
        setP1Avatar(g.player1?.avatar_url || '/avatar_placeholder.jpg')
        setP2Avatar(g.player2?.avatar_url || '/avatar_placeholder.jpg')
        if (typeof g.spectator_count === 'number') {
          setSpectatorCount(g.spectator_count)
        }
      })
      .catch(() => { /* ignore — banner still renders */ })
    return () => { cancelled = true }
  }, [isSpectator, roomId])

  if (!roomId) return null
  if (!isSpectator && (player1Id == null || player2Id == null)) return null
  if (!isSpectator && isAuthReady && !isAuthenticated) return null

  async function handleGameEnd(result) {
    if (tournamentId && matchId && !submittingRef.current) {
      submittingRef.current = true
      try {
        await apiJson(`/api/game/tournaments/${tournamentId}/matches/${matchId}/result`, {
          method: 'POST',
          body: JSON.stringify(result),
        })
        // Fall through — show overlay with tournament-specific buttons
      } catch (error) {
        console.error('Failed to submit tournament result:', error)
      } finally {
        submittingRef.current = false
      }
    }
    setGameOverResult(result)
  }

  async function handlePlayAgain() {
    if (isAiGame) {
      try {
        const me = await apiJson('/api/users/auth/me')
        const { game_id } = await apiJson('/api/game/ai', {
          method: 'POST',
          body: JSON.stringify({ difficulty }),
        })
        setGameOverResult(null)
        navigate(`/game/${game_id}`, {
          state: { player1_id: me.id, player2_id: 0, difficulty, gameType: 'ai' },
        })
      } catch {
        setGameOverResult(null)
        navigate('/play')
      }
      return
    }

    if (!opponent?.id) {
      setGameOverResult(null)
      navigate('/play')
      return
    }
    const newRoomId = buildInviteRoomId(currentUser.id, opponent.id)
    const expiresAt = Date.now() + 30000
    try {
      await sendGameChannelMessage(opponent.id, {
        type: 'game_invite',
        room_id: newRoomId,
        from_user_id: currentUser.id,
        from_username: currentUser.username,
        from_avatar_url: currentUser.avatarUrl || currentUser.avatar_url || null,
        to_user_id: opponent.id,
        to_username: opponent.username,
        expires_at: expiresAt,
      })
      setGameOverResult(null)
      navigate(`/game/waiting/${newRoomId}`, {
        state: {
          currentUser,
          opponent,
          friendId: opponent.id,
          friendUsername: opponent.username,
        },
      })
    } catch {
      setGameOverResult(null)
      navigate('/play')
    }
  }

  function handleClose() {
    navigate('/play')
  }

  function handleViewBracket() {
    navigate(`/tournaments/${tournamentId}`)
  }

  function handleNextTurn() {
    navigate(`/tournaments/${tournamentId}`)
  }

  const winnerId = gameOverResult?.winner_id
  // Compare winner_id against myId (from /auth/me), not player1Id, because
  // tournament and some remote paths put the bracket's player1 in location.state
  // rather than the actual current user — so player1Id is unreliable here.
  const isCurrentUserWinner = gameOverResult && myId != null
    ? winnerId === Number(myId)
    : null
  const scoreP1 = gameOverResult?.score_p1 ?? 0
  const scoreP2 = gameOverResult?.score_p2 ?? 0
  const isMyLeftSide = Number(myId) === Number(player1Id)

  return (
    <>
      <NavbarComponent />
      <main className="arcade-content game-page">
        <section className="arcade-screen game-page-screen">
          <div className="arcade-panel game-page-panel">
            <div className="game-page-header">
              <aside className={`tournament-side-panel game-page-side-panel game-page-side-left ${isMyLeftSide ? 'is-you' : ''}`}>
                <img
                  src={p1Avatar}
                  alt={p1Name}
                  className="tournament-side-avatar"
                />
                <span className="tournament-side-name">{p1Name}</span>
              </aside>

              <div className="game-page-header-title">
                <span className="arcade-display game-page-kicker">Live Match</span>
                <h1 id="game-page-title" className="arcade-title game-page-title">Pong Arena</h1>
              </div>

              <aside className={`tournament-side-panel game-page-side-panel game-page-side-right ${!isMyLeftSide ? 'is-you' : ''}`}>
                <img
                  src={p2Avatar}
                  alt={p2Name}
                  className="tournament-side-avatar"
                />
                <span className="tournament-side-name">{p2Name}</span>
              </aside>
            </div>

            {isSpectator && (
              <div className="spectator-banner" role="status" aria-live="polite">
                <span className="spectator-banner-text">Watching as spectator</span>
                <span className="spectator-count-badge" aria-label="spectators watching">
                  👁 {spectatorCount}
                </span>
              </div>
            )}

            <div className="game-page-stage" role="group" aria-labelledby="game-page-title">
              <div className="game-page-canvas-shell" style={{ position: 'relative' }}>
                <PongCanvasMultiplayer
                  key={roomId}
                  gameId={roomId}
                  player1Id={player1Id}
                  player2Id={player2Id}
                  onGameEnd={handleGameEnd}
                  spectator={isSpectator}
                  onSpectatorCount={setSpectatorCount}
                />
                {gameOverResult && !isSpectator && (
                  <GameOverOverlay
                    winnerName={myName}
                    scoreP1={scoreP1}
                    scoreP2={scoreP2}
                    p1Name={p1Name}
                    p2Name={p2Name}
                    isCurrentUserWinner={isCurrentUserWinner}
                    isTournamentGame={Boolean(tournamentId)}
                    onPlayAgain={handlePlayAgain}
                    onClose={handleClose}
                    onViewBracket={handleViewBracket}
                    onNextTurn={handleNextTurn}
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}

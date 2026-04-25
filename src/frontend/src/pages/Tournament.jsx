import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import { apiCall, apiJson } from '../utils/apiClient'
import { useAuth } from '../context/authContext'
import { createWsClient } from '../utils/wsClient'
import './Tournament.css'

const READY_TIMEOUT_SECONDS = 90
const TOURNAMENT_SYNC_INTERVAL_MS = 3000

export default function Tournament() {
  const { id: tournamentId } = useParams()
  const navigate = useNavigate()
  const { auth } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startError, setStartError] = useState('')
  const [startLoading, setStartLoading] = useState(false)
  const [tournament, setTournament] = useState(null)
  const [profiles, setProfiles] = useState({})
  const [currentUser, setCurrentUser] = useState(null)
  const [readyByMatch, setReadyByMatch] = useState({})
  const [wsConnected, setWsConnected] = useState(false)
  const [readyError, setReadyError] = useState('')
  const [nowMs, setNowMs] = useState(Date.now())

  const wsRef = useRef(null)
  const currentUserRef = useRef(null)
  const profilesRef = useRef({})
  const pendingMatchStartRef = useRef(null)

  const formatCountdown = useCallback((seconds) => {
    const clamped = Math.max(0, Number(seconds) || 0)
    const mins = String(Math.floor(clamped / 60)).padStart(2, '0')
    const secs = String(clamped % 60).padStart(2, '0')
    return `${mins}:${secs}`
  }, [])

  const fetchProfilesByIds = useCallback(async (userIds) => {
    const uniqueIds = [...new Set(
      userIds
        .map((uid) => Number(uid))
        .filter((uid) => Number.isFinite(uid)),
    )]

    const profileEntries = {}

    await Promise.all(
      uniqueIds.map(async (uid) => {
        try {
          const res = await apiCall(`/api/users/profile/${uid}`)
          if (!res.ok) throw new Error('Profile fetch failed')
          const p = await res.json()
          profileEntries[uid] = {
            username: p.display_name || p.username || `User ${uid}`,
            avatarUrl: p.avatar_url || '/avatar_placeholder.jpg',
          }
        } catch {
          profileEntries[uid] = {
            username: `User ${uid}`,
            avatarUrl: '/avatar_placeholder.jpg',
          }
        }
      }),
    )

    return profileEntries
  }, [])

  const collectTournamentUserIds = useCallback((data) => {
    const ids = new Set()

    if (Array.isArray(data?.participants)) {
      data.participants.forEach((p) => {
        if (p?.user_id != null) ids.add(Number(p.user_id))
      })
    }

    if (Array.isArray(data?.matches)) {
      data.matches.forEach((m) => {
        if (m?.player1_id != null) ids.add(Number(m.player1_id))
        if (m?.player2_id != null) ids.add(Number(m.player2_id))
        if (m?.winner_id != null) ids.add(Number(m.winner_id))
      })
    }

    return [...ids]
  }, [])

  const refreshTournament = useCallback(async ({ showLoading = false } = {}) => {
    if (!tournamentId) return

    if (showLoading) {
      setLoading(true)
      setError('')
    }

    try {
      const resp = await apiCall(`/api/game/tournaments/${tournamentId}`)
      if (!resp.ok) {
        if (resp.status === 404) throw new Error('Tournament not found')
        throw new Error('Failed to load tournament')
      }

      const freshData = await resp.json()
      setTournament(freshData)
      setStartError('')

      const ids = collectTournamentUserIds(freshData)
      const knownProfiles = profilesRef.current || {}
      const missingIds = ids.filter((uid) => !knownProfiles[uid])

      if (missingIds.length > 0) {
        const newEntries = await fetchProfilesByIds(missingIds)
        setProfiles((prev) => ({ ...prev, ...newEntries }))
      }
    } catch (err) {
      if (showLoading) {
        setError(err.message)
      }
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [tournamentId, collectTournamentUserIds, fetchProfilesByIds])

  const isCreator = useMemo(() => {
    return currentUser && tournament && Number(currentUser.id) === Number(tournament.creator_id)
  }, [currentUser, tournament])

  const isJoined = useMemo(() => {
    if (!currentUser || !tournament) return false
  
    const isActive =
      tournament.status === 'open' || tournament.status === 'in_progress'
  
    return isActive && tournament.participants?.some(
      (p) => Number(p.user_id) === Number(currentUser.id),
    )
  }, [currentUser, tournament])

  const participantCount = tournament?.participants?.length ?? 0
  const maxParticipants = tournament?.max_participants ?? 0

  const showStartButton = useMemo(() => {
    return Boolean(tournament && tournament.status === 'open' && isCreator)
  }, [tournament, isCreator])

  const canStart = useMemo(() => {
    if (!showStartButton) return false
    return participantCount === maxParticipants && !startLoading
  }, [showStartButton, participantCount, maxParticipants, startLoading])

  const leaderboard = useMemo(() => {
    if (!tournament || !tournament.participants) return []

    const stats = {}

    tournament.participants.forEach(({ user_id }) => {
      stats[user_id] = {
        userId: user_id,
        wins: 0,
        matches: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      }
    })

    if (tournament.matches) {
      tournament.matches.forEach((m) => {
        const p1Id = m.player1_id
        const p2Id = m.player2_id
        const p1Score = Number(m.score_p1 ?? 0)
        const p2Score = Number(m.score_p2 ?? 0)

        if (p1Id != null && stats[p1Id]) {
          stats[p1Id].matches++
          stats[p1Id].goalsFor += p1Score
          stats[p1Id].goalsAgainst += p2Score
        }

        if (p2Id != null && stats[p2Id]) {
          stats[p2Id].matches++
          stats[p2Id].goalsFor += p2Score
          stats[p2Id].goalsAgainst += p1Score
        }

        if (m.status === 'finished' && m.winner_id != null && stats[m.winner_id]) {
          stats[m.winner_id].wins++
        }
      })
    }

    const entries = Object.values(stats).map((s) => {
      const prof = profiles[s.userId] || {}

      return {
        userId: s.userId,
        username: prof.username || `User ${s.userId}`,
        avatarUrl: prof.avatarUrl || '/avatar_placeholder.jpg',
        wins: s.wins,
        matches: s.matches,
        goalsFor: s.goalsFor,
        goalsAgainst: s.goalsAgainst,
        goalDifference: s.goalsFor - s.goalsAgainst,
        points: s.wins,
      }
    })

    entries.sort((a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      b.wins - a.wins ||
      a.username.localeCompare(b.username)
    )

    return entries
  }, [tournament, profiles])

  const champion = useMemo(() => {
    if (!tournament || tournament.status !== 'complete' || leaderboard.length === 0) {
      return null
    }

    const winnerId = Number(tournament.winner_id)
    if (Number.isFinite(winnerId)) {
      const winnerEntry = leaderboard.find((entry) => Number(entry.userId) === winnerId)
      if (winnerEntry) return winnerEntry
    }

    return leaderboard[0]
  }, [tournament, leaderboard])

  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  useEffect(() => {
    profilesRef.current = profiles
  }, [profiles])

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleMatchStart = useCallback((data) => {
    const me = currentUserRef.current
    if (!me) {
      pendingMatchStartRef.current = data
      return
    }

    const meId = Number(me.id)
    const player1Id = Number(data.player1_id)
    const player2Id = Number(data.player2_id)
    const isMyMatch = meId === player1Id || meId === player2Id
    if (!isMyMatch) return

    const opponentId = meId === player1Id ? player2Id : player1Id
    const latestProfiles = profilesRef.current || {}
    const opponentProfile = latestProfiles[opponentId] || {}

    navigate(`/game/waiting/${data.game_room_id}`, {
      replace: true,
      state: {
        currentUser: {
          id: me.id,
          username: me.username,
          avatarUrl: latestProfiles[me.id]?.avatarUrl || '/avatar_placeholder.jpg',
        },
        opponent: {
          id: opponentId,
          username: opponentProfile.username || `User ${opponentId}`,
          avatarUrl: opponentProfile.avatarUrl || '/avatar_placeholder.jpg',
        },
        player1_id: player1Id,
        player2_id: player2Id,
        matchId: Number(data.match_id),
        tournamentId: Number(tournamentId),
        tournamentMatchId: Number(data.tournament_match_id),
      },
    })
    pendingMatchStartRef.current = null
  }, [navigate, tournamentId])

  useEffect(() => {
    if (pendingMatchStartRef.current && currentUser) {
      handleMatchStart(pendingMatchStartRef.current)
    }
  }, [currentUser, handleMatchStart])

  useEffect(() => {
    let cancelled = false

    async function loadMe() {
      if (!auth?.access_token) {
        setCurrentUser(null)
        return
      }

      try {
        const resp = await apiCall('/api/users/auth/me')
        if (!resp.ok) throw new Error(`Failed to load user: ${resp.status}`)
        const data = await resp.json()
        if (!cancelled) setCurrentUser({ id: data.id, username: data.username })
      } catch {
        if (!cancelled) setCurrentUser(null)
      }
    }

    loadMe()
    return () => {
      cancelled = true
    }
  }, [auth?.access_token])

  useEffect(() => {
    void refreshTournament({ showLoading: true })
  }, [refreshTournament])

  useEffect(() => {
    if (!tournamentId || !auth?.access_token) return

    const syncTournament = () => {
      if (tournament?.status !== 'open' && tournament?.status !== 'in_progress') return
      void refreshTournament()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncTournament()
      }
    }

    const intervalId = setInterval(syncTournament, TOURNAMENT_SYNC_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [tournamentId, auth?.access_token, tournament?.status, refreshTournament])

  useEffect(() => {
    if (!tournamentId || !auth?.access_token) return

    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${scheme}//${window.location.host}/api/game/ws/tournament/${tournamentId}?token=${auth.access_token}`

    const ws = createWsClient(url, {
      onOpen: () => {
        setWsConnected(true)
        setReadyByMatch({})
        setReadyError('')
        console.log(`[Tournament WS] connected: ${tournamentId}`)
      },

      onClose: () => {
        setWsConnected(false)
        console.log(`[Tournament WS] disconnected: ${tournamentId}`)
      },

      onMessage: async (data) => {
        if (!data || typeof data !== 'object') return

        const { type, tournament_id } = data

        if (String(tournament_id) !== String(tournamentId)) return

        if (type === 'match_player_ready') {
          setReadyByMatch((prev) => ({
            ...prev,
            [data.match_id]: {
              ...(prev[data.match_id] || {}),
              [data.user_id]: true,
            },
          }))
          return
        }

        if (type === 'match_player_unready') {
          setReadyByMatch((prev) => {
            const current = { ...(prev[data.match_id] || {}) }
            delete current[data.user_id]

            return {
              ...prev,
              [data.match_id]: current,
            }
          })
          return
        }

        if (type === 'match_ready_timeout') {
          setReadyByMatch((prev) => ({
            ...prev,
            [data.match_id]: {},
          }))
          if (data.winner_id != null) {
            setReadyError('Ready timeout: match resolved by WO.')
          } else {
            setReadyError('Ready timeout: no player ready, no winner assigned.')
          }
          return
        }

        if (type === 'match_start') {
          handleMatchStart(data)
          return
        }

        if (type !== 'tournament_updated' && type !== 'tournament_complete') {
          return
        }

        await refreshTournament()
      },
    })

    wsRef.current = ws

    return () => {
      setWsConnected(false)
      ws.close()
    }
  }, [tournamentId, auth?.access_token, handleMatchStart, refreshTournament])

  async function handleStartTournament() {
    if (!tournamentId || !canStart) return

    setStartLoading(true)
    setStartError('')

    try {
      const resp = await apiJson(`/api/game/tournaments/${tournamentId}/start`, {
        method: 'POST',
      })
      setTournament(resp)
    } catch (err) {
      setStartError(err.message || 'Failed to start tournament')
    } finally {
      setStartLoading(false)
    }
  }

  async function handleLeave() {
    if (!tournamentId) return

    try {
      setError('')
      await apiJson(`/api/game/tournaments/${tournamentId}/leave`, { method: 'POST' })
      navigate('/tournaments', { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to leave tournament')
    }
  }

  async function handleWithdraw() {
    if (!tournamentId) return

    try {
      setError('')
      await apiJson(`/api/game/tournaments/${tournamentId}/withdraw`, {
        method: 'POST',
      })
      navigate('/tournaments', { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to withdraw from tournament')
    }
  }

  async function handleCancel() {
    if (!tournamentId) return

    try {
      setError('')
      await apiJson(`/api/game/tournaments/${tournamentId}`, { method: 'DELETE' })
      navigate('/tournaments', { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to cancel tournament')
    }
  }

  function handleReadyForMatch(match) {
    if (!wsRef.current || !match?.id) return
    if (!wsConnected) {
      setReadyError('Connection is syncing. Please wait a second and try ready again.')
      return
    }

    setReadyError('')
    wsRef.current.send({
      type: 'ready',
      match_id: Number(match.id),
    })
  }

  const sortedMatches = useMemo(() => {
    if (!tournament?.matches) return []

    return [...tournament.matches].sort((a, b) => {
      const roundDiff = Number(a.round ?? 0) - Number(b.round ?? 0)
      if (roundDiff !== 0) return roundDiff
      return Number(a.position ?? 0) - Number(b.position ?? 0)
    })
  }, [tournament])

  function renderMatchCell(match) {
    const { player1_id, player2_id, winner_id, status } = match
    const p1 = player1_id != null ? profiles[player1_id] : null
    const p2 = player2_id != null ? profiles[player2_id] : null
    const winner = winner_id != null ? profiles[winner_id] : null
    const p1Label = p1?.username || (player1_id != null ? `User ${player1_id}` : 'TBD')
    const p2Label = p2?.username || (player2_id != null ? `User ${player2_id}` : 'TBD')
    const winnerLabel = winner?.username || (winner_id != null ? `User ${winner_id}` : 'Unknown')

    const isCurrentUsersMatch =
      currentUser &&
      status === 'in_progress' &&
      (Number(player1_id) === Number(currentUser.id) ||
        Number(player2_id) === Number(currentUser.id))

    const currentUserReady = Boolean(readyByMatch[match.id]?.[currentUser?.id])

    const opponentId =
      Number(currentUser?.id) === Number(player1_id) ? player2_id : player1_id

    const opponentIsReady = Boolean(readyByMatch[match.id]?.[opponentId])
    let readyButtonLabel = 'Ready for Match'
    if (currentUserReady) readyButtonLabel = 'Ready locked'
    else if (!wsConnected) readyButtonLabel = 'Reconnecting...'
    const parsedStartedAt = match?.started_at ? Date.parse(match.started_at) : NaN
    const readySecondsLeft = Number.isFinite(parsedStartedAt)
      ? Math.max(0, READY_TIMEOUT_SECONDS - Math.floor((nowMs - parsedStartedAt) / 1000))
      : null
    const readyCountdownLabel = readySecondsLeft == null
      ? null
      : formatCountdown(readySecondsLeft)

    return (
      <div
        key={match.id || `${match.round}-${match.position}`}
        className={`tournament-match-cell ${status === 'finished' ? 'finished' : ''}`}
      >
        <div className="tournament-player">
          <img
            src={p1?.avatarUrl || '/avatar_placeholder.jpg'}
            alt="player1 avatar"
            className="tournament-avatar"
          />
          <span className="tournament-player-name">{p1Label}</span>
        </div>

        <div className="tournament-vs">vs</div>

        <div className="tournament-player">
          <img
            src={p2?.avatarUrl || '/avatar_placeholder.jpg'}
            alt="player2 avatar"
            className="tournament-avatar"
          />
          <span className="tournament-player-name">{p2Label}</span>
        </div>

        {status === 'in_progress' && readyCountdownLabel && (
          <div className="arcade-copy mt-2">
            Ready timeout in: {readyCountdownLabel}
          </div>
        )}

        {isCurrentUsersMatch && (
          <div className="mt-3 d-flex flex-column gap-2">
            <button
              type="button"
              className="arcade-btn arcade-btn-primary"
              onClick={() => handleReadyForMatch(match)}
              disabled={currentUserReady || !wsConnected}
            >
              {readyButtonLabel}
            </button>

            {opponentIsReady && (
              <span className="arcade-copy">Opponent is ready.</span>
            )}
          </div>
        )}

        {status === 'finished' && (
          <div className="tournament-winner">
            Winner: <strong>{winnerLabel}</strong>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="arcade-shell">
        <NavbarComponent />
        <main className="arcade-content py-4">
          <section className="arcade-screen">
            <div className="arcade-panel p-4">
              <p className="arcade-copy mb-0">Loading tournament…</p>
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="arcade-shell">
        <NavbarComponent />
        <main className="arcade-content py-4">
          <section className="arcade-screen">
            <div className="arcade-panel p-4">
              <p className="arcade-copy mb-0 text-danger">{error}</p>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="arcade-shell tournament-page">
      <NavbarComponent />
      <main className="arcade-content py-4">
        <section className="arcade-screen">
          <div className="arcade-panel p-4 p-lg-5">
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-4">
              <div>
                <span className="arcade-display mb-3 d-inline-block">Tournament</span>
                <h1 className="arcade-title mb-2">{tournament?.name || 'Tournament'}</h1>
                <p className="arcade-copy mb-0">
                  {participantCount} / {maxParticipants} participants&nbsp;•&nbsp;
                  Status: {tournament?.status}
                </p>
              </div>

              <div className="d-flex flex-column align-items-start align-items-lg-end gap-2">
                {tournament?.status === 'open' && isJoined && (
                  <button
                    type="button"
                    className={`arcade-btn ${isCreator ? 'arcade-btn-danger' : 'arcade-btn-secondary'}`}
                    onClick={isCreator ? handleCancel : handleLeave}
                  >
                    {isCreator ? 'Cancel Tournament' : 'Leave Tournament'}
                  </button>
                )}

                {tournament?.status === 'in_progress' && isJoined && (
                  <button
                    type="button"
                    className="arcade-btn arcade-btn-danger"
                    onClick={handleWithdraw}
                  >
                    Withdraw from Tournament
                  </button>
                )}

                {showStartButton && (
                  <button
                    type="button"
                    className="arcade-btn arcade-btn-primary"
                    onClick={handleStartTournament}
                    disabled={!canStart}
                    title={
                      !canStart
                        ? `Tournament must be full to start (${participantCount}/${maxParticipants})`
                        : ''
                    }
                  >
                    {startLoading ? 'Starting...' : 'Start Tournament'}
                  </button>
                )}

                <button
                  type="button"
                  className="arcade-btn arcade-btn-secondary"
                  onClick={() => navigate('/tournaments')}
                >
                  Back to Tournaments
                </button>
              </div>
            </div>

            {startError && (
              <div className="alert alert-danger mb-4" role="alert">
                {startError}
              </div>
            )}

            {readyError && (
              <div className="alert alert-warning mb-4" role="alert">
                {readyError}
              </div>
            )}

            {champion && (
              <div className="tournament-champion mb-4" role="status" aria-live="polite">
                <p className="arcade-kicker mb-2">Tournament Champion</p>
                <div className="tournament-champion-body">
                  <img
                    src={champion.avatarUrl || '/avatar_placeholder.jpg'}
                    alt={`${champion.username} champion avatar`}
                    className="tournament-champion-avatar"
                  />
                  <div>
                    <h2 className="arcade-section-title mb-1">{champion.username}</h2>
                    <p className="arcade-copy mb-0">
                      Winner of {tournament?.name || 'this tournament'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="tournament-participants mb-4">
              <h2 className="arcade-section-title mb-2">Participants</h2>
              <div className="participant-grid">
                {tournament?.participants?.map(({ user_id }) => {
                  const prof = profiles[user_id] || {}
                  return (
                    <div className="participant-card" key={user_id}>
                      <img
                        src={prof.avatarUrl || '/avatar_placeholder.jpg'}
                        alt={prof.username || `User ${user_id}`}
                        className="participant-avatar"
                      />
                      <span className="participant-name">{prof.username || `User ${user_id}`}</span>
                    </div>
                  )
                })}

                {Array.from({
                  length: Math.max(0, maxParticipants - participantCount),
                }).map((_, idx) => (
                  <div className="participant-card placeholder" key={`placeholder-${idx}`}>
                    <div className="placeholder-avatar" />
                    <span className="participant-name">Waiting…</span>
                  </div>
                ))}
              </div>
            </div>

            {leaderboard.length > 0 && (
              <div className="tournament-leaderboard mb-4">
                <h2 className="arcade-section-title mb-2">Leaderboard</h2>
                <div className="table-responsive">
                  <table className="table table-dark table-striped align-middle">
                    <thead>
                      <tr>
                        <th className="text-center">Pos</th>
                        <th>Player</th>
                        <th>Pts</th>
                        <th>W</th>
                        <th>MP</th>
                        <th>GF</th>
                        <th>GA</th>
                        <th>GD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((row, index) => (
                        <tr key={row.userId}>
                          <td className="text-center fw-semibold">{index + 1}</td>
                          <td className="d-flex align-items-center gap-2">
                            <img
                              src={row.avatarUrl || '/avatar_placeholder.jpg'}
                              alt={row.username}
                              style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                            />
                            <span>{row.username}</span>
                          </td>
                            <td>{row.points}</td>
                            <td>{row.wins}</td>
                            <td>{row.matches}</td>
                            <td>{row.goalsFor}</td>
                            <td>{row.goalsAgainst}</td>
                            <td>{row.goalDifference}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="tournament-matches">
              <h2 className="arcade-section-title mb-3">Tournament Matches</h2>
                      
              {sortedMatches.length === 0 && (
                <p className="arcade-copy">No matches scheduled yet.</p>
              )}
            
              {sortedMatches.length > 0 && (
                <div className="matches-grid">
                  {sortedMatches.map((match) => renderMatchCell(match))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

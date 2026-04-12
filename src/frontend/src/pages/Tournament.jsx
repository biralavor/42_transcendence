import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import { apiCall, apiJson } from '../utils/apiClient'
import { useAuth } from '../context/authContext'
import { createWsClient } from '../utils/wsClient'
import './Tournament.css'

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

  const wsRef = useRef(null)

  const isCreator = useMemo(() => {
    return currentUser && tournament && Number(currentUser.id) === Number(tournament.creator_id)
  }, [currentUser, tournament])

  const isJoined = useMemo(() => {
    return currentUser && tournament && tournament.participants?.some(
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
      stats[user_id] = { userId: user_id, wins: 0, matches: 0 }
    })

    if (tournament.matches) {
      tournament.matches.forEach((m) => {
        if (m.player1_id != null && stats[m.player1_id]) stats[m.player1_id].matches++
        if (m.player2_id != null && stats[m.player2_id]) stats[m.player2_id].matches++
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
        points: s.wins,
      }
    })

    entries.sort((a, b) => b.points - a.points)
    return entries
  }, [tournament, profiles])

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
    if (!tournamentId) return
    let cancelled = false

    async function fetchTournament() {
      setLoading(true)
      setError('')

      try {
        const resp = await apiCall(`/api/game/tournaments/${tournamentId}`)
        if (!resp.ok) {
          if (resp.status === 404) throw new Error('Tournament not found')
          throw new Error('Failed to load tournament')
        }

        const data = await resp.json()
        if (cancelled) return
        setTournament(data)

        const uniqueUserIds = [...new Set(data.participants.map((p) => p.user_id))]
        const profileEntries = {}

        await Promise.all(
          uniqueUserIds.map(async (uid) => {
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

        if (!cancelled) setProfiles(profileEntries)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchTournament()
    return () => {
      cancelled = true
    }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId || !auth?.access_token) return

    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${scheme}//${window.location.host}/api/game/ws/tournament/${tournamentId}?token=${auth.access_token}`

    const ws = createWsClient(url, {
      onOpen: () => {
        console.log(`[Tournament WS] connected: ${tournamentId}`)
      },

      onClose: () => {
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

        if (type === 'match_start') {
          if (!currentUser) return

          const isMyMatch =
            Number(currentUser.id) === Number(data.player1_id) ||
            Number(currentUser.id) === Number(data.player2_id)

          if (!isMyMatch) return

          const opponentId =
            Number(currentUser.id) === Number(data.player1_id)
              ? Number(data.player2_id)
              : Number(data.player1_id)

          const opponentProfile = profiles[opponentId] || {}

          navigate(`/game/waiting/${data.game_room_id}`, {
            replace: true,
            state: {
              currentUser: {
                id: currentUser.id,
                username: currentUser.username,
                avatarUrl: profiles[currentUser.id]?.avatarUrl || '/avatar_placeholder.jpg',
              },
              opponent: {
                id: opponentId,
                username: opponentProfile.username || `User ${opponentId}`,
                avatarUrl: opponentProfile.avatarUrl || '/avatar_placeholder.jpg',
              },
              player1_id: Number(data.player1_id),
              player2_id: Number(data.player2_id),
              matchId: Number(data.match_id),
              tournamentId: Number(tournamentId),
              tournamentMatchId: Number(data.tournament_match_id),
            },
          })
          return
        }

        if (type !== 'tournament_updated' && type !== 'tournament_complete') {
          return
        }

        try {
          const resp = await apiCall(`/api/game/tournaments/${tournamentId}`)
          if (!resp.ok) return

          const freshData = await resp.json()
          setTournament(freshData)
          setStartError('')

          const ids = [...new Set(freshData.participants.map((p) => p.user_id))]
          const newEntries = {}

          await Promise.all(
            ids.map(async (uid) => {
              try {
                const res = await apiCall(`/api/users/profile/${uid}`)
                if (!res.ok) throw new Error('Profile fetch failed')
                const p = await res.json()

                newEntries[uid] = {
                  username: p.display_name || p.username || `User ${uid}`,
                  avatarUrl: p.avatar_url || '/avatar_placeholder.jpg',
                }
              } catch {
                newEntries[uid] = {
                  username: `User ${uid}`,
                  avatarUrl: '/avatar_placeholder.jpg',
                }
              }
            }),
          )

          setProfiles((prev) => ({ ...prev, ...newEntries }))
        } catch {
          // ignore websocket refresh errors
        }
      },
    })

    wsRef.current = ws

    return () => {
      ws.close()
    }
  }, [tournamentId, auth?.access_token, currentUser, navigate, profiles])

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

    wsRef.current.send({
      type: 'ready',
      match_id: Number(match.id),
    })
  }

  const matchesByRound = useMemo(() => {
    const map = {}

    if (tournament?.matches) {
      for (const m of tournament.matches) {
        const r = m.round ?? 0
        map[r] = map[r] || []
        map[r].push(m)
      }
    }

    return Object.entries(map)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([round, list]) => ({
        round: Number(round),
        matches: list.sort((a, b) => a.position - b.position),
      }))
  }, [tournament])

  function renderMatchCell(match) {
    const { player1_id, player2_id, winner_id, status } = match
    const p1 = player1_id != null ? profiles[player1_id] : null
    const p2 = player2_id != null ? profiles[player2_id] : null
    const winner = winner_id != null ? profiles[winner_id] : null

    const isCurrentUsersMatch =
      currentUser &&
      status === 'in_progress' &&
      (Number(player1_id) === Number(currentUser.id) ||
        Number(player2_id) === Number(currentUser.id))

    const currentUserReady = Boolean(readyByMatch[match.id]?.[currentUser?.id])

    const opponentId =
      Number(currentUser?.id) === Number(player1_id) ? player2_id : player1_id

    const opponentIsReady = Boolean(readyByMatch[match.id]?.[opponentId])

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
          <span className="tournament-player-name">{p1?.username || 'TBD'}</span>
        </div>

        <div className="tournament-vs">vs</div>

        <div className="tournament-player">
          <img
            src={p2?.avatarUrl || '/avatar_placeholder.jpg'}
            alt="player2 avatar"
            className="tournament-avatar"
          />
          <span className="tournament-player-name">{p2?.username || 'TBD'}</span>
        </div>

        {isCurrentUsersMatch && (
          <div className="mt-3 d-flex flex-column gap-2">
            <button
              type="button"
              className="arcade-btn arcade-btn-primary"
              onClick={() => handleReadyForMatch(match)}
              disabled={currentUserReady}
            >
              {currentUserReady ? 'Ready locked' : 'Ready for Match'}
            </button>

            {opponentIsReady && (
              <span className="arcade-copy">Opponent is ready.</span>
            )}
          </div>
        )}

        {status === 'finished' && (
          <div className="tournament-winner">
            Winner: <strong>{winner?.username || 'Unknown'}</strong>
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
                        <th>Player</th>
                        <th>Wins</th>
                        <th>Matches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((row) => (
                        <tr key={row.userId}>
                          <td className="d-flex align-items-center gap-2">
                            <img
                              src={row.avatarUrl || '/avatar_placeholder.jpg'}
                              alt={row.username}
                              style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                            />
                            <span>{row.username}</span>
                          </td>
                          <td>{row.wins}</td>
                          <td>{row.matches}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="tournament-bracket">
              {matchesByRound.length === 0 && (
                <p className="arcade-copy">No matches scheduled yet.</p>
              )}

              {matchesByRound.length > 0 && (
                <div className="bracket-rounds">
                  {matchesByRound.map(({ round, matches }) => (
                    <div className="bracket-round" key={round}>
                      <h3 className="arcade-section-title mb-3">Round {round}</h3>
                      <div className="bracket-matches">
                        {matches.map((match) => renderMatchCell(match))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import { apiCall, apiJson } from '../utils/apiClient'
import { useAuth } from '../context/authContext'
import { createWsClient } from '../utils/wsClient'
import './Tournament.css'

/**
 * Tournament page
 *
 * This component displays the state of a tournament and its bracket. It
 * fetches tournament details from the game service and resolves
 * participant profiles from the user service. The page is tolerant of
 * missing data (e.g. unknown avatars) by falling back to placeholders. When
 * the authenticated user is the tournament creator and the lobby is full,
 * a Start Tournament button is shown to trigger the bracket creation.
 * Matches are grouped by round and rendered as columns. For now scores
 * are not displayed because the match schema does not expose them; finished
 * matches simply show the winner.
 */
export default function Tournament() {
  const { id: tournamentId } = useParams()
  const navigate = useNavigate()
  const { auth } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tournament, setTournament] = useState(null)
  const [profiles, setProfiles] = useState({})
  const [currentUser, setCurrentUser] = useState(null)
  const wsRef = useRef(null)

  // Derived flags to know if the authenticated user created or joined this tournament.
  const isCreator = useMemo(() => {
    return currentUser && tournament && Number(currentUser.id) === Number(tournament.creator_id)
  }, [currentUser, tournament])

  const isJoined = useMemo(() => {
    return currentUser && tournament && tournament.participants?.some((p) => Number(p.user_id) === Number(currentUser.id))
  }, [currentUser, tournament])

  const activeUserMatch = useMemo(() => {
    if (!tournament?.matches || !currentUser) return null
    return tournament.matches.find((match) => {
      if (match.status === 'finished') return false
      const involvesCurrentUser = Number(match.player1_id) === Number(currentUser.id) || Number(match.player2_id) === Number(currentUser.id)
      return involvesCurrentUser && match.player1_id != null && match.player2_id != null
    }) || null
  }, [tournament, currentUser])

  // Compute a simple leaderboard based on finished matches.  Each win is worth one
  // point.  The number of matches played is counted for context.  Entries are
  // sorted descending by points.
  const leaderboard = useMemo(() => {
    if (!tournament || !tournament.participants) return []
    const stats = {}
    // Initialize stats for all participants
    tournament.participants.forEach(({ user_id }) => {
      stats[user_id] = { userId: user_id, wins: 0, matches: 0 }
    })
    // Tally matches and wins
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

  // Allow the creator to cancel the tournament (delete) and participants to leave
  async function handleCancel() {
    if (!tournamentId) return
    try {
      await apiJson(`/api/game/tournaments/${tournamentId}`, { method: 'DELETE' })
      // Remove from localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('myTournaments') || '[]')
        const idx = stored.indexOf(Number(tournamentId))
        if (idx >= 0) {
          stored.splice(idx, 1)
          localStorage.setItem('myTournaments', JSON.stringify(stored))
        }
      } catch {
        /* ignore */
      }
      navigate('/tournaments')
    } catch (err) {
      setError(err.message || 'Failed to cancel tournament')
    }
  }

  async function handleLeave() {
    if (!tournamentId) return
    try {
      await apiJson(`/api/game/tournaments/${tournamentId}/leave`, { method: 'POST' })
      try {
        const stored = JSON.parse(localStorage.getItem('myTournaments') || '[]')
        const idx = stored.indexOf(Number(tournamentId))
        if (idx >= 0) {
          stored.splice(idx, 1)
          localStorage.setItem('myTournaments', JSON.stringify(stored))
        }
      } catch {
        /* ignore */
      }
      navigate('/tournaments')
    } catch (err) {
      setError(err.message || 'Failed to leave tournament')
    }
  }

  async function handleForfeitMatch() {
    if (!tournamentId || !activeUserMatch) return

    const opponentId = Number(activeUserMatch.player1_id) === Number(currentUser?.id)
      ? activeUserMatch.player2_id
      : activeUserMatch.player1_id

    if (!opponentId) {
      setError('Could not determine the opponent for this match')
      return
    }

    try {
      const scoreP1 = Number(activeUserMatch.player1_id) === Number(opponentId) ? 7 : 0
      const scoreP2 = Number(activeUserMatch.player2_id) === Number(opponentId) ? 7 : 0
      const data = await apiJson(`/api/game/tournaments/${tournamentId}/matches/${activeUserMatch.match_id}/result`, {
        method: 'POST',
        body: JSON.stringify({
          winner_id: opponentId,
          score_p1: scoreP1,
          score_p2: scoreP2,
        }),
      })
      setTournament(data)
    } catch (err) {
      setError(err.message || 'Failed to forfeit match')
    }
  }

  function handlePlayMatch() {
    if (!tournamentId || !activeUserMatch) return
    navigate(`/game/tournament-${tournamentId}-match-${activeUserMatch.match_id}`, {
      state: {
        player1_id: activeUserMatch.player1_id,
        player2_id: activeUserMatch.player2_id,
        tournamentId,
        tournamentMatchId: activeUserMatch.match_id,
      },
    })
  }

  // Fetch current user details (id and username) so we can gate actions.
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
      } catch (e) {
        if (!cancelled) setCurrentUser(null)
      }
    }
    loadMe()
    return () => { cancelled = true }
  }, [auth?.access_token])

  // Fetch tournament details whenever the ID changes.
  useEffect(() => {
    if (!tournamentId) return
    let cancelled = false
    async function fetchTournament() {
      setLoading(true)
      setError('')
      try {
        const resp = await apiCall(`/api/game/tournaments/${tournamentId}`)
        if (!resp.ok) {
          if (resp.status === 404) {
            throw new Error('Tournament not found')
          }
          throw new Error('Failed to load tournament')
        }
        const data = await resp.json()
        if (cancelled) return
        setTournament(data)
        // Resolve participant profiles concurrently
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
          })
        )
        if (!cancelled) setProfiles(profileEntries)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchTournament()
    return () => { cancelled = true }
  }, [tournamentId])

  // Optional: listen for tournament updates via websocket. This attempts to
  // connect to /api/game/ws/tournament/{tournamentId}?token=<access_token>
  // and re-fetch tournament data when tournament_updated or tournament_complete
  // events are received. If the backend does not expose this endpoint, the
  // connection will fail silently and no updates will be received.
  useEffect(() => {
    if (!tournamentId || !auth?.access_token) return
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${scheme}//${window.location.host}/api/game/ws/tournament/${tournamentId}?token=${auth.access_token}`
    const ws = createWsClient(url, {
      onMessage: async (data) => {
        if (!data || typeof data !== 'object') return
        const { type, tournament_id } = data
        if ((type === 'tournament_updated' || type === 'tournament_complete') &&
          String(tournament_id) === String(tournamentId)) {
          try {
            const resp = await apiCall(`/api/game/tournaments/${tournamentId}`)
            if (!resp.ok) return
            const freshData = await resp.json()
            setTournament(freshData)
            // Merge new participant profiles.  Only fetch missing ones.
            const ids = freshData.participants.map((p) => p.user_id)
            const missingIds = ids.filter((uid) => !profiles[uid])
            if (missingIds.length > 0) {
              const newEntries = {}
              await Promise.all(
                missingIds.map(async (uid) => {
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
                })
              )
              setProfiles((prev) => ({ ...prev, ...newEntries }))
            }
          } catch {
            /* swallow errors; ignore update */
          }
        }
      },
    })
    wsRef.current = ws
    return () => {
      ws.close()
    }
  }, [tournamentId, auth?.access_token, profiles])

  // Derived flag: can the current user start the tournament?
  const canStart = useMemo(() => {
    if (!tournament || !currentUser) return false
    return (
      tournament.status === 'open' &&
      tournament.participants?.length === tournament.max_participants &&
      Number(currentUser.id) === Number(tournament.creator_id)
    )
  }, [tournament, currentUser])

  async function handleStartTournament() {
    if (!tournamentId) return
    try {
      const resp = await apiJson(`/api/game/tournaments/${tournamentId}/start`, {
        method: 'POST',
      })
      setTournament(resp)
    } catch (err) {
      setError(err.message || 'Failed to start tournament')
    }
  }

  // Group matches by round for easier rendering
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
      .map(([round, list]) => ({ round: Number(round), matches: list.sort((a, b) => a.position - b.position) }))
  }, [tournament])

  // Render a single match cell. Handles missing players and winners gracefully.
  function renderMatchCell(match) {
    const { player1_id, player2_id, winner_id, status } = match
    const p1 = player1_id != null ? profiles[player1_id] : null
    const p2 = player2_id != null ? profiles[player2_id] : null
    const winner = winner_id != null ? profiles[winner_id] : null
    return (
      <div
        key={match.id || `${match.round}-${match.position}`}
        className={`tournament-match-cell ${status === 'finished' ? 'finished' : ''}`}
      >
        <div className="tournament-player">
          <img src={p1?.avatarUrl || '/avatar_placeholder.jpg'} alt="player1 avatar" className="tournament-avatar" />
          <span className="tournament-player-name">{p1?.username || 'TBD'}</span>
        </div>
        <div className="tournament-vs">vs</div>
        <div className="tournament-player">
          <img src={p2?.avatarUrl || '/avatar_placeholder.jpg'} alt="player2 avatar" className="tournament-avatar" />
          <span className="tournament-player-name">{p2?.username || 'TBD'}</span>
        </div>
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
            {/* Header section */}
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-4">
              <div>
                <span className="arcade-display mb-3 d-inline-block">Tournament</span>
                <h1 className="arcade-title mb-2">{tournament?.name || 'Tournament'}</h1>
                <p className="arcade-copy mb-0">
                  {tournament?.participants?.length || 0} / {tournament?.max_participants} participants&nbsp;•&nbsp;
                  Status: {tournament?.status}
                </p>
              </div>
              <div className="d-flex flex-column align-items-start align-items-lg-end gap-2">
                {tournament?.status === 'open' && isJoined && !isCreator && (
                  <button
                    type="button"
                    className="arcade-btn arcade-btn-secondary"
                    onClick={handleLeave}
                  >
                    Leave Tournament
                  </button>
                )}
                {tournament?.status === 'open' && isCreator && (
                  <button
                    type="button"
                    className="arcade-btn arcade-btn-danger"
                    onClick={handleCancel}
                  >
                    Cancel Tournament
                  </button>
                )}
                {canStart && (
                  <button
                    type="button"
                    className="arcade-btn arcade-btn-primary"
                    onClick={handleStartTournament}
                  >
                    Start Tournament
                  </button>
                )}
                {tournament?.status === 'in_progress' && activeUserMatch && (
                  <>
                    <button
                      type="button"
                      className="arcade-btn arcade-btn-primary"
                      onClick={handlePlayMatch}
                    >
                      Play Match
                    </button>
                    <button
                      type="button"
                      className="arcade-btn arcade-btn-danger"
                      onClick={handleForfeitMatch}
                    >
                      Desist / Forfeit
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="arcade-btn arcade-btn-secondary"
                  onClick={() => navigate('/play')}
                >
                  Back to lobby
                </button>
              </div>
            </div>

            {/* Participants list */}
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
                {/* Fill empty slots with placeholders */}
                {Array.from(
                  { length: (tournament.max_participants || 0) - (tournament.participants?.length || 0) },
                ).map((_, idx) => (
                  <div className="participant-card placeholder" key={`placeholder-${idx}`}>
                    <div className="placeholder-avatar" />
                    <span className="participant-name">Waiting…</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Leaderboard */}
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

            {/* Bracket visualization */}
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
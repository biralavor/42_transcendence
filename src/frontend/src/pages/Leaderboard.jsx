import { useEffect, useMemo, useState } from 'react'
import NavbarComponent from '../Components/Navbar'

export default function Leaderboard() {
  const [entries, setEntries] = useState([])
  const [usernamesById, setUsernamesById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    // Flag to track whether the component has been unmounted.  We set this to
    // true in the cleanup function so asynchronous handlers can avoid
    // updating state after unmount.
    let cancelled = false

    async function loadLeaderboard() {
      // Always reset loading/error when starting a new fetch.  Only update
      // state if the effect hasn't been cancelled.
      if (!cancelled) {
        setLoading(true)
        setError('')
      }

      try {
        const leaderboardResp = await fetch('/api/game/leaderboard?limit=20', {
          signal: controller.signal,
        })
        if (!leaderboardResp.ok) {
          throw new Error('Could not load leaderboard data.')
        }

        const leaderboardData = await leaderboardResp.json()
        // Skip updates if the request was aborted or the effect was cancelled.
        if (controller.signal.aborted || cancelled) return
        setEntries(leaderboardData)

        const userIds = leaderboardData.map((row) => row.user_id)
        const uniqueUserIds = [...new Set(userIds)]

        const profileResults = await Promise.all(
          uniqueUserIds.map(async (userId) => {
            try {
              const profileResp = await fetch(`/api/users/profile/${userId}`, {
                signal: controller.signal,
              })
              if (!profileResp.ok) {
                return [userId, `Player ${userId}`]
              }
              const profile = await profileResp.json()
              return [userId, profile.username || `Player ${userId}`]
            } catch {
              return [userId, `Player ${userId}`]
            }
          })
        )

        if (controller.signal.aborted || cancelled) return
        setUsernamesById(Object.fromEntries(profileResults))
      } catch (requestError) {
        // Ignore abort errors; otherwise report a generic failure.  Avoid
        // updating state if the component has unmounted or the request was aborted.
        if (requestError.name !== 'AbortError' && !cancelled) {
          setError('Failed to load leaderboard from backend services.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadLeaderboard()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const summary = useMemo(() => {
    if (entries.length === 0) {
      return {
        highestPoints: 0,
        longestWins: 0,
        risingPlayer: 'No data',
      }
    }

    const highestPoints = entries[0]?.points ?? 0
    const longestWins = Math.max(...entries.map((entry) => entry.wins))
    const rising = entries.find((entry) => entry.rank > 1) ?? entries[0]

    return {
      highestPoints,
      longestWins,
      risingPlayer: usernamesById[rising.user_id] || `Player ${rising.user_id}`,
    }
  }, [entries, usernamesById])

  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="arcade-content py-4">
        <section className="arcade-screen">
          <div className="arcade-panel p-4 p-lg-5">
            {/* Header section */}
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-4">
              <div>
                <span className="arcade-display mb-3">Global scoreboard</span>
                <h1 className="arcade-title mb-2">Leaderboard</h1>
                <p className="arcade-copy mb-0">
                  Follow the players setting the pace of the arena, track win streaks, and keep your next climb in view.
                </p>
              </div>
              <div className="arcade-card soft">
                <p className="arcade-kicker mb-2">Today in the ranking</p>
                <p className="arcade-copy mb-0">12 active players • 5 live matches • next tournament at 21:00</p>
              </div>
            </div>

            {/* Highlighted metrics */}
            <div className="row g-4 mb-4">
              <div className="col-12 col-md-4">
                <article className="arcade-card h-100 text-center">
                  <p className="arcade-kicker mb-2">Highest points</p>
                  <div className="arcade-title mb-0" style={{ fontSize: '2.4rem' }}>{summary.highestPoints}</div>
                </article>
              </div>
              <div className="col-12 col-md-4">
                <article className="arcade-card h-100 text-center">
                  <p className="arcade-kicker mb-2">Most wins</p>
                  <div className="arcade-title mb-0" style={{ fontSize: '2.4rem' }}>{summary.longestWins}W</div>
                </article>
              </div>
              <div className="col-12 col-md-4">
                <article className="arcade-card h-100 text-center">
                  <p className="arcade-kicker mb-2">Rising player</p>
                  <div className="arcade-title mb-0" style={{ fontSize: '2rem' }}>{summary.risingPlayer}</div>
                </article>
              </div>
            </div>

            {/* Old-style rankings table */}
            <div className="leaderboard-table-shell">
              {loading && <p className="arcade-copy mb-0">Loading leaderboard...</p>}
              {!loading && error && <p className="arcade-copy mb-0 text-danger">{error}</p>}
              {!loading && !error && entries.length === 0 && (
                <p className="arcade-copy mb-0">No matches finished yet.</p>
              )}

              {!loading && !error && entries.length > 0 && (
                <div className="table-responsive">
                  <table className="leaderboard-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>W</th>
                        <th>L</th>
                        <th>GP</th>
                        <th>GF</th>
                        <th>GA</th>
                        <th>GD</th>
                        <th>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => {
                        const rowClass = entry.rank <= 3 ? `leaderboard-top-${entry.rank}` : ''
                        return (
                          <tr key={entry.user_id} className={rowClass}>
                            <td>#{entry.rank}</td>
                            <td>{usernamesById[entry.user_id] || `Player ${entry.user_id}`}</td>
                            <td>{entry.wins}</td>
                            <td>{entry.losses}</td>
                            <td>{entry.total_games}</td>
                            <td>{entry.goals_scored}</td>
                            <td>{entry.goals_conceded}</td>
                            <td>{entry.goal_difference}</td>
                            <td>{entry.points}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

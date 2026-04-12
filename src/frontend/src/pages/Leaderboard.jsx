import { useEffect, useMemo, useState } from 'react'
import NavbarComponent from '../Components/Navbar'

/**
 * @typedef {Object} LeaderboardEntry
 * @property {number} rank - The rank position
 * @property {number} total_games - Number of wins
 * @property {number} wins - Number of wins
 * @property {number} losses - Number of losses
 * @property {number} points - Total points
 * @property {number} user_id - User's unique identifier
 * @property {string} display_name - User's display name
 * @property {number} goals_scored - Total goals scored
 * @property {number} goals_conceded - Total goals conceded
 * @property {number} goal_difference - Goal difference (scored - conceded)
 */

/**
 * @typedef {Object} LeaderboardResponse
 * @property {number} page - Current page number
 * @property {number} last_page - Last page number
 * @property {number} per_page - Number of items per page
 * @property {number} total - Total number of items across all pages
 * @property {LeaderboardEntry[]} results - Array of leaderboard entries
 */

export default function Leaderboard() {
  /** @type {[LeaderboardResponse, React.Dispatch<React.SetStateAction<LeaderboardResponse>>]} */
  const [page, setPage] = useState({
    page: 0,
    last_page: 0,
    per_page: 0,
    total: 0,
    results: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const entries = page.results ?? [];
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
        setPage(leaderboardData)
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
    // TODO send this info on page from backend
    const highestPoints = Math.max(...entries.map((entry) => entry.points))
    const longestWins = Math.max(...entries.map((entry) => entry.wins))
    const minRank = Math.min(...entries.map((entry) => entry.rank))
    const rising = entries.reduce((acc, cur) => acc.rank < cur.rank ? acc : cur, entries[0]);
    return {
      highestPoints,
      longestWins,
      risingPlayer: rising.display_name || `Player ${rising.user_id}`,
    }
  }, [entries])

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
                        <th title='Player position in ranking'>Rank</th>
                        <th title='Player display name'>Player</th>
                        <th title='Wins'>W</th>
                        <th title='Losses'>L</th>
                        <th title='Games Played'>GP</th>
                        <th title='Goals For, that is goals scored'>GF</th>
                        <th title='Goals Against, that is goals conceded'>GA</th>
                        <th title='Goals Difference, that is the diference between scored and conceded'>GD</th>
                        <th>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => {
                        const rowClass = entry.rank <= 3 ? `leaderboard-top-${entry.rank}` : ''
                        return (
                          <tr key={entry.user_id} className={rowClass}>
                            <td>#{entry.rank}</td>
                            <td>{entry.display_name || `Player ${entry.user_id}`}</td>
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

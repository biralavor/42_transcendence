import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import { apiCall } from '../utils/apiClient'
import './Leaderboard.css'

/**
 * @typedef {Object} LeaderboardEntry
 * @property {number} rank - The rank position
 * @property {number} total_games - Number of total games played
 * @property {number} wins - Number of wins
 * @property {number} losses - Number of losses
 * @property {number} points - Total points
 * @property {number} user_id - User's unique identifier
 * @property {number} max_streak - Maximum winning streak achieved
 * @property {string} display_name - User's display name
 * @property {number} goals_scored - Total goals scored
 * @property {number} current_streak - Current winning streak
 * @property {number} goals_conceded - Total goals conceded
 * @property {number} goal_difference - Goal difference (scored - conceded)
 */

/**
 * @typedef {Object} StatWithName
 * @property {number} value - value of stats
 * @property {string} display_name - Display name of the user who achieved this
 */

/**
 * @typedef {Object} LeaderboardSummary
 * @property {StatWithName} max_points - User with maximum points
 * @property {StatWithName} max_max_streak - User with maximum streak achievement
 * @property {StatWithName} max_current_streak - User with maximum current streak
 */

/**
 * @typedef {Object} LeaderboardResponse
 * @property {number} page - Current page number
 * @property {number} last_page - Last page number
 * @property {number} per_page - Number of items per page
 * @property {number} total - Total number of items across all pages
 * @property {LeaderboardEntry[]} results - Array of leaderboard entries
 * @property {LeaderboardSummary } summary - Summary statistics for the leaderboard
 */

export default function Leaderboard() {
  /** @type {[LeaderboardResponse, React.Dispatch<React.SetStateAction<LeaderboardResponse>>]} */
  const [page, setPage] = useState({
    page: 0,
    last_page: 0,
    per_page: 0,
    total: 0,
    results: [],
    summary: {
      max_max_streak: {value: 0, display_name: 'No Data'},
      max_current_streak: {value: 0, display_name: 'No Data'},
      max_points: {value: 0, display_name: 'No Data'}
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortMode, setSortMode] = useState('xp')      // 'xp' | 'wins'
  const [currentPage, setCurrentPage] = useState(0)
  const [currentUserId, setCurrentUserId] = useState(null)

  const entries = page.results ?? [];
  const summary = page.summary ?? {
    max_max_streak: { value: 0, display_name: 'No Data' },
    max_current_streak: { value: 0, display_name: 'No Data' },
    max_points: { value: 0, display_name: 'No Data' },
  }

  // Fetch caller's user_id once on mount for row highlighting.
  // /leaderboard is a public route — use skipRefreshOn401 so logged-out
  // visitors don't get redirected to /login by the apiClient's refresh flow.
  useEffect(() => {
    apiCall('/api/users/auth/me', { skipRefreshOn401: true })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && typeof data.id === 'number') setCurrentUserId(data.id) })
      .catch(() => {})
  }, [])

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
        // Include tie-breakers so pagination is stable on equal values
        // (e.g., many users tied at 0 XP would otherwise shuffle between pages).
        const orderClause = `${sortMode}:desc,points:desc,goal_difference:desc,user_id:asc`
        const url = `/api/game/leaderboard?order=${encodeURIComponent(orderClause)}&page=${currentPage}&limit=20`
        const leaderboardResp = await fetch(url, {
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
  }, [sortMode, currentPage])

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
                  <div className="arcade-title mb-0" style={{ fontSize: '2.4rem' }}>
                    {summary.max_points.display_name}: {summary.max_points.value}
                  </div>
                </article>
              </div>
              <div className="col-12 col-md-4">
                <article className="arcade-card h-100 text-center">
                  <p className="arcade-kicker mb-2">Largest all-time win streak</p>
                  <div className="arcade-title mb-0" style={{ fontSize: '2.4rem' }}>
                    {summary.max_max_streak.display_name}: {summary.max_max_streak.value}
                  </div>
                </article>
              </div>
              <div className="col-12 col-md-4">
                <article className="arcade-card h-100 text-center">
                  <p className="arcade-kicker mb-2">Largest current win streak</p>
                  <div className="arcade-title mb-0" style={{ fontSize: '2rem' }}>
                    {summary.max_current_streak.display_name}: {summary.max_current_streak.value}
                  </div>
                </article>
              </div>
            </div>

            <div className="leaderboard-sort-toggle" role="group" aria-label="Sort leaderboard by">
              <button
                type="button"
                aria-pressed={sortMode === 'xp'}
                className={sortMode === 'xp' ? 'active' : ''}
                onClick={() => { setSortMode('xp'); setCurrentPage(0) }}
              >
                XP
              </button>
              <button
                type="button"
                aria-pressed={sortMode === 'wins'}
                className={sortMode === 'wins' ? 'active' : ''}
                onClick={() => { setSortMode('wins'); setCurrentPage(0) }}
              >
                Wins
              </button>
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
                        <th>W<span className="th-subtitle">Wins</span></th>
                        <th>L<span className="th-subtitle">Losses</span></th>
                        <th>GP<span className="th-subtitle">Games<br />Played</span></th>
                        <th>GF<span className="th-subtitle">Goals<br />For</span></th>
                        <th>GA<span className="th-subtitle">Goals<br />Against</span></th>
                        <th>GD<span className="th-subtitle">Goal<br />Difference</span></th>
                        <th>Pts<span className="th-subtitle">Points</span></th>
                        <th>MWS<span className="th-subtitle">Max Win<br />Streak</span></th>
                        <th>CWS<span className="th-subtitle">Current<br />Win Streak</span></th>
                        <th>Lvl<span className="th-subtitle">Level</span></th>
                        <th>XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => {
                        const baseClass = entry.rank <= 3 ? `leaderboard-top-${entry.rank}` : ''
                        const isMe = currentUserId !== null && entry.user_id === currentUserId
                        const rowClass = [baseClass, isMe ? 'current-user-row' : ''].filter(Boolean).join(' ')
                        return (
                          <tr key={entry.user_id} className={rowClass}>
                            <td>#{entry.rank}</td>
                            <td>
                              <img
                                src={entry.avatar_url || '/avatar_placeholder.jpg'}
                                alt={`${entry.display_name || `Player ${entry.user_id}`} avatar`}
                                className="leaderboard-avatar"
                              />
                              <Link
                                to={`/profile/${entry.user_id}`}
                                className="leaderboard-username-link"
                              >
                                {entry.display_name || `Player ${entry.user_id}`}
                              </Link>
                            </td>
                            <td>{entry.wins}</td>
                            <td>{entry.losses}</td>
                            <td>{entry.total_games}</td>
                            <td>{entry.goals_scored}</td>
                            <td>{entry.goals_conceded}</td>
                            <td>{entry.goal_difference}</td>
                            <td>{entry.points}</td>
                            <td>{entry.max_streak}</td>
                            <td>{entry.current_streak}</td>
                            <td>{entry.level ?? '—'}</td>
                            <td>{entry.xp ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="leaderboard-pagination">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={page.page <= 0}
              >
                Previous
              </button>
              <span>
                Page {page.page + 1} of {page.last_page + 1} · {page.total} players total
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(page.last_page, p + 1))}
                disabled={page.page >= page.last_page}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

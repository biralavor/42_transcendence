import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import './GamesLive.css'
import { formatRank } from '../utils/formatRank'

const POLL_INTERVAL_MS = 5_000
const fmtName = (p) => p?.display_name || p?.username || '—'

function formatElapsed(startedAt) {
  if (!startedAt) return '--:--'
  const ms = Date.now() - new Date(startedAt).getTime()
  if (Number.isNaN(ms) || ms < 0) return '--:--'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function GamesLive() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    let inFlight = false

    async function tick() {
      if (inFlight) return
      inFlight = true
      try {
        const r = await fetch('/api/games/live')
        if (!r.ok) {
          if (!cancelled) {
            setError(`HTTP ${r.status}`)
            setLoading(false)
          }
          return
        }
        const body = await r.json()
        if (cancelled) return
        setGames(Array.isArray(body) ? body : [])
        setError(null)
        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'fetch failed')
          setLoading(false)
        }
      } finally {
        inFlight = false
      }
    }

    tick()
    const id = setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <>
      <NavbarComponent />
      <main className="arcade-content games-live-page">
        <header className="games-live-header">
          <h1 className="arcade-title">Live Games</h1>
          <p className="arcade-copy">
            Public list of currently-active matches. Click "Watch" to spectate
            in real time. No login required.
          </p>
        </header>

        {loading && games.length === 0 && (
          <p className="games-live-empty">Loading live games…</p>
        )}

        {!loading && error && games.length === 0 && (
          <p className="games-live-empty games-live-empty--error">
            Couldn't load live games. Retrying every 5 s.
          </p>
        )}

        {!loading && !error && games.length === 0 && (
          <p className="games-live-empty">No games being played right now.</p>
        )}

        {games.length > 0 && (
          <ul className="live-games-grid" aria-label="Live games">
            {games.map((g) => (
              <li key={g.game_id} className="live-game-card">
                <div className="live-game-players">
                  <div className="live-game-player">
                    <img
                      src={g.player1?.avatar_url || '/avatar_placeholder.jpg'}
                      alt=""
                      className="live-game-avatar"
                    />
                    <span className="live-game-name">
                      {fmtName(g.player1)}
                    </span>
                    <span className="live-game-rank">{formatRank(g.player1?.rank)}</span>
                  </div>

                  <span className="live-game-score">{g.score1 ?? 0} : {g.score2 ?? 0}</span>

                  <div className="live-game-player">
                    <img
                      src={g.player2?.avatar_url || '/avatar_placeholder.jpg'}
                      alt=""
                      className="live-game-avatar"
                    />
                    <span className="live-game-name">
                      {fmtName(g.player2)}
                    </span>
                    <span className="live-game-rank">{formatRank(g.player2?.rank)}</span>
                  </div>
                </div>

                <div className="live-game-meta">
                  <span className="live-game-elapsed" aria-label="elapsed time">
                    {formatElapsed(g.started_at)}
                  </span>
                  <span className="live-game-spectators">
                    👁 {g.spectator_count} watching
                  </span>
                </div>

                <Link
                  to={`/game/${g.game_id}?spectate=true`}
                  className="arcade-btn arcade-btn-primary live-game-watch"
                >
                  Watch
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}

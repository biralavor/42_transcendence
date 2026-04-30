import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './Home.css'
import NavbarComponent from '../Components/Navbar'
import { formatRank } from '../utils/formatRank'

const POLL_INTERVAL_MS = 5_000

const fmtName = (p) => p?.display_name || p?.username || '—'

function pickTopGame(games) {
  if (!Array.isArray(games) || games.length === 0) return null
  return games.reduce((best, g) => {
    if (best == null) return g
    if (g.spectator_count > best.spectator_count) return g
    if (g.spectator_count === best.spectator_count) {
      const ga = new Date(g.started_at).getTime()
      const ba = new Date(best.started_at).getTime()
      if (ga > ba) return g
    }
    return best
  }, null)
}

export default function Home() {
  const [topGame, setTopGame] = useState(null)

  useEffect(() => {
    let cancelled = false
    let inFlight = false
    async function tick() {
      if (inFlight) return
      inFlight = true
      try {
        const r = await fetch('/api/games/live')
        const games = r.ok ? await r.json() : []
        if (cancelled) return
        setTopGame(pickTopGame(games))
      } catch {
        if (!cancelled) setTopGame(null)
      } finally {
        inFlight = false
      }
    }
    tick()
    const id = setInterval(tick, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="home-page container-fluid">
        <section className="hero-section row">
          <div className="hero-screen arcade-screen col-12">
            <div className="arcade-panel row align-items-center g-4 g-lg-5">
              <div className="col-12 col-lg-6">
                <div className="hero-copy">
                  <span className="hero-badge arcade-display">42 ft_transcendence • retro arcade edition</span>

                  <h1 className="hero-title arcade-title">
                    Play Pong.
                    <br />
                    Compete &amp; rise.
                    <br />
                    Own the arena.
                  </h1>

                  <p className="hero-text arcade-copy">
                    A multiplayer Pong experience with a dark competitive vibe,
                    real matches, rankings, and a visual identity inspired by
                    classic arcade rooms.
                  </p>

                  <div className="hero-actions row d-flex flex-wrap gap-4">
                    <Link to="/play" className="arcade-btn arcade-btn-primary col-12 col-lg-6">
                      Play now
                    </Link>

                    <Link to="/leaderboard" className="arcade-btn arcade-btn-ghost col-12 col-lg-5">
                      View leaderboard
                    </Link>
                  </div>

                  <div className="hero-stats row mt-4 g-4">
                    <div className="col-12 col-lg-6">
                      <div className="stat-card p-4">
                        <span className="stat-value">24/7</span>
                        <span className="stat-label">Open arena</span>
                      </div>
                    </div>

                    <div className="col-12 col-lg-6">
                      <div className="stat-card p-4">
                        <span className="stat-value">Ranked</span>
                        <span className="stat-label">Competitive play</span>
                      </div>
                    </div>

                    <div className="col-12 col-lg-12">
                      <div className="stat-card p-4">
                        <span className="stat-value">Fast</span>
                        <span className="stat-label">Instant matches</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div className="arena-wrapper">
                  <div className="arena-card">
                    <div className="arena-topbar">
                      {topGame ? (
                        <Link
                          to={`/game/${topGame.game_id}?spectate=true`}
                          className="arena-pill arena-pill--live"
                        >
                          Live Match · {fmtName(topGame.player1)} vs {fmtName(topGame.player2)} · 👁 {topGame.spectator_count}
                        </Link>
                      ) : (
                        <span className="arena-pill arena-pill--idle">No live match</span>
                      )}
                      <span className="arena-score">
                        {topGame ? `${topGame.score1} : ${topGame.score2}` : '— : —'}
                      </span>
                    </div>

                    <div className="pong-preview">
                      <div className="paddle paddle-left"></div>
                      <div className="pong-ball"></div>
                      <div className="paddle paddle-right"></div>
                      <div className="center-line"></div>
                    </div>

                    <div className="arena-footer">
                      <div>
                        <p className="arena-player">
                          {topGame ? fmtName(topGame.player1) : '—'}
                        </p>
                        <span className="arena-rank">
                          {topGame ? formatRank(topGame.player1?.rank) : ''}
                        </span>
                      </div>

                      <div className="text-end">
                        <p className="arena-player">
                          {topGame ? fmtName(topGame.player2) : '—'}
                        </p>
                        <span className="arena-rank">
                          {topGame ? formatRank(topGame.player2?.rank) : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="side-panels">
                    <div className="info-panel">
                      <h3>Quick access</h3>
                      <ul>
                        <li>Start a casual match</li>
                        <li>Enter ranked queue</li>
                        <li>Track your performance</li>
                      </ul>
                    </div>

                    <div className="info-panel">
                      <h3>Today in the arena</h3>
                      <ul>
                        <li>12 active players</li>
                        <li>5 matches in progress</li>
                        <li>Next tournament at 21:00</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="features-section row g-4">
          <div className="col-12 col-md-6 col-xl-4">
            <article className="feature-card">
              <span className="feature-tag">01</span>
              <h2>Arcade energy</h2>
              <p>
                A dark interface with neon highlights and a competitive
                atmosphere inspired by classic Pong machines.
              </p>
            </article>
          </div>

          <div className="col-12 col-md-6 col-xl-4">
            <article className="feature-card">
              <span className="feature-tag">02</span>
              <h2>Instant competition</h2>
              <p>
                Jump into matches quickly, challenge opponents, and keep your
                focus on gameplay and progression.
              </p>
            </article>
          </div>

          <div className="col-12 col-md-6 col-xl-4">
            <article className="feature-card">
              <span className="feature-tag">03</span>
              <h2>Leaderboard mindset</h2>
              <p>
                Follow rankings, evolve your performance, and build a profile
                worthy of the ft_transcendence arena.
              </p>
            </article>
          </div>
        </section>

        <section className="cta-section row">
          <div className="cta-box col-12">
            <div>
              <p className="cta-kicker arcade-kicker">Ready to enter the arena?</p>
              <h2>Create your account and start your run.</h2>
            </div>

            <div className="d-flex flex-wrap gap-3">
              <Link to="/login" className="arcade-btn arcade-btn-primary">
                Sign in
              </Link>
              <Link to="/about" className="arcade-btn arcade-btn-secondary">
                Learn more
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

import { Link } from 'react-router-dom'
import './Home.css'
import NavbarComponent from '../Components/Navbar'

export default function Home() {
  return (
    <>
      <NavbarComponent />

      <main className="home-page">
        <section className="hero-section container-fluid px-4 px-lg-5">
          <div className="row align-items-center g-4 g-lg-5">
            <div className="col-12 col-lg-6">
              <div className="hero-copy">
                <span className="hero-badge">42 ft_transcendence • retro arcade edition</span>

                <h1 className="hero-title">
                  Play Pong.
                  <br />
                  Climb the ladder.
                  <br />
                  Own the arena.
                </h1>

                <p className="hero-text">
                  A multiplayer Pong experience with a dark competitive vibe,
                  real matches, rankings, and a visual identity inspired by
                  classic arcade rooms.
                </p>

                <div className="hero-actions d-flex flex-wrap gap-3">
                  <Link to="/play" className="btn btn-warning btn-lg hero-btn-primary">
                    Play now
                  </Link>

                  <Link to="/leaderboard" className="btn btn-outline-light btn-lg hero-btn-secondary">
                    View leaderboard
                  </Link>
                </div>

                <div className="hero-stats row g-3 mt-4">
                  <div className="col-12 col-sm-4">
                    <div className="stat-card">
                      <span className="stat-value">24/7</span>
                      <span className="stat-label">Open arena</span>
                    </div>
                  </div>

                  <div className="col-12 col-sm-4">
                    <div className="stat-card">
                      <span className="stat-value">Ranked</span>
                      <span className="stat-label">Competitive play</span>
                    </div>
                  </div>

                  <div className="col-12 col-sm-4">
                    <div className="stat-card">
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
                    <span className="arena-pill">Live match</span>
                    <span className="arena-score">08 : 06</span>
                  </div>

                  <div className="pong-board">
                    <div className="paddle paddle-left"></div>
                    <div className="pong-ball"></div>
                    <div className="paddle paddle-right"></div>
                    <div className="center-line"></div>
                  </div>

                  <div className="arena-footer">
                    <div>
                      <p className="arena-player">bgomes-l</p>
                      <span className="arena-rank">Rank #04</span>
                    </div>

                    <div className="text-end">
                      <p className="arena-player">opponent_42</p>
                      <span className="arena-rank">Rank #09</span>
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
        </section>

        <section className="features-section container-fluid px-4 px-lg-5">
          <div className="row g-4">
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
          </div>
        </section>

        <section className="cta-section container-fluid px-4 px-lg-5">
          <div className="cta-box">
            <div>
              <p className="cta-kicker">Ready to enter the arena?</p>
              <h2>Create your account and start your run.</h2>
            </div>

            <div className="d-flex flex-wrap gap-3">
              <Link to="/login" className="btn btn-light btn-lg">
                Sign in
              </Link>
              <Link to="/about" className="btn btn-outline-light btn-lg">
                Learn more
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
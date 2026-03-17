import NavbarComponent from '../Components/Navbar'
import { Link } from 'react-router-dom'

export default function About() {
  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="arcade-content py-4">
        {/* Intro section */}
        <section className="about-intro arcade-screen mb-4">
          <div className="arcade-panel p-4 p-lg-5 text-center">
            <span className="arcade-display mb-3 d-block">From 1972 to 2026</span>
            <h1 className="arcade-title mb-3">The classic that started it all</h1>
            <p className="arcade-copy mb-0">
              Pong was launched by Atari in 1972 as a deceptively simple training project and became the first
              commercially successful arcade video game. Our ft_transcendence concept keeps that unmistakable gameplay
              spirit while translating the cabinet look, scoreboard rhythm, and competitive loop into a modern web
              platform.
            </p>
          </div>
        </section>

        {/* Details grid */}
        <section className="about-details mb-4">
          <div className="row g-4">
            <div className="col-12 col-lg-4">
              <article className="about-card h-100">
                <h2 className="about-card-title">Why Pong matters</h2>
                <ul className="about-list">
                  <li>🎯 It proved arcade games could become a real business.</li>
                  <li>⚡ Immediate rules: two paddles, one ball, total focus.</li>
                  <li>🚀 It sparked generations of multiplayer and competitive games.</li>
                  <li>🕹️ Its visual language remains iconic after five decades.</li>
                </ul>
              </article>
            </div>

            <div className="col-12 col-lg-4">
              <article className="about-card h-100">
                <h2 className="about-card-title">Visual direction</h2>
                <ul className="about-list">
                  <li>✨ Dark CRT screens with subtle glow.</li>
                  <li>🌳 Warm wood panels and tactile textures.</li>
                  <li>🌟 Bright yellow highlights for key elements.</li>
                  <li>🎮 Scoreboard typography that feels playful yet competitive.</li>
                </ul>
              </article>
            </div>

            <div className="col-12 col-lg-4">
              <article className="about-card h-100">
                <h2 className="about-card-title">Platform pillars</h2>
                <ul className="about-list">
                  <li>🏟️ <strong>Arena</strong> – Local and online matches inspired by classic cabinets.</li>
                  <li>📈 <strong>Ranking</strong> – Scoreboard‑first progression and visible competition.</li>
                  <li>👤 <strong>Profile</strong> – Identity, stats, match history and preferences.</li>
                  <li>💬 <strong>Community</strong> – Social features, chat and quick session access.</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* Call to action */}
        <section className="about-cta">
          <div className="arcade-card soft text-center p-4 p-lg-5">
            <h2 className="about-card-title mb-2">Ready to play?</h2>
            <p className="arcade-copy mb-4">Create your account and step into the arena.</p>
            <div className="d-flex flex-wrap gap-3 justify-content-center">
              <Link to="/register" className="arcade-btn arcade-btn-primary">
                Join
              </Link>
              <Link to="/login" className="arcade-btn arcade-btn-secondary">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

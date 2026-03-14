import NavbarComponent from '../Components/Navbar'

export default function About() {
  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="arcade-content py-4">
        <section className="arcade-screen">
          <div className="arcade-panel p-4 p-lg-5">
            <span className="arcade-display mb-3">From 1972 to 2026</span>
            <h1 className="arcade-title">The classic that started it all</h1>
            <p className="arcade-copy mb-4">
              Pong was launched by Atari in 1972 as a deceptively simple training project and became the first
              commercially successful arcade video game. Our ft_transcendence concept keeps that unmistakable gameplay
              spirit while translating the cabinet look, scoreboard rhythm, and competitive loop into a modern web
              platform.
            </p>

            <div className="row g-4 mb-4">
              <div className="col-12 col-lg-6">
                <article className="arcade-card h-100">
                  <h2 className="arcade-section-title">Why Pong matters</h2>
                  <ul className="arcade-list mb-0">
                    <li>It proved arcade games could become a real business.</li>
                    <li>Its rules are immediate: two paddles, one ball, total focus.</li>
                    <li>It inspired generations of multiplayer games and competitive score chasing.</li>
                    <li>Its visual language still feels iconic more than fifty years later.</li>
                  </ul>
                </article>
              </div>

              <div className="col-12 col-lg-6">
                <article className="arcade-card soft h-100">
                  <h2 className="arcade-section-title">Our visual direction</h2>
                  <p className="arcade-copy mb-3">
                    The interface is inspired by 70s arcade cabinets: dark CRT screens, warm wood panels, bright yellow
                    marquee highlights, and scoreboard typography that feels tactile and playful.
                  </p>
                  <div className="arcade-grid">
                    <span className="arcade-chip">Arcade yellow highlights</span>
                    <span className="arcade-chip">CRT inspired screen treatment</span>
                    <span className="arcade-chip">Competitive retro scoreboard</span>
                  </div>
                </article>
              </div>
            </div>

            <div className="arcade-card">
              <h2 className="arcade-section-title">What the platform brings together</h2>
              <div className="row g-3">
                <div className="col-12 col-md-6 col-xl-3"><p className="arcade-copy mb-0"><strong>Arena.</strong> Local and online matches inspired by classic Pong cabinets.</p></div>
                <div className="col-12 col-md-6 col-xl-3"><p className="arcade-copy mb-0"><strong>Ranking.</strong> Scoreboard-first progression and visible competition.</p></div>
                <div className="col-12 col-md-6 col-xl-3"><p className="arcade-copy mb-0"><strong>Profile.</strong> Identity, stats, match history, and player preferences.</p></div>
                <div className="col-12 col-md-6 col-xl-3"><p className="arcade-copy mb-0"><strong>Community.</strong> Social features, chat, and quick access to multiplayer sessions.</p></div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

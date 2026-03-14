import NavbarComponent from '../Components/Navbar'
import PongCanvas from '../Components/PongCanvas'

const matchModes = [
  {
    title: 'Local versus',
    description: 'Share one keyboard and play quick rounds with the classic left paddle versus right paddle setup.',
  },
  {
    title: 'Online queue',
    description: 'Join the arena, get matched fast, and push your score up the ranking table.',
  },
  {
    title: 'Training mode',
    description: 'Warm up before ranked games, test control sensitivity, and keep your timing sharp.',
  },
]

export default function Play() {
  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="arcade-content py-4">
        <section className="arcade-screen">
          <div className="arcade-panel p-4 p-lg-5">
            <span className="arcade-display mb-3">Arena access</span>
            <h1 className="arcade-title">Play</h1>
            <p className="arcade-copy mb-4">
              This area is designed as the match lobby for the project: launch a quick local game, step into the online
              queue, or use the training mode before entering competitive play.
            </p>

            <div className="arcade-card soft mb-4">
              <div className="row g-4 align-items-center">
                <div className="col-12 col-lg-7">
                  <div className="pong-board" style={{ height: '320px' }}>
                    <div className="paddle paddle-left"></div>
                    <div className="pong-ball"></div>
                    <div className="paddle paddle-right"></div>
                    <div className="center-line"></div>
                  </div>
                </div>
                <div className="col-12 col-lg-5">
                  <h2 className="arcade-section-title">How this page can evolve</h2>
                  <ul className="arcade-list mb-0">
                    <li>Matchmaking status and room creation.</li>
                    <li>Local and online match launch controls.</li>
                    <li>Player ready states and game configuration.</li>
                    <li>Shortcuts to chat, profile, and ranking.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="row g-4">
              {matchModes.map((mode) => (
                <div className="col-12 col-lg-4" key={mode.title}>
                  <article className="arcade-card h-100">
                    <h2 className="arcade-section-title">{mode.title}</h2>
                    <p className="arcade-copy mb-0">{mode.description}</p>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}


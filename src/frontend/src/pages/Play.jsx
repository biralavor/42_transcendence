import { useNavigate } from 'react-router-dom'
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

const quickActions = [
  'Open a private room and invite a friend.',
  'Get both players ready before the match starts.',
  'Jump from chat to match flow without leaving the arcade.',
]

export default function Play() {
  const navigate = useNavigate()

  function handleOpenWaitingRoom() {
    navigate('/game/waiting/test-room', {
      state: {
        currentUser: {
          id: 1,
          username: 'Bruno',
          avatarUrl: '/avatar_placeholder.jpg',
        },
        opponent: {
          id: 2,
          username: 'RemotePlayer',
          avatarUrl: '/avatar_placeholder.jpg',
        },
        friendId: 2,
        friendUsername: 'RemotePlayer',
      },
    })
  }

  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="arcade-content py-4">
        <section className="arcade-screen">
          <div className="arcade-panel p-4 p-lg-5">
            <div className="row g-4 align-items-center mb-4">
              <div className="col-12 col-xl-7">
                <span className="arcade-display mb-3 d-inline-block">Arena access</span>
                <h1 className="arcade-title mb-3">Choose your next match</h1>
                <p className="arcade-copy mb-4">
                  Enter the arcade floor, test your reflexes, and prepare for remote play. This lobby is the bridge
                  between classic Pong action and the new invite plus waiting-room flow.
                </p>

                <div className="d-flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="arcade-btn arcade-btn-primary"
                    onClick={handleOpenWaitingRoom}
                  >
                    <PongCanvas player1Kind='local' player2Kind='local' />
                  </div>
                    Test waiting room
                  </button>

                  <a href="#match-modes" className="arcade-btn arcade-btn-secondary">
                    View modes
                  </a>
                </div>
              </div>

              <div className="col-12 col-xl-5">
                <div className="arcade-card soft h-100 p-4">
                  <h2 className="arcade-section-title mb-3">Remote play preview</h2>
                  <p className="arcade-copy mb-3">
                    This page will evolve into the entry point for invitations, room setup, ready states, and match
                    launch.
                  </p>

                  <ul className="arcade-list mb-0">
                    {quickActions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="arcade-card soft p-3 p-lg-4 mb-4">
              <div className="row g-4 align-items-start">
                <div className="col-12 col-xl-8">
                  <div className="pong-board">
                    <PongCanvas />
                  </div>
                </div>

                <div className="col-12 col-xl-4">
                  <div className="h-100 d-flex flex-column justify-content-between">
                    <div>
                      <h2 className="arcade-section-title mb-3">Live board</h2>
                      <p className="arcade-copy mb-3">
                        A playable preview keeps the page active and reinforces the arcade identity while the complete
                        multiplayer flow is being integrated.
                      </p>
                    </div>

                    <div className="arcade-card p-3">
                      <span className="arcade-display mb-2 d-inline-block">Current focus</span>
                      <ul className="arcade-list mb-0">
                        <li>Game invite entry points</li>
                        <li>Waiting room route and UI</li>
                        <li>Ready and cancel actions</li>
                        <li>Backend websocket integration</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div id="match-modes" className="row g-4">
              {matchModes.map((mode) => (
                <div className="col-12 col-md-6 col-xl-4" key={mode.title}>
                  <article className="arcade-card h-100 p-4">
                    <span className="arcade-display mb-2 d-inline-block">Mode</span>
                    <h2 className="arcade-section-title mb-3">{mode.title}</h2>
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
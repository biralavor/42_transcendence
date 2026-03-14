import NavbarComponent from '../Components/Navbar'

const topPlayers = [
  { rank: 1, player: 'vector_viper', wins: 128, streak: '12W', score: 9820 },
  { rank: 2, player: 'pongmaster42', wins: 121, streak: '7W', score: 9450 },
  { rank: 3, player: 'crt-champion', wins: 113, streak: '5W', score: 9010 },
  { rank: 4, player: 'bgomes-l', wins: 108, streak: '3W', score: 8785 },
  { rank: 5, player: 'pixelspin', wins: 98, streak: '2W', score: 8420 },
]

export default function Leaderboard() {
  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="arcade-content py-4">
        <section className="arcade-screen">
          <div className="arcade-panel p-4 p-lg-5">
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

            <div className="row g-4 mb-4">
              <div className="col-12 col-md-4">
                <article className="arcade-card h-100 text-center">
                  <p className="arcade-kicker mb-2">Highest score</p>
                  <div className="arcade-title mb-0" style={{ fontSize: '2.4rem' }}>9820</div>
                </article>
              </div>
              <div className="col-12 col-md-4">
                <article className="arcade-card h-100 text-center">
                  <p className="arcade-kicker mb-2">Longest streak</p>
                  <div className="arcade-title mb-0" style={{ fontSize: '2.4rem' }}>12W</div>
                </article>
              </div>
              <div className="col-12 col-md-4">
                <article className="arcade-card h-100 text-center">
                  <p className="arcade-kicker mb-2">Rising player</p>
                  <div className="arcade-title mb-0" style={{ fontSize: '2rem' }}>bgomes-l</div>
                </article>
              </div>
            </div>

            <div className="arcade-card arcade-table-wrap">
              <table className="arcade-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Wins</th>
                    <th>Streak</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {topPlayers.map((player) => (
                    <tr key={player.rank}>
                      <td>#{player.rank}</td>
                      <td>{player.player}</td>
                      <td>{player.wins}</td>
                      <td><span className="arcade-chip">{player.streak}</span></td>
                      <td>{player.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

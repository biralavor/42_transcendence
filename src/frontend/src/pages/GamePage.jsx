import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import PongCanvasMultiplayer from '../Components/PongCanvasMultiplayer'
import './GamePage.css'
import { apiJson } from '../utils/apiClient'

export default function GamePage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const player1Id = location.state?.player1_id || location.state?.currentUser?.id
  const player2Id = location.state?.player2_id || location.state?.opponent?.id
  const tournamentId = location.state?.tournamentId
  const matchId = location.state?.matchId
  const tournamentMatchId = location.state?.tournamentMatchId
  const [submittingResult, setSubmittingResult] = useState(false)

  useEffect(() => {
    if (!roomId || !player1Id || !player2Id) {
      navigate('/play')
    }
  }, [roomId, player1Id, player2Id, navigate])

  if (!roomId || !player1Id || !player2Id) {
    return null
  }

  async function handleGameEnd(result) {
    console.log('Game ended:', result)

    if (tournamentId && matchId && !submittingResult) {
      setSubmittingResult(true)
      try {
        await apiJson(`/api/game/tournaments/${tournamentId}/matches/${matchId}/result`, {
          method: 'POST',
          body: JSON.stringify(result),
        })
        navigate(`/tournaments/${tournamentId}`, { replace: true })
        return
      } catch (error) {
        console.error('Failed to submit tournament result:', error)
        navigate(`/tournaments/${tournamentId}`, { replace: true })
        return
      } finally {
        setSubmittingResult(false)
      }
    }

    navigate('/play', {
      state: {
        gameResult: result,
      },
    })
  }

return (
    <>
      <NavbarComponent />
      <main className="arcade-content game-page">
        <section className="arcade-screen game-page-screen">
          <div className="arcade-panel game-page-panel">
            <div className="game-page-header">
              <span className="arcade-display game-page-kicker">Live Match</span>
              <h1 className="arcade-title game-page-title">Pong Arena</h1>
            </div>

            <div className="game-page-canvas-shell">
              <PongCanvasMultiplayer
                gameId={roomId}
                player1Id={player1Id}
                player2Id={player2Id}
                onGameEnd={handleGameEnd}
              />
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
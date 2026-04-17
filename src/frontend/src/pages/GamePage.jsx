import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import PongCanvasMultiplayer from '../Components/PongCanvasMultiplayer'
import './GamePage.css'
import { apiJson } from '../utils/apiClient'

/**
 * GamePage - Multiplayer Pong Game with Server-Authoritative Logic
 *
 * This page is reached after both players are ready in GameWaitingRoom.
 * It renders the game canvas connected to the backend game-service.
 */
export default function GamePage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const player1Id = location.state?.player1_id ?? location.state?.currentUser?.id
  const player2Id = location.state?.player2_id ?? location.state?.opponent?.id
  const tournamentId = location.state?.tournamentId
  const tournamentMatchId = location.state?.tournamentMatchId
  const [submittingResult, setSubmittingResult] = useState(false)

  useEffect(() => {
    // Redirect to play if no room context or missing player IDs
    if (!roomId || player1Id == null || player2Id == null) {
      navigate('/play')
    }
  }, [roomId, player1Id, player2Id, navigate])

  if (!roomId || player1Id == null || player2Id == null) {
    return null // Prevent rendering the canvas with missing IDs while navigating away
  }

  async function handleGameEnd(result) {
    console.log('Game ended:', result)

    if (tournamentId && tournamentMatchId && !submittingResult) {
      setSubmittingResult(true)
      try {
        await apiJson(`/api/game/tournaments/${tournamentId}/matches/${tournamentMatchId}/result`, {
          method: 'POST',
          body: JSON.stringify(result),
        })
        navigate(`/tournaments/${tournamentId}`)
        return
      } catch (error) {
        console.error('Failed to submit tournament result:', error)
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
      <main className="game-page">
        <PongCanvasMultiplayer
          gameId={roomId}
          player1Id={player1Id}
          player2Id={player2Id}
          onGameEnd={handleGameEnd}
        />
      </main>
    </>
  )
}

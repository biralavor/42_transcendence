import { useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import PongCanvasMultiplayer from '../Components/PongCanvasMultiplayer'
import './GamePage.css'

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

  const player1Id = location.state?.player1_id || location.state?.currentUser?.id
  const player2Id = location.state?.player2_id || location.state?.opponent?.id

  useEffect(() => {
    // Redirect to play if no room context
    if (!roomId) {
      navigate('/play')
      return
    }
  }, [roomId, navigate])

  function handleGameEnd(result) {
    console.log('Game ended:', result)
    // Navigate back to play or show result screen
    navigate('/play', { 
      state: { 
        gameResult: result 
      } 
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

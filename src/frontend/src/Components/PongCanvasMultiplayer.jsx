import { useRef, useEffect, useState } from 'react'
import './PongCanvas.css'
import { GameState } from '../game/pongEngine.js'
import { CanvasGameContext, render } from '../game/pongRenderer.js';
import { useAuth } from '../context/authContext'

/**
 * PongCanvasMultiplayer - Server-Authoritative Multiplayer Pong
 *
 * This component connects to the game-service via WebSocket and renders
 * the authoritative game state from the server. All physics and collision
 * detection happens server-side.
 *
 * Protocol:
 * - Client → Server: {"type": "input", "direction": "up"|"down"|"stop", "client_ts": <ms>}
 * - Server → Client: {"type": "state", "ball": {...}, "paddles": {...}, "score": {...}}
 */

function PongCanvasMultiplayer(props) {
  const gameId = props?.gameId || 'default-game'
  const player1Id = props?.player1Id
  const player2Id = props?.player2Id
  const onGameEnd = props?.onGameEnd || (() => { })
  const { auth } = useAuth()

  const canvasRef = useRef(null)
  const keyStateRef = useRef({
    'KeyJ': false,
    'KeyK': false,
    'KeyW': false,
    'KeyS': false,
    'ArrowUp': false,
    'ArrowDown': false,
  })
  const webSocketRef = useRef(null)
  const gameStateRef = useRef(null)
  const loopRef = useRef(null)
  const lastDirectionRef = useRef('stop')
  const goalTimerRef = useRef(null)
  const [showGoal, setShowGoal] = useState(false)
  const [connStatus, setConnStatus] = useState('connecting')
  const [errorMsg, setErrorMsg] = useState('')

  // Track which player(s) this client represents
  const playerTypeRef = useRef(null)

  function onKeyup(event) {
    if (['KeyJ', 'KeyK', 'KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
      keyStateRef.current[event.code] = false
    }
  }

  function onKeydown(event) {
    if (['KeyJ', 'KeyK', 'KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
      keyStateRef.current[event.code] = true
    }
  }

  /**
   * Determine which direction to send based on key state
   */
  function getInput() {
    let direction = 'stop'

    if (keyStateRef.current['KeyW'] || keyStateRef.current['ArrowUp'] || keyStateRef.current['KeyK']) {
      direction = 'up'
    } else if (keyStateRef.current['KeyS'] || keyStateRef.current['ArrowDown'] || keyStateRef.current['KeyJ']) {
      direction = 'down'
    }

    return direction
  }

  function updateCanvasDimensions() {
    const canvas = canvasRef.current
    if (!canvas) return

    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = Math.round(width)
    canvas.height = Math.round(height)
  }

  function connectWebSocket() {
    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    let wsUrl = `${protocol}//${host}/api/game/ws/game/${gameId}`

    if (auth?.access_token) {
      wsUrl += `?token=${auth.access_token}`
    }

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('[WS] Connected to game server')
      setConnStatus('connected')

      // Send game_start to initialize the session
      ws.send(JSON.stringify({
        type: 'game_start',
        player1_id: parseInt(player1Id, 10),
        player2_id: parseInt(player2Id, 10),
      }))
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        if (message.type === 'state') {
          // Receive server state and update game
          if (gameStateRef.current) {
            // Update ball
            if (message.ball) {
              gameStateRef.current.ball.position.x = message.ball.x
              gameStateRef.current.ball.position.y = message.ball.y
              gameStateRef.current.ball.velocity.x = message.ball.vx
              gameStateRef.current.ball.velocity.y = message.ball.vy
            }

            // Update paddles
            if (message.paddles) {
              gameStateRef.current.player1.position.y = message.paddles.p1
              gameStateRef.current.player2.position.y = message.paddles.p2
            }

            // Update score
            if (message.score) {
              gameStateRef.current.score.player1 = message.score.p1
              gameStateRef.current.score.player2 = message.score.p2
            }
          }
        } else if (message.type === 'game_over') {
          handleGameEnd(message.winner_id, message.score_p1, message.score_p2)
        }
      } catch (err) {
        console.error('[WS] Message parse error:', err)
      }
    }

    ws.onerror = (event) => {
      console.error('[WS] Error:', event)
      setConnStatus('error')
      setErrorMsg('WebSocket connection error')
    }

    ws.onclose = () => {
      console.log('[WS] Connection closed')
      setConnStatus('disconnected')
    }

    webSocketRef.current = ws
  }

  function handleGameEnd(winnerId, scoreP1, scoreP2) {
    onGameEnd({ winner_id: winnerId, score_p1: scoreP1, score_p2: scoreP2 })
  }

  function sendInput(direction) {
    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
      const clientTs = Date.now()
      webSocketRef.current.send(JSON.stringify({
        type: 'input',
        direction: direction,
        client_ts: clientTs,
      }))
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const renderingContext = canvas.getContext('2d')
    updateCanvasDimensions()

    // Initialize game state
    gameStateRef.current = new GameState('remote', 'remote')
    const canvasContext = new CanvasGameContext(canvas, renderingContext)
    gameStateRef.current.player1.color = canvasContext.crtWhite
    gameStateRef.current.player2.color = canvasContext.crtWhite
    gameStateRef.current.ball.color = canvasContext.crtWhite

    // Connect to WebSocket
    connectWebSocket()

    // Setup event listeners
    function onResize(event) {
      updateCanvasDimensions()
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('keyup', onKeyup)

    // Render loop - just display server state, no client simulation
    function renderLoop() {
      // Get current input
      const direction = getInput()

      // Send input to server only if it changed to avoid WS spam
      if (direction !== lastDirectionRef.current) {
        sendInput(direction)
        lastDirectionRef.current = direction
      }

      // Render the server state using the existing renderer
      render(canvasContext, gameStateRef.current, () => false)

      loopRef.current = requestAnimationFrame(renderLoop)
    }

    loopRef.current = requestAnimationFrame(renderLoop)

    return () => {
      cancelAnimationFrame(loopRef.current)
      clearTimeout(goalTimerRef.current)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKeydown)
      window.removeEventListener('keyup', onKeyup)

      // Close WebSocket
      if (webSocketRef.current) {
        webSocketRef.current.close()
      }
    }
  }, [])

  return (
    <div className='pong-canvas-container'>
      <div className='pong-canvas-wrapper'>
        {connStatus === 'connecting' && (
          <div className='status-overlay' style={{ backgroundColor: '#333' }}>
            <span className='status-text'>Connecting to server...</span>
          </div>
        )}
        {connStatus === 'error' && (
          <div className='status-overlay' style={{ backgroundColor: '#8B0000' }}>
            <span className='status-text'>{errorMsg || 'Connection error'}</span>
          </div>
        )}
        {showGoal && (
          <div className='goal-overlay'>
            <span className='goal-text'>GOOOAL!</span>
          </div>
        )}
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  )
}

export default PongCanvasMultiplayer

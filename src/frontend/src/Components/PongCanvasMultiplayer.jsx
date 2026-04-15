import { useRef, useEffect, useState } from 'react'
import './PongCanvas.css'
import { GameState } from '../game/pongEngine.js'
import { CanvasGameContext, render } from '../game/pongRenderer.js'
import { useAuth } from '../context/authContext'

function PongCanvasMultiplayer(props) {
  const gameId = props?.gameId || 'default-game'
  const player1Id = props?.player1Id
  const player2Id = props?.player2Id
  const onGameEnd = props?.onGameEnd || (() => {})
  const { auth } = useAuth()

  const canvasRef = useRef(null)
  const keyStateRef = useRef({
    KeyJ: false,
    KeyK: false,
    KeyW: false,
    KeyS: false,
    ArrowUp: false,
    ArrowDown: false,
  })
  const webSocketRef = useRef(null)
  const gameStateRef = useRef(null)
  const loopRef = useRef(null)
  const lastDirectionRef = useRef('stop')
  const [connStatus, setConnStatus] = useState('connecting')
  const [errorMsg, setErrorMsg] = useState('')

  const SERVER_WIDTH = 1024
  const SERVER_HEIGHT = 512
  const SERVER_PADDLE_WIDTH = 20
  const SERVER_PADDLE_HEIGHT = 100
  const SERVER_BALL_RADIUS = 8

  const CLIENT_WIDTH = 160
  const CLIENT_HEIGHT = 90

  // Keep the whole server-authoritative playfield slightly inset on X
  // so paddles are visibly away from the wall, while ball and paddles
  // stay in the exact same coordinate space.
  const VISUAL_PADDLE_INSET = 4
  const PLAYFIELD_WIDTH = CLIENT_WIDTH - VISUAL_PADDLE_INSET * 2
  const scaleX = PLAYFIELD_WIDTH / SERVER_WIDTH
  const scaleY = CLIENT_HEIGHT / SERVER_HEIGHT

  const mapServerX = (serverX) => VISUAL_PADDLE_INSET + serverX * scaleX
  const mapServerY = (serverY) => serverY * scaleY

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

  function getInput() {
    let direction = 'stop'

    if (keyStateRef.current.KeyW || keyStateRef.current.ArrowUp || keyStateRef.current.KeyK) {
      direction = 'up'
    } else if (
      keyStateRef.current.KeyS ||
      keyStateRef.current.ArrowDown ||
      keyStateRef.current.KeyJ
    ) {
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    let wsUrl = `${protocol}//${host}/api/game/ws/game/${gameId}`

    if (auth?.access_token) {
      wsUrl += `?token=${auth.access_token}`
    }

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      setConnStatus('connected')
      ws.send(
        JSON.stringify({
          type: 'game_start',
          player1_id: parseInt(player1Id, 10),
          player2_id: parseInt(player2Id, 10),
        }),
      )
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        if (message.type === 'state' && gameStateRef.current) {
          const ball = gameStateRef.current.ball
          const player1 = gameStateRef.current.player1
          const player2 = gameStateRef.current.player2

          if (message.ball) {
            // Server sends the ball position as center coordinates.
            // Renderer expects top-left coordinates.
            const serverBallLeft = message.ball.x - SERVER_BALL_RADIUS
            const serverBallTop = message.ball.y - SERVER_BALL_RADIUS

            ball.position.x = Math.max(
              VISUAL_PADDLE_INSET,
              Math.min(
                CLIENT_WIDTH - VISUAL_PADDLE_INSET - ball.size.width,
                mapServerX(serverBallLeft),
              ),
            )
            ball.position.y = Math.max(
              0,
              Math.min(CLIENT_HEIGHT - ball.size.height, mapServerY(serverBallTop)),
            )
            ball.position.velX = message.ball.vx * scaleX
            ball.position.velY = message.ball.vy * scaleY
          }

          if (message.paddles) {
            player1.position.y = Math.max(
              0,
              Math.min(CLIENT_HEIGHT - player1.size.height, mapServerY(message.paddles.p1)),
            )
            player2.position.y = Math.max(
              0,
              Math.min(CLIENT_HEIGHT - player2.size.height, mapServerY(message.paddles.p2)),
            )
          }

          if (message.score) {
            gameStateRef.current.score.player1 = message.score.p1
            gameStateRef.current.score.player2 = message.score.p2
          }
        } else if (message.type === 'game_over') {
          handleGameEnd(message.winner_id, message.score_p1, message.score_p2)
        }
      } catch (err) {
        console.error('[WS] Message parse error:', err)
      }
    }

    ws.onerror = () => {
      setConnStatus('error')
      setErrorMsg('WebSocket connection error')
    }

    ws.onclose = () => {
      setConnStatus('disconnected')
    }

    webSocketRef.current = ws
  }

  function handleGameEnd(winnerId, scoreP1, scoreP2) {
    onGameEnd({ winner_id: winnerId, score_p1: scoreP1, score_p2: scoreP2 })
  }

  function sendInput(direction) {
    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
      webSocketRef.current.send(
        JSON.stringify({
          type: 'input',
          direction,
          client_ts: Date.now(),
        }),
      )
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const renderingContext = canvas.getContext('2d')
    updateCanvasDimensions()

    gameStateRef.current = new GameState('remote-human', 'remote-human')
    const canvasContext = new CanvasGameContext(canvas, renderingContext)

    gameStateRef.current.player1.color = canvasContext.crtWhite
    gameStateRef.current.player2.color = canvasContext.crtWhite
    gameStateRef.current.ball.color = canvasContext.crtWhite

    gameStateRef.current.player1.size.width = SERVER_PADDLE_WIDTH * scaleX
    gameStateRef.current.player1.size.height = SERVER_PADDLE_HEIGHT * scaleY
    gameStateRef.current.player2.size.width = SERVER_PADDLE_WIDTH * scaleX
    gameStateRef.current.player2.size.height = SERVER_PADDLE_HEIGHT * scaleY

    gameStateRef.current.ball.size.width = SERVER_BALL_RADIUS * 2 * scaleX
    gameStateRef.current.ball.size.height = SERVER_BALL_RADIUS * 2 * scaleY

    // Keep paddle and ball on the same visual X transform.
    gameStateRef.current.player1.position.x = mapServerX(0)
    gameStateRef.current.player2.position.x = mapServerX(SERVER_WIDTH - SERVER_PADDLE_WIDTH)

    connectWebSocket()

    function onResize() {
      updateCanvasDimensions()
    }

    function renderLoop() {
      const direction = getInput()

      if (direction !== lastDirectionRef.current) {
        sendInput(direction)
        lastDirectionRef.current = direction
      }

      render(canvasContext, gameStateRef.current, () => false)
      loopRef.current = requestAnimationFrame(renderLoop)
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('keyup', onKeyup)
    loopRef.current = requestAnimationFrame(renderLoop)

    return () => {
      cancelAnimationFrame(loopRef.current)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKeydown)
      window.removeEventListener('keyup', onKeyup)

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
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  )
}

export default PongCanvasMultiplayer

import { useRef, useEffect, useState } from 'react'
import './PongCanvas.css'
import { GameState, gameLoop, CanvasGameContext } from '../game/pongEngine.js'

function getLocalInput(keyState, keyUp, keyDown) {
    let velY = keyState[keyDown] ? 1 : 0;
    velY -= keyState[keyUp] ? 1 : 0;

    return { velY, velX: 0};
}

function getRemoteInput(gameState) {
  // TODO get remote game input
  let velY = gameState.ball.position.y >
      (gameState.player2.position.y + (gameState.player2.size.height / 2))
      ? 1 : 0
  velY -= gameState.ball.position.y <
    (gameState.player2.position.y + (gameState.player2.size.height / 2))
    ? 1 : 0;
  return { velY, velX: 0};
}

export default function PongCanvas(props)
{
  const player1Kind = props?.player1Kind;
  const player2Kind = props?.player2Kind;
  console.log(player1Kind, player2Kind)
  const canvasRef = useRef(null);
  const keyStateRef = useRef(null);
  const gameStateRef = useRef(null);
  const kickoffRef = useRef(false);
  const loopRef = useRef(null);
  const goalTimerRef = useRef(null);
  const [showGoal, setShowGoal] = useState(false);


  if (keyStateRef.current == null) {
    keyStateRef.current = {
      'KeyJ': false, 'KeyK': false,
      'KeyW': false, 'KeyS': false
    };
  }

  if (gameStateRef.current == null) {
    gameStateRef.current = new GameState(player1Kind, player2Kind);
  }

  function onGoal() {
    kickoffRef.current = true;
    setShowGoal(true);
    goalTimerRef.current = setTimeout(() => {
      kickoffRef.current = false;
      setShowGoal(false);
    }, 2000);
  }

  const isPaused = () => kickoffRef.current;

  function onKeyup(event) {
    if (event.code === 'KeyJ'
        || event.code === 'KeyK'
        || event.code === 'KeyW'
        || event.code === 'KeyS'
       ) {
      keyStateRef.current[event.code] = false;
    }
  }

  function onKeydown(event) {
    if (event.code === 'KeyJ'
        || event.code === 'KeyK'
        || event.code === 'KeyW'
        || event.code === 'KeyS'
       ) {
      keyStateRef.current[event.code] = true;
    }
  }

  function getInput() {
    const player1 = player1Kind == 'local'
          ? getLocalInput(keyStateRef.current, 'KeyW', 'KeyS')
          : null;
    const player2 = player2Kind == 'local'
          ? getLocalInput(keyStateRef.current, 'KeyK', 'KeyJ')
          : player2Kind.startsWith('remote-')
          ? getRemoteInput(gameStateRef.current)
          : null;
    return { player1, player2, }
  }

  function updateCanvasDimensions() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use getBoundingClientRect so we get actual rendered pixels,
    // not the browser's default 300×150 that getComputedStyle returns
    // when no explicit width/height is set on the element.
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
  }

  useEffect(() => {

    /** @type {HTMLCanvasElement} */
    const canvas = canvasRef.current;
    const renderingContext = canvas.getContext('2d');
    updateCanvasDimensions()
    const canvasContext = new CanvasGameContext(canvas, renderingContext)
    gameStateRef.current.player1.color = canvasContext.crtWhite;
    gameStateRef.current.player2.color = canvasContext.crtWhite;
    gameStateRef.current.ball.color = canvasContext.crtWhite;
    function onResize(event) {
      updateCanvasDimensions()
    }
    function loop() {
      gameLoop(canvasContext, gameStateRef.current, getInput, isPaused, onGoal);
      loopRef.current = requestAnimationFrame(loop);
    }

    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('keyup', onKeyup);

    loopRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(loopRef.current);
      clearTimeout(goalTimerRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeydown);
      window.removeEventListener('keyup', onKeyup);
    }
  }, []);

  return (
    <div className='pong-canvas-container'>
      <div className='pong-canvas-wrapper'>
        {showGoal && (
          <div className='goal-overlay'>
            <span className='goal-text'>GOOOAL!</span>
          </div>
        )}
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
}

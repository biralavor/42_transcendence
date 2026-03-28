import { useRef, useEffect, useState } from 'react'
import './PongCanvas.css'
import { GameState, gameLoop, CanvasGameContext } from '../game/pongEngine.js'


export default function PongCanvas()
{
  const canvasRef = useRef(null);
  const keyStateRef = useRef(null);
  const gameStateRef = useRef(null);
  const pauseRef = useRef(false);
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
    gameStateRef.current = new GameState();
  }

  function onGoal() {
    pauseRef.current = true;
    setShowGoal(true);
    goalTimerRef.current = setTimeout(() => {
      pauseRef.current = false;
      setShowGoal(false);
    }, 2000);
  }

  const isPaused = () => pauseRef.current;

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
    let p1VelY = keyStateRef.current['KeyS'] ? 1 : 0;
    p1VelY -= keyStateRef.current['KeyW'] ? 1 : 0;
    let p2VelY = keyStateRef.current['KeyJ'] ? 1 : 0;
    p2VelY -= keyStateRef.current['KeyK'] ? 1 : 0;
    return {
      player1: {velY: p1VelY, velX: 0},
      player2: {velY: p2VelY, velX: 0},
    }
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

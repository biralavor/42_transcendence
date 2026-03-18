import { useRef, useEffect, useState } from 'react'
import './PongCanvas.css'
import { GameState, gameLoop, CanvasGameContext } from '../game/pongEngine.js'

export default function PongCanvas()
{
    console.log("rendered")
    const canvasRef = useRef(null);
    const keyStateRef = useRef({ 'KeyJ': false, 'KeyK': false, 'KeyW': false, 'KeyS': false })
    const [gameState, setGameState] = useState(new GameState())
    const pauseRef = useRef(false);
    const [showGoal, setShowGoal] = useState(false);

    function onGoal() {
        pauseRef.current = true;
        setShowGoal(true);
        setTimeout(() => {
            pauseRef.current = false;
            setShowGoal(false);
        }, 2000);
    }

    const isPaused = () => pauseRef.current;

    function onKeyup(event) {
        console.log(`keyup ${event}`)
        if (event.code === 'KeyJ'
            || event.code === 'KeyK'
            || event.code === 'KeyW'
            || event.code === 'KeyS'
           ) {
            keyStateRef.current[event.code] = false;
        }
    }

    function onKeydown(event) {
        console.log(`keydown ${event}`)
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

        // Compute CSS defined dimensions
        const computedStyle = window.getComputedStyle(canvas);
        const width = parseFloat(computedStyle.width);
        const height = parseFloat(computedStyle.height);

        canvas.width = width;
        canvas.height = height;
    }

    useEffect(() => {

        const targetFrameRate = 30; //frame per second
        const timeFrameMillis = 1000 / targetFrameRate; //millis per frame
        /** @type {HTMLCanvasElement} */
        const canvas = canvasRef.current;
        const renderingContext = canvas.getContext('2d');
        updateCanvasDimensions()
        const canvasContext = new CanvasGameContext(canvas, renderingContext)
        function onResize(event) {
            updateCanvasDimensions()
        }
        window.addEventListener('resize', onResize);
        const interval = setInterval(() => {
            gameLoop(canvasContext, gameState, setGameState, getInput, isPaused, onGoal);
        }, timeFrameMillis);

        window.addEventListener('keydown', onKeydown)
        window.addEventListener('keyup', onKeyup);

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('keydown', onKeydown);
            window.removeEventListener('keyup', onKeyup);
        }
    }, []);

    return (
        <div className='pong-canvas-container'>
            <div className='score'>
                <span className='score-player1'>{gameState.score.player1}</span>
                <span className='score-player2'>{gameState.score.player2}</span>
            </div>
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

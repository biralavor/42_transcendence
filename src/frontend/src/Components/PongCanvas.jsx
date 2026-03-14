import { useRef, useEffect, useState } from 'react'
import './PongCanvas.css'
import { canvasWidth, canvasHeight, GameState, gameLoop } from '../game/pongEngine.js'

const keyState = {
	'KeyJ': false,
	'KeyK': false,
	'KeyW': false,
	'KeyS': false,
}

export default function PongCanvas()
{
    console.log("rendered")
    const canvasRef = useRef(null);
    const keyStateRef = useRef(keyState)
    const [gameState, setGameState] = useState(new GameState())

    function onKeyup(event) {
	console.log(`keyup ${event}`)
	if (event.code === 'KeyJ'
	    || event.code === 'KeyK'
	    || event.code === 'KeyW'
	    || event.code === 'KeyS'
	   ) {
	    keyStateRef[event.code] = false;
	}
    }

    function onKeydown(event) {
	console.log(`keydown ${event}`)
	if (event.code === 'KeyJ'
	    || event.code === 'KeyK'
	    || event.code === 'KeyW'
	    || event.code === 'KeyS'
	   ) {
	    keyStateRef[event.code] = true;
	}
    }

    function getInput() {
	let p1VelY = keyStateRef['KeyS'] ? 1 : 0;
	p1VelY -= keyStateRef['KeyW'] ? 1 : 0;
	let p2VelY = keyStateRef['KeyJ'] ? 1 : 0;
	p2VelY -= keyStateRef['KeyK'] ? 1 : 0;
	return {
            player1: {velY: p1VelY, velX: 0},
            player2: {velY: p2VelY, velX: 0},
	}
    }

    useEffect(() => {

	const targetFrameRate = 30; //frame per second
	const timeFrameMillis = 1000 / targetFrameRate; //millis per frame
        const canvas = canvasRef.current;
        const canvasContext = canvas.getContext('2d');

	const interval = setInterval(gameLoop, timeFrameMillis,
			canvasContext, gameState, setGameState, getInput);

	window.addEventListener('keydown', onKeydown)
	window.addEventListener('keyup', onKeyup);

        return () => {
	    clearInterval(interval);
	    document.removeEventListener('keydown', onKeydown);
	    document.removeEventListener('keyup', onKeyup);
	}
    }, []);

    return(
        <div className='canvas-container'>
            <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight}></canvas>
        </div>
    );
}

import { useRef, useEffect, useState } from 'react'
import './PongCanvas.css'

const canvasWidth = 1000;
const canvasHeight = 600;

const keyState = {
	'KeyJ': false,
	'KeyK': false,
	'KeyW': false,
	'KeyS': false,
}

/**
 * For string based color follow reference
 * https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value
 * @typedef {(string|CanvasGradient|CanvasPattern)} Color
 */

/**
 * @class
 */
class Position {
    /**
     * Create a Position.
     * @param {number} x - The initial horizontal position.
     * @param {number} y - The initial vertical position.
     */
    constructor(x, y) {
        /** @type {number} - horizontal position  */
        this.x = x;
        /** @type {number} - vertical position*/
        this.y = y;
        /** @type {number} - horizontal velocity*/
        this.velX = 0;
        /** @type {number} - vertical velocity */
        this.velY = 0;
    }

    moveIntent() {
        const newY = this.y + this.velY;
        const newX = this.x + this.velX;
        return [newY, newX];
    }

    move() {
        this.x += this.velX;
        this.y += this.velY;
    }

    static copy(other) {
        const newPosition = new Position(other.x, other.y);
        newPosition.velX = other.velX;
        newPosition.velY = other.velY;
        return newPosition;
    }
}

/**
 * @class
 */
class Size {
    /**
     * Create a Size.
     * @param {number} width - The width of the Size.
     * @param {number} height - The height of the Size.
     */
    constructor(width, height) {
        /** @type {number} - width size  */
        this.width = width;
        /** @type {number} - height size  */
        this.height = height;
    }

    static copy(other) {
        return new Size(other.width, other.height);
    }
}

class Entity {
    /** @type {Position} - entity position */
    position;
    /** @type {Size} - entity size */
    size;
    /** @type {Color} - color values  */
    color;


    move()
    {
        this.position.move();
    }

    isCollidingWith(other) {
        return (
            this.position.x < other.position.x + other.size.width
                && this.position.x + this.size.width > other.position.x
                && this.position.y < other.position.y + other.size.height
                && this.position.y + this.size.height > other.position.y
        );
    }
}

class Player extends Entity {

    /**
     * Enum for Player types.
     * @readonly
     * @enum {(1|2)}
     */
    static Type = Object.freeze({
        ONE: 1,
        TWO: 2
    });

    /**
     * Create a Player.
     * @param {Type} type - The Player type (Player.Type.ONE or Player.Type.TWO)
     */
    constructor(type) {
        super();
        /** @type {Type} - The Player type  */
        this.type = type;
        if (type === Player.Type.ONE) {
            /** @type {Position} - position values  */
            this.position = new Position(10, 300 - 45);
            this.color = 'red';
        } else {
            this.position = new Position(960, 300 - 45);
            this.color = 'blue';
        }
        /** @type {Size} - size values  */
        this.size = new Size(30, 90);
    }
}

class Ball extends Entity {

    /**
     * Create a Ball.
     */
    constructor() {
        super();
        this.color = 'white';
        this.position = new Position(485, 285);
        this.size = new Size(30, 30);
    }

    static copy(other) {
        const copyBall = new Ball();
        copyBall.color = other.color;
        copyBall.position = Position.copy(other.position);
        copyBall.size = Size.copy(other.size);
        return copyBall;
    }
}

class GameState {
    constructor() {
        this.player1 = new Player(Player.Type.ONE);
        this.player2 = new Player(Player.Type.TWO);
        this.ball = new Ball();
        this.ball.position.velX = 10;
        this.ball.position.velY = 0;
    }
    
    move(movements) {
        this.ball.move(movements.ball);
    }

    collision() {

        const ballIntendedPosition = { ...this.ball.position };

        [ballIntendedPosition.y,
         ballIntendedPosition.x] = this.ball.position.moveIntent();
        const newBall = Ball.copy(this.ball);
        newBall.position.x = ballIntendedPosition.x;
        newBall.position.y = ballIntendedPosition.y;

        // vertical collision
        if (ballIntendedPosition.y <= 0) {
            const overflow = 0 - ballIntendedPosition.y
            newBall.position.y = overflow;
            newBall.position.velY = ballIntendedPosition.velY * (-1.0);
        } else if (ballIntendedPosition.y >= canvasHeight - newBall.size.height){

            const overflow = ballIntendedPosition.y
                  - (canvasHeight - newBall.size.height)
            newBall.position.y = (canvasHeight - newBall.size.height) - overflow;
            newBall.position.velY = -this.ball.position.velY;
        }
        // horizontal collision
        // TODO improve collision detection logic to
        // handle better non frontal collisions
        if (this.player1.isCollidingWith(newBall)) {
            const p1Surface = (this.player1.position.x + this.player1.size.width);
            const ballSurface = ballIntendedPosition.x;
            const overflow = p1Surface - ballSurface;
            newBall.position.x = p1Surface + overflow;
            newBall.position.velX = -ballIntendedPosition.velX
            newBall.position.velY += 0.4 * this.player1.position.velY;
        } else if (this.player2.isCollidingWith(newBall)) {
            const p2Surface = (this.player2.position.x);
            const ballSurface = ballIntendedPosition.x + newBall.size.width;
            const overflow = p2Surface - ballSurface;
            newBall.position.x = p2Surface + overflow - newBall.size.width;
            newBall.position.velX = -ballIntendedPosition.velX
            newBall.position.velY += 0.4 * this.player2.position.velY;
        }

        return newBall;
    }
}

/**
 * @param {CanvasRenderingContext2D} canvasContext
 * @param {GameState} gameState 
 */
function render(canvasContext, {player1, player2, ball}) {
    canvasContext.reset();

    canvasContext.fillStyle = player1.color;
    canvasContext.fillRect(
        player1.position.x,
        player1.position.y,
        player1.size.width,
        player1.size.height
    );

    canvasContext.fillStyle = player2.color;
    canvasContext.fillRect(
        player2.position.x,
        player2.position.y,
        player2.size.width,
        player2.size.height
    );

    canvasContext.fillStyle = ball.color;
    canvasContext.fillRect(
        ball.position.x,
        ball.position.y,
        ball.size.width,
        ball.size.height
    );
}


/**
 * @param {CanvasRenderingContext2D} canvasContext
 * @param {GameState} gameState 
 */
function gameLoop(canvasContext, gameState, setGameState, getInput) {
    const input = getInput();
    // movePlayers
    gameState.player1.position.velY *= 0.98;
    gameState.player2.position.velY *= 0.98;
    gameState.player1.position.velY += input.player1.velY;
    gameState.player1.position.velY =
        gameState.player1.position.velY > 10 ? 10 : gameState.player1.position.velY;
    gameState.player1.position.velY =
        gameState.player1.position.velY < -10 ? -10 : gameState.player1.position.velY;
    gameState.player2.position.velY += input.player2.velY;
    gameState.player2.position.velY =
        gameState.player2.position.velY > 10 ? 10 : gameState.player2.position.velY;
    gameState.player2.position.velY =
        gameState.player2.position.velY < -10 ? -10 : gameState.player2.position.velY;

    gameState.player1.move();
    gameState.player2.move();

    // collision ball
    const ballAfterCollision = gameState.collision();
    gameState.ball = ballAfterCollision;

    //rendering
    render(canvasContext, gameState);
    setGameState(gameState); // tells react to re-render canvas and persist gamestate
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

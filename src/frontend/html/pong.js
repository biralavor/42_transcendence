/// <reference lib="dom" />

// TODO set width and height of canvas
// based on biggest possible preserving
// desired aspect ratio. maybe a css only solution
// is possible for this, otherwise
// a js solution is possible

const canvasWidth = 800;
const canvasHeight = 400;

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

    /**
     * @param {Position} movement - the new position
     */
    move(movement) {
	this.x = movement.x;
	this.y = movement.y;
	this.velX = movement.velX;
	this.velY = movement.velY;
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
}

class Entity {
    /** @type {Position} - entity position */
    position;
    /** @type {Size} - entity size */
    size;
    /** @type {Color} - color values  */
    color;

    /** @param {Position} movement - the new position */
    move(movement) {
	this.position.move(movement);
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
            this.position = new Position(10, 180);
	    this.color = 'red';
	} else {
            this.position = new Position(760, 180);
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
	this.position = new Position(300, 180);
	this.size = new Size(30, 30);
    }
}

class GameState {
    constructor() {
	this.player1 = new Player(Player.Type.ONE);
	this.player2 = new Player(Player.Type.TWO);
	this.ball = new Ball();
	this.ball.position.velX = 1;
	this.ball.position.velY = -10;
    }

    
    move(movements) {
	this.ball.move(movements.ball);
    }

    colision(input) {
	const movements = {
	    ball: {},
	    player1: {},
	    player2: {},
	}
	const [newBallPositionY, newBallPositionX] = this.ball.position.moveIntent();
	movements.ball.y = newBallPositionY;
	movements.ball.x = newBallPositionX;
	movements.ball.velY = this.ball.position.velY;
	movements.ball.velX = this.ball.position.velX;
	console.log("movementsBefore: ", movements)
	if (newBallPositionY <= 0) {
	    movements.ball.y = 0 - newBallPositionY;
	    movements.ball.velY = this.ball.position.velY * (-1.0);   
	} else if (newBallPositionY >= canvasHeight - this.ball.size.height){
	    const overflow = (canvasHeight - this.ball.size.height)
		- newBallPositionY;
	    movements.ball.y = (canvasHeight - this.ball.size.height) - overflow;
	    movements.ball.velY = this.ball.position.velY * (-1.0);
	}
	console.log("movements: ", movements)
	return movements;
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
function gameLoop(canvasContext, gameState) {
    const input = {/*TODO*/};
    const movements = gameState.colision(input)
    gameState.move(movements);
    render(canvasContext, gameState);
}

// elements with id set on html automatically have
// a js variable referencing that id with that element
// but this do not work if element id is not a proper js identifier
// like using kebab cased ids for example "pong-canvas"
const canvasContext = pongCanvas.getContext("2d");
const gameState = new GameState()

const targetFrameRate = 30; //frame per second
const timeFrameMillis = 1000 / targetFrameRate; //millis per frame

setInterval(gameLoop, timeFrameMillis, canvasContext, gameState)


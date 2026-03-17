/**
 * pongEngine.js — pure game logic, no DOM, no React.
 * Consumed by:
 *   - src/Components/PongCanvas.jsx  (React SPA)
 *   - html/pong.js                   (standalone page)
 */

import System from './pongSystem.js';

/**
 * For string based color follow reference
 * https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value
 * @typedef {(string|CanvasGradient|CanvasPattern)} Color
 */

const widthRatio = 160;
const heightRatio = 90;
const aspectRatio = (widthRatio/heightRatio);

export class Position {
    /**
     * @param {number} x - initial horizontal position
     * @param {number} y - initial vertical position
     */
    constructor(x, y) {
        /** @type {number} */
        this.x = x;
        /** @type {number} */
        this.y = y;
        /** @type {number} */
        this.velX = 0;
        /** @type {number} */
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

export class Size {
    /**
     * @param {number} width
     * @param {number} height
     */
    constructor(width, height) {
        /** @type {number} */
        this.width = width;
        /** @type {number} */
        this.height = height;
    }

    static copy(other) {
        return new Size(other.width, other.height);
    }
}

export class Entity {
    /** @type {Position} */
    position;
    /** @type {Size} */
    size;
    /** @type {Color} */
    color;

    move() {
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

export class Player extends Entity {
    /**
     * @readonly
     * @enum {(1|2)}
     */
    static Type = Object.freeze({
	ONE: 1,
	TWO: 2
    });

    /**
     * @param {Player.Type} type
     */
    constructor(type) {
	super();
	this.type = type;
	this.size = new Size(5, 15);
	if (type === Player.Type.ONE) {
	    this.position = new Position(2 * this.size.width,
					 heightRatio / 2 - (this.size.height / 2));
	    this.color = 'red';
	} else {
	    this.position = new Position(widthRatio - 3 * this.size.width,
					 heightRatio / 2 - (this.size.height / 2));
	    this.color = 'blue';
	}

    }
}

export class Ball extends Entity {
    constructor() {
        super();
        this.color = 'white';
	this.size = new Size(5, 5);
        this.position = new Position(widthRatio / 2 - (this.size.width / 2),
				     heightRatio / 2 - (this.size.height / 2));
    }

    static copy(other) {
        const copyBall = new Ball();
        copyBall.color = other.color;
        copyBall.position = Position.copy(other.position);
        copyBall.size = Size.copy(other.size);
        return copyBall;
    }
}

export class GameState {
    constructor() {
	/** @type {Player} */
        this.player1 = new Player(Player.Type.ONE);
	/** @type {Player} */
        this.player2 = new Player(Player.Type.TWO);
	/** @type {Ball} */
        this.ball = new Ball();
        this.ball.position.velX = 4;
        this.ball.position.velY = 0;
    }
}

export class CanvasGameContext {

    /** @type {HTMLCanvasElement} */
    #canvas;
    /**
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     * @param {CanvasRenderingContext2D} renderingContext2d
     */
    constructor(canvas, renderingContext2d) {
	/** @type {CanvasRenderingContext2D} */
	this.rendering2d = renderingContext2d
	this.#canvas = canvas
    }

    /** @property {number} */
    get width() {
	return this.#canvas.width;
    }

    /** @property {number} */
    get height() {
	return this.#canvas.height;
    }

    /** @property {number} */
    get widthScale() {
	return this.#canvas.width / widthRatio;
    }

    /** @property {number} */
    get heightScale() {
	return this.#canvas.height / heightRatio;
    }

    /** @property {number} */
    get widthRatio() {
	return widthRatio;
    }

    /** @property {number} */
    get heightRatio() {
	return heightRatio;
    }
}

/**
 * @param {CanvasGameContext} canvasContext
 * @param {GameState} gameState
 */
export function render(canvasContext, { player1, player2, ball }) {
    const renderingCanvas = canvasContext.rendering2d;
    renderingCanvas.reset();

    renderingCanvas.fillStyle = player1.color;
    renderingCanvas.fillRect(player1.position.x  * canvasContext.widthScale,
			     player1.position.y  * canvasContext.heightScale,
			     player1.size.width  * canvasContext.widthScale,
			     player1.size.height * canvasContext.heightScale);

    renderingCanvas.fillStyle = player2.color;
    renderingCanvas.fillRect(player2.position.x  * canvasContext.widthScale,
			     player2.position.y  * canvasContext.heightScale,
			     player2.size.width  * canvasContext.widthScale,
			     player2.size.height * canvasContext.heightScale);

    renderingCanvas.fillStyle = ball.color;
    renderingCanvas.fillRect(ball.position.x  * canvasContext.widthScale,
			     ball.position.y  * canvasContext.heightScale,
			     ball.size.width  * canvasContext.widthScale,
			     ball.size.height * canvasContext.heightScale);
}


/**
 * @param {CanvasGameContext} canvasContext
 * @param {GameState} gameState
 * @param {Function} setGameState - callback after state update (no-op for standalone)
 * @param {Function} getInput - returns {player1: {velY, velX}, player2: {velY, velX}}
 */
export function gameLoop(canvasContext, gameState, setGameState, getInput) {
    /** @type {import('./pongSystem').GameInput} input */
    const input = getInput();

    System.playerMovement(gameState, input);
    System.ballCollision(gameState, canvasContext)

    render(canvasContext, gameState);
    setGameState(gameState);
}

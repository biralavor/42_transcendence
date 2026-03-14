/**
 * pongEngine.js — pure game logic, no DOM, no React.
 * Consumed by:
 *   - src/Components/PongCanvas.jsx  (React SPA)
 *   - html/pong.js                   (standalone page)
 */

export const canvasWidth = 1000;
export const canvasHeight = 600;

/**
 * For string based color follow reference
 * https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value
 * @typedef {(string|CanvasGradient|CanvasPattern)} Color
 */

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
        if (type === Player.Type.ONE) {
            this.position = new Position(10, 300 - 45);
            this.color = 'red';
        } else {
            this.position = new Position(960, 300 - 45);
            this.color = 'blue';
        }
        this.size = new Size(30, 90);
    }
}

export class Ball extends Entity {
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

export class GameState {
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
            const overflow = 0 - ballIntendedPosition.y;
            newBall.position.y = overflow;
            newBall.position.velY = ballIntendedPosition.velY * (-1.0);
        } else if (ballIntendedPosition.y >= canvasHeight - newBall.size.height) {
            const overflow = ballIntendedPosition.y - (canvasHeight - newBall.size.height);
            newBall.position.y = (canvasHeight - newBall.size.height) - overflow;
            newBall.position.velY = -this.ball.position.velY;
        }

        // horizontal collision
        // TODO improve collision detection logic to handle better non-frontal collisions
        if (this.player1.isCollidingWith(newBall)) {
            const p1Surface = this.player1.position.x + this.player1.size.width;
            const ballSurface = ballIntendedPosition.x;
            const overflow = p1Surface - ballSurface;
            newBall.position.x = p1Surface + overflow;
            newBall.position.velX = -ballIntendedPosition.velX;
            newBall.position.velY += 0.4 * this.player1.position.velY;
        } else if (this.player2.isCollidingWith(newBall)) {
            const p2Surface = this.player2.position.x;
            const ballSurface = ballIntendedPosition.x + newBall.size.width;
            const overflow = p2Surface - ballSurface;
            newBall.position.x = p2Surface + overflow - newBall.size.width;
            newBall.position.velX = -ballIntendedPosition.velX;
            newBall.position.velY += 0.4 * this.player2.position.velY;
        }

        return newBall;
    }
}

/**
 * @param {CanvasRenderingContext2D} canvasContext
 * @param {{player1: Player, player2: Player, ball: Ball}} gameState
 */
export function render(canvasContext, { player1, player2, ball }) {
    canvasContext.reset();

    canvasContext.fillStyle = player1.color;
    canvasContext.fillRect(player1.position.x, player1.position.y, player1.size.width, player1.size.height);

    canvasContext.fillStyle = player2.color;
    canvasContext.fillRect(player2.position.x, player2.position.y, player2.size.width, player2.size.height);

    canvasContext.fillStyle = ball.color;
    canvasContext.fillRect(ball.position.x, ball.position.y, ball.size.width, ball.size.height);
}

/**
 * @param {CanvasRenderingContext2D} canvasContext
 * @param {GameState} gameState
 * @param {Function} setGameState - callback after state update (no-op for standalone)
 * @param {Function} getInput - returns {player1: {velY, velX}, player2: {velY, velX}}
 */
export function gameLoop(canvasContext, gameState, setGameState, getInput) {
    const input = getInput();

    gameState.player1.position.velY *= 0.95;
    gameState.player2.position.velY *= 0.95;

    gameState.player1.position.velY += input.player1.velY;
    gameState.player1.position.velY = gameState.player1.position.velY > 10 ? 10 : gameState.player1.position.velY;
    gameState.player1.position.velY = gameState.player1.position.velY < -10 ? -10 : gameState.player1.position.velY;

    gameState.player2.position.velY += input.player2.velY;
    gameState.player2.position.velY = gameState.player2.position.velY > 10 ? 10 : gameState.player2.position.velY;
    gameState.player2.position.velY = gameState.player2.position.velY < -10 ? -10 : gameState.player2.position.velY;

    gameState.player1.move();
    gameState.player2.move();

    const ballAfterCollision = gameState.collision();
    gameState.ball = ballAfterCollision;

    render(canvasContext, gameState);
    setGameState(gameState);
}

import { Ball, CanvasGameContext } from "./pongEngine";

const MAX_PLAYER_VEL = 15;

/**
 * @typedef {Object} PlayerInput
 * @property {number} velY - Vertical velocity
 * @property {number} velX - Horizontal velocity
 */

/**
 * @typedef {Object} GameInput
 * @property {PlayerInput} player1
 * @property {PlayerInput} player2
 */

/**
* @param {GameState} gameState
*/
function desaceleratePlayers(gameState) {
    gameState.player1.position.velY *= 0.98;
    gameState.player2.position.velY *= 0.98;
}

/**
 * @param {GameState} gameState
 * @param {GameInput} input
 */
function applyInput(gameState, input) {
    gameState.player1.position.velY += input.player1.velY;
    gameState.player2.position.velY += input.player2.velY;
}


/**
 * @param {GameState} gameState
 */
function clampMaxVelocity(gameState) {
    gameState.player1.position.velY =
	gameState.player1.position.velY > MAX_PLAYER_VEL
	? MAX_PLAYER_VEL
	: gameState.player1.position.velY;
    gameState.player1.position.velY =
	gameState.player1.position.velY < -MAX_PLAYER_VEL
	? -MAX_PLAYER_VEL
	: gameState.player1.position.velY;

    gameState.player2.position.velY =
	gameState.player2.position.velY > MAX_PLAYER_VEL
	? MAX_PLAYER_VEL
	: gameState.player2.position.velY;
    gameState.player2.position.velY =
	gameState.player2.position.velY < -MAX_PLAYER_VEL
	? -MAX_PLAYER_VEL
	: gameState.player2.position.velY;
}

/**
 * @param {GameState} gameState
 * @param {CanvasGameContext} canvasContext
 * @returns {Ball} - a new ball derived from gameState with collisions applied
 */
function collision(gameState, canvasContext) {
    const canvasWidth = canvasContext.width;
    const canvasHeight = canvasContext.height;
    const ballIntendedPosition = { ...gameState.ball.position };
    [ballIntendedPosition.y,
     ballIntendedPosition.x] = gameState.ball.position.moveIntent();

    const newBall = Ball.copy(gameState.ball);
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
        newBall.position.velY = -gameState.ball.position.velY;
    }

    // horizontal collision
    // TODO improve collision detection logic to handle better non-frontal collisions
    if (gameState.player1.isCollidingWith(newBall)) {
        const p1Surface = gameState.player1.position.x + gameState.player1.size.width;
        const ballSurface = ballIntendedPosition.x;
        const overflow = p1Surface - ballSurface;
        newBall.position.x = p1Surface + overflow;
        newBall.position.velX = -ballIntendedPosition.velX;
        newBall.position.velY += 0.4 * gameState.player1.position.velY;
    } else if (gameState.player2.isCollidingWith(newBall)) {
        const p2Surface = gameState.player2.position.x;
        const ballSurface = ballIntendedPosition.x + newBall.size.width;
        const overflow = p2Surface - ballSurface;
        newBall.position.x = p2Surface + overflow - newBall.size.width;
        newBall.position.velX = -ballIntendedPosition.velX;
        newBall.position.velY += 0.4 * gameState.player2.position.velY;
    }

    return newBall;
}


export default class System {

    /**
     * @param {GameState} gameState
     * @param {GameInput} input
     */
    static playerMovement(gameState, input) {
	desaceleratePlayers(gameState);
	applyInput(gameState, input);
	clampMaxVelocity(gameState);
	gameState.player1.move();
	gameState.player2.move();
    }

    /**
     * @param {GameState} gameState
     */
    static ballCollision(gameState, canvasContext) {
	const ballAfterCollision = collision(gameState, canvasContext);
	gameState.ball = ballAfterCollision;
    }
}

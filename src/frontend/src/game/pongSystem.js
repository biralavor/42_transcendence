import { Ball, CanvasGameContext, GameState, Player } from "./pongEngine.js";

const MAX_PLAYER_VEL = 2;
const PLAYER_VEL_RESISTANCE_FACTOR = 0.95;
const PLAYER_VEL_INPUT_FACTOR = 7;

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
    gameState.player1.position.velY *= PLAYER_VEL_RESISTANCE_FACTOR;
    gameState.player2.position.velY *= PLAYER_VEL_RESISTANCE_FACTOR;
}

/**
 * @param {GameState} gameState
 * @param {GameInput} input
 */
function applyInput(gameState, input) {
    gameState.player1.position.velY += (input.player1.velY
                                        * PLAYER_VEL_INPUT_FACTOR
                                        * gameState.deltaFactor);
    gameState.player2.position.velY += (input.player2.velY
                                        * PLAYER_VEL_INPUT_FACTOR
                                        * gameState.deltaFactor);
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
    const gridWidth = canvasContext.widthRatio;
    const gridHeight = canvasContext.heightRatio;
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
    } else if (ballIntendedPosition.y >= gridHeight - newBall.size.height) {
        const overflow = ballIntendedPosition.y - (gridHeight - newBall.size.height);
        newBall.position.y = (gridHeight - newBall.size.height) - overflow;
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

/**
 * Resets the ball to the center of the grid with initial velocity.
 * @param {GameState} gameState
 * @param {CanvasGameContext} canvasContext
 * @param {import("./pongEngine.js").PlayerType} defending
 */
function resetBall(gameState, canvasContext, defending) {
    const gridWidth = canvasContext.widthRatio;
    const gridHeight = canvasContext.heightRatio;
    gameState.ball.position.x = gridWidth / 2 - gameState.ball.size.width / 2;
    gameState.ball.position.y = gridHeight / 2 - gameState.ball.size.height / 2;
    gameState.ball.position.velX = defending == Player.Type.ONE ? 4 : -4;
    gameState.ball.position.velY = 0;
}

/**
 * Detects if the ball has fully exited the left or right boundary.
 * Awards a point to the scoring player and resets the ball to center.
 * Left exit  → player2 scores (ball passed player1's goal line).
 * Right exit → player1 scores (ball passed player2's goal line).
 * @param {GameState} gameState
 * @param {CanvasGameContext} canvasContext
 * @returns {boolean} true if a goal was scored this tick, false otherwise
 */
function goalDetection(gameState, canvasContext) {
    const gridWidth = canvasContext.widthRatio;
    const ball = gameState.ball;

    if (ball.position.x + ball.size.width <= 0) {
        gameState.score.player2 += 1;
        resetBall(gameState, canvasContext, Player.Type.ONE);
        return true;
    } else if (ball.position.x >= gridWidth) {
        gameState.score.player1 += 1;
        resetBall(gameState, canvasContext, Player.Type.TWO);
        return true;
    }
    return false;
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
     * @param {CanvasGameContext} canvasContext
     */
    static ballCollision(gameState, canvasContext) {
        const ballAfterCollision = collision(gameState, canvasContext);
        gameState.ball = ballAfterCollision;
    }

    /**
     * @param {GameState} gameState
     * @param {CanvasGameContext} canvasContext
     * @returns {boolean} true if a goal was scored this tick, false otherwise
     */
    static goalDetection(gameState, canvasContext) {
        return goalDetection(gameState, canvasContext);
    }
}

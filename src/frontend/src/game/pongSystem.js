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
  for (let player of gameState.players) {
    player.position.velY *= PLAYER_VEL_RESISTANCE_FACTOR;
  }
}

/**
 * @param {GameState} gameState
 * @param {GameInput} input
 */
function applyInput(gameState, input) {
  const players = gameState.players;
  const inputs = [input.player1, input.player2];

  for (let playerType = 1; playerType <= 2; ++playerType){
    const i = playerType - 1;
    const player = players[i];
    const playerInput = inputs[i];

    player.position.velY += (playerInput.velY
                             * PLAYER_VEL_INPUT_FACTOR
                             * gameState.deltaFactor);
  }
}


/**
 * @param {GameState} gameState
 * @param {CanvasGameContext} canvasContext
 */
function clampPlayerBounds(gameState, canvasContext) {
  const gridHeight = canvasContext.heightRatio;

  for (let player of gameState.players) {
    if (player.position.y < (-player.size.height)) {
      player.position.y = (-player.size.height);
      player.position.velY = 0;
    } else if (player.position.y > gridHeight) {
      player.position.y = gridHeight;
      player.position.velY = 0;
    }
  }
}

/**
 * @param {GameState} gameState
 */
function clampMaxVelocity(gameState) {
  for (let player of gameState.players) {
    player.position.velY =
      player.position.velY > MAX_PLAYER_VEL
      ? MAX_PLAYER_VEL
      : player.position.velY;
    player.position.velY =
      player.position.velY < -MAX_PLAYER_VEL
      ? -MAX_PLAYER_VEL
      : player.position.velY;
  }
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
  if (gameState.isPlayer1Defending && gameState.player1.isCollidingWith(newBall)) {
    // angle change from player vertical speed
    newBall.position.velY += 0.4 * gameState.player1.position.velY;
    // angle change from edge collision
    newBall.position.velY += gameState.player1.edgeCollisionFactor(newBall)
    const p1Surface = gameState.player1.position.x + gameState.player1.size.width;
    const ballSurface = ballIntendedPosition.x;
    const overflow = p1Surface - ballSurface;
    newBall.position.x = p1Surface + overflow;
    newBall.position.velX = -ballIntendedPosition.velX;

  } else if (gameState.isPlayer2Defending && gameState.player2.isCollidingWith(newBall)) {
    newBall.position.velY += 0.4 * gameState.player2.position.velY;
    newBall.position.velY += gameState.player2.edgeCollisionFactor(newBall)

    const p2Surface = gameState.player2.position.x;
    const ballSurface = ballIntendedPosition.x + newBall.size.width;
    const overflow = p2Surface - ballSurface;
    newBall.position.x = p2Surface + overflow - newBall.size.width;
    newBall.position.velX = -ballIntendedPosition.velX;

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
  gameState.ball.position.velX = defending == Player.Type.ONE ? -4 : 4;
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
    resetBall(gameState, canvasContext, Player.Type.TWO);
    return true;
  } else if (ball.position.x >= gridWidth) {
    gameState.score.player1 += 1;
    resetBall(gameState, canvasContext, Player.Type.ONE);
    return true;
  }
  return false;
}


export default class System {

  /**
   * @param {GameState} gameState
   * @param {GameInput} input
   * @param {CanvasGameContext} canvasContext
   */
  static playerMovement(gameState, input, canvasContext) {
    desaceleratePlayers(gameState);
    applyInput(gameState, input);
    clampMaxVelocity(gameState);
    gameState.player1.move();
    gameState.player2.move();
    clampPlayerBounds(gameState, canvasContext);
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

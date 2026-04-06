/**
 * pongEngine.js — pure game logic, no DOM, no React.
 * Consumed by:
 *   - src/Components/PongCanvas.jsx  (React SPA)
 */

import { Callbacks } from './pongExternal.js';
import { CanvasGameContext, heightRatio, render, widthRatio } from './pongRenderer.js';
import { Player, Ball } from './pongEntities.js';
import System from './pongSystem.js';

export class GameState {
  static targetFrameRate = 30;                      //frame per second
  static timeFrameMillis = 1000 / GameState.targetFrameRate; //millis per frame
  #currentFrameTime
  #currentFrameCount

  constructor(player1Kind, player2Kind) {
    /** @type {Player} */
    this.player1 = new Player(Player.Type.ONE, player1Kind);
    /** @type {Player} */
    this.player2 = new Player(Player.Type.TWO, player2Kind);
    /** @type {Ball} */
    this.ball = new Ball();
    this.ball.position.velX = 4;
    this.ball.position.velY = 0;
    /** @type {{ player1: number, player2: number }} */
    this.score = { player1: 0, player2: 0 };
    this.#currentFrameTime = performance.now();
    this.#currentFrameCount = 0n;
    /** @type {[Player]} */
    this.players = [this.player1, this.player2];
    /** @type {[Player]} */
    this.localPlayers = this.players.filter(player => player.isLocal)
    /** @type {[Player]} */
    this.remotePlayers = this.players.filter(player => player.isRemote)
  }

  get isPlayer1Defending() {
    return this.ball.position.velX < 0
  }

  get canPlayer1Defend() {
    return this.isPlayer1Defending
      && this.ball.position.x > this.player1.position.x + this.player1.size.width;
  }

  get isPlayer2Defending() {
    return this.ball.position.velX > 0
  }

  get canPlayer2Defend() {
    return this.isPlayer2Defending
      && this.ball.position.x + this.ball.size.width < this.player2.position.x;
  }

  addFrame() {
    this.#currentFrameTime += GameState.timeFrameMillis;
    ++(this.#currentFrameCount);
  }

  shouldAddFrame(time) {
    return time > this.#currentFrameTime + GameState.timeFrameMillis;
  }

  get isLocalOnly() {
    return this.player1.kind == 'local'
    && this.player2.kind == 'local'
  }

  get isLocalDefending() {
    return (this.isPlayer1Defending && this.player1.isLocal)
      || (this.isPlayer2Defending && this.player2.isLocal)
  }

  get isLocalCourt() {
    return (this.player1.isLocal && this.player2.isLocal)
      || (this.player1.isLocal && this.ball.position.x < (widthRatio / 2))
      || (this.player2.isLocal && this.ball.position.x > (widthRatio / 2))
  }

  get shouldBroadcastGameEvents() {
    // TODO revise this logic
    return (this.isPlayer1Defending && this.player2.isRemote)
      || (this.isPlayer2Defending && this.player1.isRemote);
  }

  get frameCount() {
    return this.#currentFrameCount;
  }
}

/**
 * @param {CanvasGameContext} canvasContext
 * @param {GameState} gameState
 * @param {Callbacks} callbacks
 */
export function gameLoop(canvasContext, gameState, callbacks) {
  const time = performance.now();

  while (gameState.shouldAddFrame(time)) {
    gameState.addFrame();
    System.playersMovement(gameState, canvasContext, callbacks);
    if (!callbacks.isKickoff()) {
      if (gameState.isLocalDefending || gameState.isLocalCourt) {
        console.log('local defending')
        const remoteBallPosition = callbacks
              .getRemoteBallPosition(gameState.ball.position.frame);
        let ballAfterColision;
        if (remoteBallPosition == null) {
          ballAfterColision = System.ballCollision(gameState, canvasContext)
        } else {
          ballAfterColision = Ball.copy(gameState.ball);
          ballAfterColision.position = remoteBallPosition;
        }
        gameState.ball = ballAfterColision;
        const scored = System.goalDetection(gameState, canvasContext);
        if (scored) callbacks.onGoal();
      } else {
        console.log('remote defending')
        const remoteBallPosition = callbacks
              .getRemoteBallPosition(gameState.ball.position.frame);
        let ballAfterColision;
        if (remoteBallPosition == null) {
          console.log('skip ball frame')
          // do not update, keep frame count, frame skip
          ballAfterColision = gameState.ball;
          // TODO check if should freeze game due to lag
          // check gameState frame vs ball frame
        } else {
          ballAfterColision = Ball.copy(gameState.ball)
          ballAfterColision.position = remoteBallPosition
        }
        gameState.ball = ballAfterColision;
        const scored = System.goalDetection(gameState, canvasContext);
        if (scored) callbacks.onGoal();
      }
    }

    if (gameState.shouldBroadcastGameEvents) {
      // TODO
      //console.log('broadcast game relevant state to server')
      // local player most recent position
      // ball bounces into local player / goal
    }
  }
  render(canvasContext, gameState, callbacks.isKickoff);
}

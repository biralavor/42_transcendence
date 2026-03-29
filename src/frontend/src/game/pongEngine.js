/**
 * pongEngine.js — pure game logic, no DOM, no React.
 * Consumed by:
 *   - src/Components/PongCanvas.jsx  (React SPA)
 */

import { Callbacks } from './pongExternal.js';
import { CanvasGameContext, heightRatio, render, widthRatio } from './pongRenderer.js';
import System from './pongSystem.js';

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

  /**
   * @param {{position: Position; size: Size}} other
   */
  isCollidingWith(other) {
    return (
      this.position.x < other.position.x + other.size.width
        && this.position.x + this.size.width > other.position.x
        && this.position.y < other.position.y + other.size.height
        && this.position.y + this.size.height > other.position.y
    );
  }
}

/**
 * @typedef {(1|2)} PlayerType
 */
/**
 * @typedef {('ONE'|'TWO')} PlayerKey
 */
/**
 * @typedef {('local'|'remote-ai'|'remote-human')} PlayerKind
 */

export class Player extends Entity {

  /**
   * @readonly
   * @type {Readonly<{ONE: 1; TWO: 2}>}
   */
  static Type = Object.freeze({
    ONE: 1,
    TWO: 2
  });

  static #blockSize = 5;
  static #edgeSize = new Size(Player.#blockSize, Player.#blockSize / 2);
  static #extremeEdgeSize = new Size(Player.#blockSize, 0.5);
  static #normalFactor = 0.4;
  static #extremeFactor = 0.8;
  /**
   * @param {PlayerType} type
   * @param {PlayerKind} kind
   */
  constructor(type, kind) {
    super();
    /** @type {PlayerType} */
    this.type = type;
    /** @type {PlayerKind} */
    this.kind = kind;
    /** @type {Size} */
    this.size = new Size(Player.#blockSize, 3 * Player.#blockSize);
    if (type === Player.Type.ONE) {
      /** @type {Position} */
      this.position = new Position(2 * this.size.width,
                                   heightRatio / 2 - (this.size.height / 2));
      this.color = 'white';
    } else {
      this.position = new Position(widthRatio - 3 * this.size.width,
                                   heightRatio / 2 - (this.size.height / 2));
      this.color = 'white';
    }
  }

  get isLocal() {
    return this.kind == 'local';
  }

  get isRemote() {
    return this.kind.startsWith('remote-');
  }

  /**
   * @param {Ball} ball
   */
  edgeCollisionFactor(ball) {

    const ballExtreme = Ball.copy(ball)
    ballExtreme.size.height = ball.size.height / 1.5;


    const extremeTop = {
      position: this.position,
      size: Player.#extremeEdgeSize
    };
    if (ballExtreme.isCollidingWith(extremeTop)) {
      console.log('extreme top')
      return -Player.#extremeFactor;
    }
    const top = {
      position: this.position,
      size: Player.#edgeSize
    };
    if (ball.isCollidingWith(top)) {
      console.log('top')
      return -Player.#normalFactor;
    }

    const extremeBottom = {
      position: {
        x: this.position.x,
        y: this.position.y + (3 * Player.#blockSize) - Player.#extremeEdgeSize.height
      },
      size: Player.#extremeEdgeSize
    };
    if (ballExtreme.isCollidingWith(extremeBottom)) {
      console.log('extreme bottom')
      return Player.#extremeFactor;
    }
    const bottom = {
      position: {
        x: this.position.x,
        y: this.position.y + (3 * Player.#blockSize) - Player.#edgeSize.height
      },
      size: Player.#edgeSize
    }
    if (ball.isCollidingWith(bottom)) {
      console.log('bottom')
      return Player.#normalFactor;
    }
    return 0;
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

  get shouldBroadcastGameEvents() {
    // TODO revise this logic
    return (this.isPlayer1Defending && this.player2.isRemote)
      || (this.isPlayer1Defending && this.player1.isRemote);
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
      if (gameState.isLocalDefending) {
        console.log('local defending')
        System.ballCollision(gameState, canvasContext);
        const scored = System.goalDetection(gameState, canvasContext);
        if (scored) callbacks.onGoal();
      } else {
        console.log('remote defending')
        // TODO replace by ball remote input
        System.ballCollision(gameState, canvasContext);
        const scored = System.goalDetection(gameState, canvasContext);
        if (scored) callbacks.onGoal();
      }
    }

    render(canvasContext, gameState, callbacks.isKickoff);
    if (gameState.shouldBroadcastGameEvents) {
      // TODO
      console.log('broadcast game relevant state to server')
      // local player most recent position
      // ball bounces into local player / goal
    }
  }
}

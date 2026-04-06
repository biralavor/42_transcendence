/**
 * @typedef {import("./pongEntities.js").Player} Player
 */

/**
 * @typedef {import("./pongEntities.js").Ball} Ball
 */

/**
 * @typedef {import("./pongEntities.js").Position} Position
 */

/**
 * @typedef {Object} PlayerInput
 * @property {number} velY - Vertical velocity
 * @property {number} velX - Horizontal velocity
 */

/**
 * @typedef {Object} GameInput
 * @property {PlayerInput?} player1
 * @property {PlayerInput?} player2
 */


export class Callbacks {
  /**
   * @param {() => GameInput} getInput - returns {player1: {velY, velX}, player2: {velY, velX}}
   * @param {() => boolean} isKickoff - returns true when game is paused after goal
   * @param {() => void} onGoal - called when a goal is scored
   * @param {(player: Player) => Position?} getRemotePlayerPosition
   * @param {(frame: BigInt) => Position?} getRemoteBallPosition
   */
  constructor(
    getInput,
    isKickoff,
    onGoal,
    getRemotePlayerPosition,
    getRemoteBallPosition
  ) {
    /** @type {() => GameInput} - returns {player1: {velY, velX}, player2: {velY, velX}} */
    this.getInput = getInput;
    /** @type {() => boolean} - returns boolean */
    this.isKickoff = isKickoff;
    /** @type {() => void}  */
    this.onGoal = onGoal;
    /** @type {(player: Player) => Position?}  */
    this.getRemotePlayerPosition = getRemotePlayerPosition;
    /** @type {(frame: BigInt) => Position?}  */
    this.getRemoteBallPosition = getRemoteBallPosition;
  }
}

/**
 * @typedef {Object} PlayerInput
 * @property {number} velY - Vertical velocity
 * @property {number} velX - Horizontal velocity
 */

import { Player, Ball, Position } from "./pongEntities.js";

/**
 * @typedef {Object} GameInput
 * @property {PlayerInput} player1
 * @property {PlayerInput} player2
 */


export class Callbacks {
  /**
   * @param {() => GameInput} getInput - returns {player1: {velY, velX}, player2: {velY, velX}}
   * @param {() => boolean} isKickoff - returns true when game is paused after goal
   * @param {() => void} onGoal - called when a goal is scored
   * @param {(Player) => Position} getRemotePlayerPosition
   * @param {(BigInt) => Position} getRemoteBallPosition
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
    /** @type {(Player) => Position}  */
    this.getRemotePlayerPosition = getRemotePlayerPosition;
    /** @type {(BigInt) => Position}  */
    this.getRemoteBallPosition = getRemoteBallPosition;
  }
}

/**
 * @typedef {Object} PlayerInput
 * @property {number} velY - Vertical velocity
 * @property {number} velX - Horizontal velocity
 */

import { Player, Position } from "./pongEngine";

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
   */
  constructor(
    getInput,
    isKickoff,
    onGoal,
    getRemotePlayerPosition
  ) {
    /** @type {() => GameInput} - returns {player1: {velY, velX}, player2: {velY, velX}} */
    this.getInput = getInput;
    /** @type {() => boolean} - returns boolean */
    this.isKickoff = isKickoff;
    /** @type {() => void}  */
    this.onGoal = onGoal;
    /** @type {(Player) => Position}  */
    this.getRemotePlayerPosition = getRemotePlayerPosition;
  }
}

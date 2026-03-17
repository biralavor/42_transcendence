import { describe, it, expect, beforeEach } from 'vitest'
import System from './pongSystem.js'
import { GameState } from './pongEngine.js'

// Mirrors the game-world dimensions from pongEngine.js.
// If those constants ever change, update this mock to match.
const mockCanvasContext = {
    widthRatio: 160,
    heightRatio: 90,
}

describe('System.goalDetection', () => {

    /** @type {GameState} */
    let state

    beforeEach(() => {
        state = new GameState()
    })

    it('awards player2 a point when ball exits the left boundary', () => {
        state.ball.position.x = -state.ball.size.width - 1  // fully off left
        System.goalDetection(state, mockCanvasContext)
        expect(state.score.player2).toBe(1)
        expect(state.score.player1).toBe(0)
    })

    it('awards player1 a point when ball exits the right boundary', () => {
        state.ball.position.x = mockCanvasContext.widthRatio + 1  // fully off right
        System.goalDetection(state, mockCanvasContext)
        expect(state.score.player1).toBe(1)
        expect(state.score.player2).toBe(0)
    })

    it('resets ball to center after a left goal', () => {
        const ballWidth = state.ball.size.width
        const ballHeight = state.ball.size.height
        state.ball.position.x = -ballWidth - 1
        System.goalDetection(state, mockCanvasContext)
        expect(state.ball.position.x).toBeCloseTo(mockCanvasContext.widthRatio / 2 - ballWidth / 2)
        expect(state.ball.position.y).toBeCloseTo(mockCanvasContext.heightRatio / 2 - ballHeight / 2)
    })

    it('resets ball to center after a right goal', () => {
        const ballWidth = state.ball.size.width
        const ballHeight = state.ball.size.height
        state.ball.position.x = mockCanvasContext.widthRatio + 1
        System.goalDetection(state, mockCanvasContext)
        expect(state.ball.position.x).toBeCloseTo(mockCanvasContext.widthRatio / 2 - ballWidth / 2)
        expect(state.ball.position.y).toBeCloseTo(mockCanvasContext.heightRatio / 2 - ballHeight / 2)
    })

    it('resets ball velocity to initial after a left goal', () => {
        state.ball.position.x = -state.ball.size.width - 1
        state.ball.position.velX = -7
        state.ball.position.velY = 3
        System.goalDetection(state, mockCanvasContext)
        expect(state.ball.position.velX).toBe(4)
        expect(state.ball.position.velY).toBe(0)
    })

    it('resets ball velocity to initial after a right goal', () => {
        state.ball.position.x = mockCanvasContext.widthRatio + 1
        state.ball.position.velX = 7
        state.ball.position.velY = -3
        System.goalDetection(state, mockCanvasContext)
        expect(state.ball.position.velX).toBe(4)
        expect(state.ball.position.velY).toBe(0)
    })

    it('does nothing when ball is in play', () => {
        state.ball.position.x = 80  // mid-field
        System.goalDetection(state, mockCanvasContext)
        expect(state.score.player1).toBe(0)
        expect(state.score.player2).toBe(0)
    })

    it('accumulates score across multiple goals', () => {
        state.ball.position.x = -state.ball.size.width - 1
        System.goalDetection(state, mockCanvasContext)
        state.ball.position.x = -state.ball.size.width - 1
        System.goalDetection(state, mockCanvasContext)
        expect(state.score.player2).toBe(2)
    })
})

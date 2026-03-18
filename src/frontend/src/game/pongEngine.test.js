import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gameLoop, GameState } from './pongEngine.js'

// Minimal canvas context mock — only what gameLoop/render needs
const mockCanvasContext = {
    widthRatio: 160,
    heightRatio: 90,
    widthScale: 1,
    heightScale: 1,
    rendering2d: {
        reset: vi.fn(),
        fillStyle: '',
        fillRect: vi.fn(),
    },
}

describe('gameLoop', () => {

    /** @type {GameState} */
    let state
    let setGameState
    let getInput

    beforeEach(() => {
        vi.clearAllMocks()
        state = new GameState()
        setGameState = vi.fn()
        getInput = vi.fn().mockReturnValue({
            player1: { velY: 0, velX: 0 },
            player2: { velY: 0, velX: 0 },
        })
    })

    it('calls onGoal when the ball exits a boundary', () => {
        // Ball must remain out of bounds even after moving 4px (default velocity)
        // Check: (x + velX) + size.width <= 0
        // We need: (-10 + 4) + 5 = -1 <= 0 ✓
        state.ball.position.x = -10
        const onGoal = vi.fn()
        const isPaused = () => false

        gameLoop(mockCanvasContext, state, setGameState, getInput, isPaused, onGoal)

        expect(onGoal).toHaveBeenCalledTimes(1)
    })

    it('does not call onGoal when ball is in play', () => {
        state.ball.position.x = 80  // mid-field
        const onGoal = vi.fn()
        const isPaused = () => false

        gameLoop(mockCanvasContext, state, setGameState, getInput, isPaused, onGoal)

        expect(onGoal).not.toHaveBeenCalled()
    })

    it('skips physics and onGoal when isPaused returns true', () => {
        state.ball.position.x = -state.ball.size.width - 1  // would score
        const onGoal = vi.fn()
        const isPaused = () => true
        const scoreBefore = state.score.player2

        gameLoop(mockCanvasContext, state, setGameState, getInput, isPaused, onGoal)

        expect(onGoal).not.toHaveBeenCalled()
        expect(state.score.player2).toBe(scoreBefore)  // score unchanged
    })

    it('still calls render and setGameState when paused', () => {
        const onGoal = vi.fn()
        const isPaused = () => true

        gameLoop(mockCanvasContext, state, setGameState, getInput, isPaused, onGoal)

        expect(setGameState).toHaveBeenCalledTimes(1)
        expect(mockCanvasContext.rendering2d.reset).toHaveBeenCalled()
    })
})

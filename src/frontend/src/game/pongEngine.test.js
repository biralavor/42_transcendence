import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
        strokeStyle: '',
        lineWidth: 0,
        font: '',
        fillRect: vi.fn(),
        fillText: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        roundRect: vi.fn(),
        stroke: vi.fn(),
    },
}

describe('gameLoop', () => {

    /** @type {GameState} */
    let state
    let getInput

    beforeEach(() => {
        vi.restoreAllMocks()
        // First call goes to GameState constructor (#currentFrameTime = 0),
        // subsequent calls return 40 so gameLoop sees exactly one frame elapsed
        // (GameState.timeFrameMillis = 33.33ms at 30 fps, 40 > 33.33)
        let nowCalls = 0
        vi.spyOn(performance, 'now').mockImplementation(() => nowCalls++ === 0 ? 0 : 40)
        state = new GameState('local', 'local')
        getInput = vi.fn().mockReturnValue({
            player1: { velY: 0, velX: 0 },
            player2: { velY: 0, velX: 0 },
        })
    })

    function makeCallbacks(overrides = {}) {
        return {
            isKickoff: () => false,
            getRemoteBallPosition: () => null,
            getRemotePlayerPosition: () => null,
            getInput,
            onGoal: vi.fn(),
            ...overrides,
        }
    }

    it('calls onGoal when the ball exits a boundary', () => {
        // Ball must remain out of bounds even after moving 4px (default velocity)
        // Check: (x + velX) + size.width <= 0
        // We need: (-10 + 4) + 5 = -1 <= 0 ✓
        state.ball.position.x = -10
        const callbacks = makeCallbacks()

        gameLoop(mockCanvasContext, state, callbacks)

        expect(callbacks.onGoal).toHaveBeenCalledTimes(1)
    })

    it('does not call onGoal when ball is in play', () => {
        state.ball.position.x = 80  // mid-field
        const callbacks = makeCallbacks()

        gameLoop(mockCanvasContext, state, callbacks)

        expect(callbacks.onGoal).not.toHaveBeenCalled()
    })

    it('skips physics and onGoal when isPaused returns true', () => {
        state.ball.position.x = -state.ball.size.width - 1  // would score
        const scoreBefore = state.score.player2
        const callbacks = makeCallbacks({ isKickoff: () => true })

        gameLoop(mockCanvasContext, state, callbacks)

        expect(callbacks.onGoal).not.toHaveBeenCalled()
        expect(state.score.player2).toBe(scoreBefore)  // score unchanged
    })

    it('still calls render when paused', () => {
        const callbacks = makeCallbacks({ isKickoff: () => true })

        gameLoop(mockCanvasContext, state, callbacks)

        expect(mockCanvasContext.rendering2d.reset).toHaveBeenCalled()
    })
})

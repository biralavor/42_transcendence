import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gameLoop, GameState } from './pongEngine.js'

function makeMockRendering2d() {
    return {
        reset: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        font: '',
        shadowColor: '',
        shadowBlur: 0,
        fillRect: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        roundRect: vi.fn(),
        stroke: vi.fn(),
        drawImage: vi.fn(),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    }
}

// Minimal canvas context mock — only what gameLoop/render needs
const mockCanvasContext = {
    widthRatio: 160,
    heightRatio: 90,
    widthScale: 1,
    heightScale: 1,
    width: 160,
    height: 90,
    primaryColor: '#fff',
    crtWhite: '#fff',
    rendering2d: makeMockRendering2d(),
}

describe('gameLoop', () => {

    /** @type {GameState} */
    let state
    let getInput

    beforeEach(() => {
        vi.restoreAllMocks()
        mockCanvasContext.rendering2d = makeMockRendering2d()
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

    it('draws dim overlay when themeImages has a background', () => {
        const fakeImg = {}
        const themeImages = { background: fakeImg, ball: null, paddleLeft: null, paddleRight: null }
        const callbacks = makeCallbacks({ isKickoff: () => true })

        gameLoop(mockCanvasContext, state, callbacks, themeImages)

        expect(mockCanvasContext.rendering2d.drawImage).toHaveBeenCalledWith(fakeImg, 0, 0, 160, 90)
        // Overlay fillRect must follow drawImage — check fillRect was called at all
        expect(mockCanvasContext.rendering2d.fillRect).toHaveBeenCalled()
    })

    it('does not call drawImage for classic theme (no background)', () => {
        const callbacks = makeCallbacks({ isKickoff: () => true })

        gameLoop(mockCanvasContext, state, callbacks, null)

        expect(mockCanvasContext.rendering2d.drawImage).not.toHaveBeenCalled()
    })

    it('sets shadowBlur on score for neon themes', () => {
        const callbacks = makeCallbacks({ isKickoff: () => true })
        let capturedShadowBlur = 0
        mockCanvasContext.rendering2d.fillText = vi.fn().mockImplementation(() => {
            capturedShadowBlur = mockCanvasContext.rendering2d.shadowBlur
        })

        gameLoop(mockCanvasContext, state, callbacks, null, 'neon-pong')

        expect(capturedShadowBlur).toBeGreaterThan(0)
    })

    it('does not set shadowBlur for classic theme', () => {
        const callbacks = makeCallbacks({ isKickoff: () => true })
        let capturedShadowBlur = 0
        mockCanvasContext.rendering2d.fillText = vi.fn().mockImplementation(() => {
            capturedShadowBlur = mockCanvasContext.rendering2d.shadowBlur
        })

        gameLoop(mockCanvasContext, state, callbacks, null, '')

        expect(capturedShadowBlur).toBe(0)
    })

    it('calls strokeText and createLinearGradient for neon-pong theme', () => {
        const callbacks = makeCallbacks({ isKickoff: () => true })

        gameLoop(mockCanvasContext, state, callbacks, null, 'neon-pong')

        expect(mockCanvasContext.rendering2d.createLinearGradient).toHaveBeenCalled()
        expect(mockCanvasContext.rendering2d.strokeText).toHaveBeenCalled()
    })

    it('does not call strokeText for non-neon-pong neon themes', () => {
        const callbacks = makeCallbacks({ isKickoff: () => true })

        gameLoop(mockCanvasContext, state, callbacks, null, 'neon-two-paddle')

        expect(mockCanvasContext.rendering2d.strokeText).not.toHaveBeenCalled()
    })

    it('neon-pong ball uses pink fill without drawImage', () => {
        const themeImages = { background: null, ball: {}, paddleLeft: null, paddleRight: null }
        const callbacks = makeCallbacks({ isKickoff: () => false })
        state.ball.position.x = 80
        state.ball.position.y = 45

        gameLoop(mockCanvasContext, state, callbacks, themeImages, 'neon-pong')

        expect(mockCanvasContext.rendering2d.drawImage).not.toHaveBeenCalled()
        // fillRect is called for both midfield strips and the pink ball
        expect(mockCanvasContext.rendering2d.fillRect).toHaveBeenCalled()
    })

    it('neon-two-paddle ball draws a cyan strokeRect', () => {
        const callbacks = makeCallbacks({ isKickoff: () => false })
        state.ball.position.x = 80
        state.ball.position.y = 45
        // strokeRect calls: 1 outer border + 1 ball stroke = 2
        gameLoop(mockCanvasContext, state, callbacks, null, 'neon-two-paddle')

        expect(mockCanvasContext.rendering2d.strokeRect).toHaveBeenCalledTimes(2)
    })

    it('neon-central-paddle ball draws a green strokeRect', () => {
        const callbacks = makeCallbacks({ isKickoff: () => false })
        state.ball.position.x = 80
        state.ball.position.y = 45

        gameLoop(mockCanvasContext, state, callbacks, null, 'neon-central-paddle')

        expect(mockCanvasContext.rendering2d.strokeRect).toHaveBeenCalledTimes(2)
    })

    it('classic theme ball uses drawImage when themeImages.ball is present', () => {
        const fakeImg = {}
        const themeImages = { background: null, ball: fakeImg, paddleLeft: null, paddleRight: null }
        const callbacks = makeCallbacks({ isKickoff: () => false })
        state.ball.position.x = 80
        state.ball.position.y = 45

        gameLoop(mockCanvasContext, state, callbacks, themeImages, 'wood')

        expect(mockCanvasContext.rendering2d.drawImage).toHaveBeenCalledWith(fakeImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number))
    })
})

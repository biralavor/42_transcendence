import { render } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('../game/pongEngine.js', () => ({
  GameState: vi.fn().mockImplementation(() => ({
    score: { player1: 0, player2: 0 },
    speedMultiplier: 1,
    ball: { position: { velX: 4 }, color: '' },
    player1: { color: '' },
    player2: { color: '' },
    frameCount: 0n,
  })),
  gameLoop: vi.fn(),
}))
vi.mock('../game/pongRenderer.js', () => ({
  CanvasGameContext: vi.fn().mockImplementation(() => ({ crtWhite: '#fff' })),
  heightRatio: 1,
}))
vi.mock('../game/pongSystem.js', () => ({ default: {} }))
vi.mock('../game/pongExternal.js', () => ({ Callbacks: vi.fn() }))
vi.mock('../game/themeLoader.js', () => ({ loadThemeImages: vi.fn().mockResolvedValue(null) }))
vi.mock('../game/themes.js', () => ({ THEMES: { classic: {} } }))
vi.mock('../context/gameSettingsContext', () => ({
  useGameSettings: () => ({ theme: 'classic', ballSpeedMultiplier: 1 }),
}))

import PongCanvas from './PongCanvas'
import { GameState } from '../game/pongEngine.js'
import { Callbacks } from '../game/pongExternal.js'

describe('PongCanvas win detection', () => {
  it('calls onGameEnd with p1 winner when player1 reaches WIN_SCORE', () => {
    const onGameEnd = vi.fn()
    render(<PongCanvas player1Kind="local" player2Kind="local" onGameEnd={onGameEnd} />)

    const callbacksInstance = Callbacks.mock.calls[0]
    const gameState = GameState.mock.results[0].value
    gameState.score.player1 = 10

    const onGoalCb = callbacksInstance[2]
    expect(typeof onGoalCb).toBe('function')
    onGoalCb()

    expect(onGameEnd).toHaveBeenCalledWith({
      winner: 'p1',
      score_p1: 10,
      score_p2: 0,
    })
  })

  it('calls onGameEnd with p2 winner when player2 reaches WIN_SCORE', () => {
    const onGameEnd = vi.fn()
    render(<PongCanvas player1Kind="local" player2Kind="local" onGameEnd={onGameEnd} />)

    const callbacksInstance = Callbacks.mock.calls[Callbacks.mock.calls.length - 1]
    const gameState = GameState.mock.results[GameState.mock.results.length - 1].value
    gameState.score.player2 = 10

    const onGoalCb = callbacksInstance[2]
    expect(typeof onGoalCb).toBe('function')
    onGoalCb()

    expect(onGameEnd).toHaveBeenCalledWith({
      winner: 'p2',
      score_p1: 0,
      score_p2: 10,
    })
  })

  it('does not call onGameEnd when score is below WIN_SCORE', () => {
    const onGameEnd = vi.fn()
    render(<PongCanvas player1Kind="local" player2Kind="local" onGameEnd={onGameEnd} />)

    const callbacksInstance = Callbacks.mock.calls[Callbacks.mock.calls.length - 1]
    const gameState = GameState.mock.results[GameState.mock.results.length - 1].value
    gameState.score.player1 = 9  // one below WIN_SCORE

    const onGoalCb = callbacksInstance[2]
    expect(typeof onGoalCb).toBe('function')
    onGoalCb()

    expect(onGameEnd).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { installCanvasContextStub } from './__test-harness__/canvasMock'
import { installWebSocketStub, lastSocket } from './__test-harness__/wsMock'

vi.mock('../context/authContext', () => ({
  useAuth: () => ({ auth: { access_token: 'tok-abc' } }),
}))
vi.mock('../context/gameSettingsContext', () => ({
  useGameSettings: () => ({ theme: 'classic' }),
}))
vi.mock('../game/themeLoader', () => ({
  loadThemeImages: () => Promise.resolve(null),
}))
vi.mock('../game/pongRenderer.js', () => ({
  CanvasGameContext: vi.fn(function () {
    this.crtWhite = '#fff'
  }),
  render: vi.fn(),
  widthRatio: 1024,
  heightRatio: 512,
}))
vi.mock('../game/pongEngine.js', () => ({
  GameState: vi.fn(function () {
    this.player1 = { color: '', position: { x: 0, y: 0 }, size: { width: 8, height: 32 } }
    this.player2 = { color: '', position: { x: 0, y: 0 }, size: { width: 8, height: 32 } }
    this.ball = { color: '', position: { x: 0, y: 0 }, size: { width: 8, height: 8 } }
    this.score = { player1: 0, player2: 0 }
  }),
}))

import PongCanvasMultiplayer from './PongCanvasMultiplayer'

beforeEach(() => {
  installCanvasContextStub()
  installWebSocketStub()
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function renderComponent(props = {}) {
  return render(
    <PongCanvasMultiplayer
      gameId="game-1"
      player1Id="11"
      player2Id="22"
      onGameEnd={vi.fn()}
      {...props}
    />
  )
}

describe('PongCanvasMultiplayer — connection lifecycle', () => {
  it('shows the "Connecting to server..." overlay before WS opens', () => {
    renderComponent()
    expect(screen.getByText(/connecting to server/i)).toBeInTheDocument()
  })

  it('opens a WebSocket pointing at /api/game/ws/game/<gameId> with the auth token', () => {
    renderComponent()
    const ws = lastSocket()
    expect(ws).toBeTruthy()
    expect(ws.url).toContain('/api/game/ws/game/game-1')
    expect(ws.url).toContain('token=tok-abc')
  })

  it('hides the "connecting" overlay and sends game_start once WS opens', () => {
    renderComponent()
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    expect(screen.queryByText(/connecting to server/i)).not.toBeInTheDocument()
    expect(ws.sentMessages.length).toBe(1)
    const payload = JSON.parse(ws.sentMessages[0])
    expect(payload).toMatchObject({
      type: 'game_start',
      player1_id: 11,
      player2_id: 22,
    })
  })

  it('shows the error overlay when WS fires onerror', () => {
    renderComponent()
    const ws = lastSocket()
    act(() => ws.simulateError())
    expect(screen.getByText(/websocket connection error/i)).toBeInTheDocument()
  })

  it('closes the WebSocket on unmount', () => {
    const { unmount } = renderComponent()
    const ws = lastSocket()
    act(() => unmount())
    expect(ws.close).toHaveBeenCalled()
  })
})

describe('PongCanvasMultiplayer — server messages', () => {
  it('forwards game_over payload to the onGameEnd prop', () => {
    const onGameEnd = vi.fn()
    renderComponent({ onGameEnd })
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    act(() => ws.simulateMessage({
      type: 'game_over',
      winner_id: 11,
      score_p1: 10,
      score_p2: 7,
    }))
    expect(onGameEnd).toHaveBeenCalledWith({
      winner_id: 11,
      score_p1: 10,
      score_p2: 7,
      forfeit_reason: null,
    })
  })

  it('forwards forfeit_reason when game_over includes it', () => {
    const onGameEnd = vi.fn()
    renderComponent({ onGameEnd })
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    act(() => ws.simulateMessage({
      type: 'game_over',
      winner_id: 11,
      score_p1: 10,
      score_p2: 7,
      forfeit_reason: 'opponent_disconnected',
    }))
    expect(onGameEnd).toHaveBeenCalledWith({
      winner_id: 11,
      score_p1: 10,
      score_p2: 7,
      forfeit_reason: 'opponent_disconnected',
    })
  })

  it('shows the disconnect countdown overlay on opponent_disconnected', () => {
    renderComponent()
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    act(() => ws.simulateMessage({ type: 'opponent_disconnected', seconds_left: 25 }))
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('25s')).toBeInTheDocument()
  })

  it('hides the disconnect countdown overlay on opponent_reconnected', () => {
    renderComponent()
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    act(() => ws.simulateMessage({ type: 'opponent_disconnected', seconds_left: 20 }))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => ws.simulateMessage({ type: 'opponent_reconnected' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('hides the disconnect countdown overlay when game_over arrives', () => {
    const onGameEnd = vi.fn()
    renderComponent({ onGameEnd })
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    act(() => ws.simulateMessage({ type: 'opponent_disconnected', seconds_left: 10 }))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => ws.simulateMessage({ type: 'game_over', winner_id: 11, score_p1: 10, score_p2: 0 }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('ignores opponent_disconnected when seconds_left is not a finite number', () => {
    renderComponent()
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    act(() => ws.simulateMessage({ type: 'opponent_disconnected' }))            // missing
    act(() => ws.simulateMessage({ type: 'opponent_disconnected', seconds_left: 'bad' }))  // string
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not throw on malformed JSON in onmessage', () => {
    renderComponent()
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    expect(() => act(() => ws.simulateMessage('not-json'))).not.toThrow()
  })

  it('ignores unknown message types', () => {
    const onGameEnd = vi.fn()
    renderComponent({ onGameEnd })
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    act(() => ws.simulateMessage({ type: 'unknown-event' }))
    expect(onGameEnd).not.toHaveBeenCalled()
  })

  it('accepts a state message without crashing (smoke)', () => {
    renderComponent()
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    expect(() => act(() => ws.simulateMessage({
      type: 'state',
      ball: { x: 512, y: 256 },
      paddles: { p1: 100, p2: 200 },
      score: { p1: 3, p2: 2 },
    }))).not.toThrow()
  })
})

describe('PongCanvasMultiplayer — keyboard input', () => {
  function tickOnce() {
    return new Promise(r => setTimeout(r, 10))
  }

  beforeEach(() => {
    let ticked = false
    vi.stubGlobal('requestAnimationFrame', cb => {
      if (!ticked) { ticked = true; setTimeout(cb, 0) }
      return 1
    })
  })

  it('sends an "up" input message when W is pressed', async () => {
    renderComponent()
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    ws.sentMessages.length = 0
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })))
    await tickOnce()
    const inputs = ws.sentMessages.map(m => JSON.parse(m)).filter(p => p.type === 'input')
    expect(inputs.length).toBe(1)
    expect(inputs[0].direction).toBe('up')
  })

  it('sends a "down" input message when ArrowDown is pressed', async () => {
    renderComponent()
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    ws.sentMessages.length = 0
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' })))
    await tickOnce()
    const inputs = ws.sentMessages.map(m => JSON.parse(m)).filter(p => p.type === 'input')
    expect(inputs[inputs.length - 1].direction).toBe('down')
  })

  it('does not resend the same direction on consecutive ticks (no spam)', async () => {
    let count = 0
    vi.stubGlobal('requestAnimationFrame', cb => {
      if (count++ < 5) setTimeout(cb, 0)
      return 1
    })
    renderComponent()
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    ws.sentMessages.length = 0
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })))
    await new Promise(r => setTimeout(r, 50))
    const inputs = ws.sentMessages.map(m => JSON.parse(m)).filter(p => p.type === 'input')
    expect(inputs.length).toBe(1)
  })

  it('removes the keydown listener on unmount', () => {
    const { unmount } = renderComponent()
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    act(() => unmount())
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('keyup', expect.any(Function))
    removeSpy.mockRestore()
  })
})

describe('PongCanvasMultiplayer spectator mode', () => {
  it('does NOT send game_start on ws open when spectator=true', () => {
    renderComponent({ spectator: true })
    const ws = lastSocket()
    expect(ws).toBeTruthy()
    act(() => ws.simulateOpen())
    expect(ws.sentMessages.length).toBe(0)  // no game_start, no input frames
  })

  it('DOES send game_start on ws open when spectator is falsy (regression)', () => {
    renderComponent()
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    expect(ws.sentMessages.length).toBe(1)
    const sent = JSON.parse(ws.sentMessages[0])
    expect(sent.type).toBe('game_start')
    expect(sent.player1_id).toBe(11)
    expect(sent.player2_id).toBe(22)
  })

  it('does NOT bind keydown/keyup listeners when spectator=true', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    renderComponent({ spectator: true })
    const events = addSpy.mock.calls.map(([ev]) => ev)
    expect(events).not.toContain('keydown')
    expect(events).not.toContain('keyup')
    // resize is still bound (canvas rendering), so the gate is precise
    expect(events).toContain('resize')
    addSpy.mockRestore()
  })

  it('binds keydown/keyup listeners in default (non-spectator) mode', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    renderComponent()
    const events = addSpy.mock.calls.map(([ev]) => ev)
    expect(events).toContain('keydown')
    expect(events).toContain('keyup')
    addSpy.mockRestore()
  })

  it('calls onSpectatorCount when a spectator_count frame arrives', () => {
    const onSpectatorCount = vi.fn()
    renderComponent({ spectator: true, onSpectatorCount })
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    act(() => ws.simulateMessage({ type: 'spectator_count', count: 3 }))
    expect(onSpectatorCount).toHaveBeenCalledWith(3)
  })

  it('ignores malformed spectator_count frames (no count or wrong type)', () => {
    const onSpectatorCount = vi.fn()
    renderComponent({ spectator: true, onSpectatorCount })
    const ws = lastSocket()
    act(() => ws.simulateOpen())
    act(() => ws.simulateMessage({ type: 'spectator_count' }))             // missing count
    act(() => ws.simulateMessage({ type: 'spectator_count', count: '3' })) // wrong type
    expect(onSpectatorCount).not.toHaveBeenCalled()
  })
})

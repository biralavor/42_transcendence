import { describe, it, expect, vi } from 'vitest'
import { Callbacks } from './pongExternal.js'

describe('Callbacks', () => {
  it('stores all 5 callbacks as instance fields', () => {
    const getInput = vi.fn()
    const isKickoff = vi.fn()
    const onGoal = vi.fn()
    const getRemotePlayerPosition = vi.fn()
    const getRemoteBallPosition = vi.fn()

    const cb = new Callbacks(
      getInput, isKickoff, onGoal,
      getRemotePlayerPosition, getRemoteBallPosition,
    )

    expect(cb.getInput).toBe(getInput)
    expect(cb.isKickoff).toBe(isKickoff)
    expect(cb.onGoal).toBe(onGoal)
    expect(cb.getRemotePlayerPosition).toBe(getRemotePlayerPosition)
    expect(cb.getRemoteBallPosition).toBe(getRemoteBallPosition)
  })

  it('passes call arguments through to getRemotePlayerPosition unchanged', () => {
    const getRemotePlayerPosition = vi.fn(() => ({ x: 1, y: 2 }))
    const cb = new Callbacks(
      vi.fn(), vi.fn(), vi.fn(),
      getRemotePlayerPosition, vi.fn(),
    )
    const player = { type: 1, kind: 'remote-human' }
    cb.getRemotePlayerPosition(player)
    expect(getRemotePlayerPosition).toHaveBeenCalledWith(player)
  })

  it('passes BigInt frame to getRemoteBallPosition unchanged', () => {
    const getRemoteBallPosition = vi.fn(() => ({ x: 5, y: 6 }))
    const cb = new Callbacks(
      vi.fn(), vi.fn(), vi.fn(),
      vi.fn(), getRemoteBallPosition,
    )
    cb.getRemoteBallPosition(42n)
    expect(getRemoteBallPosition).toHaveBeenCalledWith(42n)
  })
})

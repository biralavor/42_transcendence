import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { PresenceProvider, usePresence } from './presenceContext'

vi.mock('./authContext', () => ({
  useAuth: vi.fn(),
}))
import { useAuth } from './authContext'

let mockWsInstance

class MockWebSocket {
  constructor(url) {
    this.url = url
    this.close = vi.fn()
    this.onmessage = null
    this.onclose = null
    mockWsInstance = this
  }
}

beforeEach(() => {
  mockWsInstance = null
  global.WebSocket = MockWebSocket
})

afterEach(() => {
  vi.restoreAllMocks()
})

function wrapper({ children }) {
  return <PresenceProvider>{children}</PresenceProvider>
}

describe('PresenceContext', () => {
  it('does not open WebSocket when unauthenticated', () => {
    useAuth.mockReturnValue({ auth: { access_token: null } })
    renderHook(usePresence, { wrapper })
    expect(mockWsInstance).toBeNull()
  })

  it('opens WebSocket to /api/users/ws/presence with token when authenticated', () => {
    useAuth.mockReturnValue({ auth: { access_token: 'tok123' } })
    renderHook(usePresence, { wrapper })
    expect(mockWsInstance).not.toBeNull()
    expect(mockWsInstance.url).toContain('/api/users/ws/presence')
    expect(mockWsInstance.url).toContain('tok123')
  })

  it('updates presenceMap when presence event is received', () => {
    useAuth.mockReturnValue({ auth: { access_token: 'tok123' } })
    const { result } = renderHook(usePresence, { wrapper })
    act(() => {
      mockWsInstance.onmessage({
        data: JSON.stringify({ type: 'presence', user_id: 42, status: 'online' }),
      })
    })
    expect(result.current[42]).toBe('online')
  })

  it('updates presenceMap to offline on disconnect event', () => {
    useAuth.mockReturnValue({ auth: { access_token: 'tok123' } })
    const { result } = renderHook(usePresence, { wrapper })
    act(() => {
      mockWsInstance.onmessage({
        data: JSON.stringify({ type: 'presence', user_id: 42, status: 'online' }),
      })
    })
    act(() => {
      mockWsInstance.onmessage({
        data: JSON.stringify({ type: 'presence', user_id: 42, status: 'offline' }),
      })
    })
    expect(result.current[42]).toBe('offline')
  })

  it('ignores events with type other than presence', () => {
    useAuth.mockReturnValue({ auth: { access_token: 'tok123' } })
    const { result } = renderHook(usePresence, { wrapper })
    act(() => {
      mockWsInstance.onmessage({
        data: JSON.stringify({ type: 'chat', user_id: 42, status: 'online' }),
      })
    })
    expect(result.current[42]).toBeUndefined()
  })

  it('ignores malformed JSON without throwing', () => {
    useAuth.mockReturnValue({ auth: { access_token: 'tok123' } })
    const { result } = renderHook(usePresence, { wrapper })
    act(() => {
      mockWsInstance.onmessage({ data: 'not json' })
    })
    expect(result.current).toEqual({})
  })

  it('closes WebSocket on unmount', () => {
    useAuth.mockReturnValue({ auth: { access_token: 'tok123' } })
    const { unmount } = renderHook(usePresence, { wrapper })
    unmount()
    expect(mockWsInstance.close).toHaveBeenCalled()
  })
})

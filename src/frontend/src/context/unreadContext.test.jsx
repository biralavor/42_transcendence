import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { UnreadProvider, useUnread } from './unreadContext'

vi.mock('./authContext', () => ({
  useAuth: () => ({ auth: { access_token: 'test-token' } }),
}))

// Capture the WebSocket mock instance after construction
let mockWsInstance
beforeEach(() => {
  mockWsInstance = null
  vi.stubGlobal('WebSocket', class {
    constructor(url) {
      this.url = url
      this.onmessage = null
      this.onclose = null
      this.close = vi.fn()
      mockWsInstance = this
    }
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function TestConsumer() {
  const { unreadCounts, clearUnread } = useUnread()
  const count = unreadCounts['DM-1-2'] ?? 0
  return (
    <div>
      <span data-testid="count">{count}</span>
      <button onClick={() => clearUnread('DM-1-2')}>clear</button>
    </div>
  )
}

describe('UnreadContext', () => {
  it('starts with zero unread', () => {
    render(<UnreadProvider><TestConsumer /></UnreadProvider>)
    expect(screen.getByTestId('count').textContent).toBe('0')
  })

  it('increments count when new_dm message arrives', async () => {
    render(<UnreadProvider><TestConsumer /></UnreadProvider>)
    await act(async () => {
      mockWsInstance.onmessage({
        data: JSON.stringify({ type: 'new_dm', room_slug: 'DM-1-2', from_user_id: 1, preview: 'hi' }),
      })
    })
    expect(screen.getByTestId('count').textContent).toBe('1')
  })

  it('accumulates multiple messages', async () => {
    render(<UnreadProvider><TestConsumer /></UnreadProvider>)
    await act(async () => {
      mockWsInstance.onmessage({ data: JSON.stringify({ type: 'new_dm', room_slug: 'DM-1-2', from_user_id: 1, preview: 'a' }) })
      mockWsInstance.onmessage({ data: JSON.stringify({ type: 'new_dm', room_slug: 'DM-1-2', from_user_id: 1, preview: 'b' }) })
    })
    expect(screen.getByTestId('count').textContent).toBe('2')
  })

  it('clearUnread resets count to 0', async () => {
    render(<UnreadProvider><TestConsumer /></UnreadProvider>)
    await act(async () => {
      mockWsInstance.onmessage({ data: JSON.stringify({ type: 'new_dm', room_slug: 'DM-1-2', from_user_id: 1, preview: 'hi' }) })
    })
    await act(async () => {
      screen.getByRole('button', { name: /clear/i }).click()
    })
    expect(screen.getByTestId('count').textContent).toBe('0')
  })

  it('throws when used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow()
    spy.mockRestore()
  })
})

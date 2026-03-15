import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWsClient } from './wsClient.js'

class MockWebSocket {
  static OPEN = 1
  readyState = MockWebSocket.OPEN
  onopen = null
  onmessage = null
  onclose = null
  send = vi.fn()
  close = vi.fn()
  simulateOpen() { this.onopen?.() }
  simulateMessage(data) { this.onmessage?.({ data: JSON.stringify(data) }) }
  simulateClose() { this.onclose?.() }
}

let mockWs
beforeEach(() => {
  mockWs = new MockWebSocket()
  vi.stubGlobal('WebSocket', Object.assign(vi.fn(() => mockWs), { OPEN: 1 }))
})

describe('createWsClient', () => {
  it('calls onOpen when connection opens', () => {
    const onOpen = vi.fn()
    createWsClient('wss://example.com', { onOpen })
    mockWs.simulateOpen()
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('calls onMessage with parsed JSON', () => {
    const onMessage = vi.fn()
    createWsClient('wss://example.com', { onMessage })
    mockWs.simulateMessage({ type: 'move', player: 1 })
    expect(onMessage).toHaveBeenCalledWith({ type: 'move', player: 1 })
  })

  it('send() serializes data as JSON', () => {
    const client = createWsClient('wss://example.com', {})
    client.send({ content: 'hello' })
    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ content: 'hello' }))
  })

  it('close() stops reconnect attempts', () => {
    vi.useFakeTimers()
    const client = createWsClient('wss://example.com', {})
    client.close()
    mockWs.simulateClose()
    vi.advanceTimersByTime(5000)
    // WebSocket constructor called only once — no reconnect
    expect(vi.mocked(WebSocket)).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('close() cancels a reconnect timer already scheduled before close() was called', () => {
    vi.useFakeTimers()
    const client = createWsClient('wss://example.com', {})
    // Unexpected drop schedules a reconnect timer
    mockWs.simulateClose()
    // Consumer calls close() before the timer fires
    client.close()
    vi.advanceTimersByTime(5000)
    // Still only one WebSocket — the scheduled reconnect was cancelled
    expect(vi.mocked(WebSocket)).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('reconnects automatically on unexpected close', () => {
    vi.useFakeTimers()
    createWsClient('wss://example.com', {})
    mockWs.simulateClose() // unexpected — intentionallyClosed is false
    vi.advanceTimersByTime(1000)
    // WebSocket constructor called twice: initial + one reconnect
    expect(vi.mocked(WebSocket)).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})

import { vi } from 'vitest'

const READYSTATE_OPEN = 1

export class FakeWebSocket {
  constructor(url) {
    this.url = url
    this.readyState = 0
    this.sentMessages = []
    this.onopen = null
    this.onmessage = null
    this.onerror = null
    this.onclose = null
    this.close = vi.fn(() => { this.readyState = 3 })
    this.send = vi.fn((data) => { this.sentMessages.push(data) })
    FakeWebSocket.instances.push(this)
  }

  simulateOpen() {
    this.readyState = READYSTATE_OPEN
    if (this.onopen) this.onopen({})
  }

  simulateMessage(payload) {
    if (this.onmessage) {
      this.onmessage({ data: typeof payload === 'string' ? payload : JSON.stringify(payload) })
    }
  }

  simulateError() {
    if (this.onerror) this.onerror({})
  }

  simulateClose() {
    this.readyState = 3
    if (this.onclose) this.onclose({})
  }
}
FakeWebSocket.instances = []
FakeWebSocket.OPEN = READYSTATE_OPEN

export function installWebSocketStub() {
  FakeWebSocket.instances = []
  globalThis.WebSocket = FakeWebSocket
}

export function lastSocket() {
  return FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
}

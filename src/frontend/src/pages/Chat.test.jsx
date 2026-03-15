import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Chat from './Chat'

// ── Mock createWsClient ────────────────────────────────────────────────────
// Captures handlers so tests can simulate WS events without a real socket.
let mockWs
vi.mock('../utils/wsClient', () => ({
  createWsClient: vi.fn((_url, { onOpen, onMessage, onClose } = {}) => {
    mockWs = {
      send: vi.fn(),
      close: vi.fn(),
      simulateOpen: () => onOpen?.(),
      simulateMessage: (data) => onMessage?.(data),
      simulateClose: () => onClose?.(),
    }
    return mockWs
  }),
}))

function renderChat(roomId = 'room1') {
  return render(
    <MemoryRouter initialEntries={[`/chat/${roomId}`]}>
      <Routes>
        <Route path="/chat/:roomId" element={<Chat />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Chat page', () => {
  beforeEach(() => {
    mockWs = undefined
    vi.clearAllMocks()
  })

  it('shows name form before joining', () => {
    renderChat()
    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument()
  })

  it('shows chat view after entering a name and clicking Join', () => {
    renderChat()
    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: 'Alice' },
    })
    fireEvent.click(screen.getByRole('button', { name: /join/i }))
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
  })

  it('send button is disabled when not yet connected', () => {
    renderChat()
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: /join/i }))
    // onOpen not fired yet → disconnected
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('send button is enabled after connection opens', () => {
    renderChat()
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: /join/i }))
    act(() => { mockWs.simulateOpen() })
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled()
  })

  it('send() calls ws.send with content and sender name', () => {
    renderChat()
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: /join/i }))
    act(() => { mockWs.simulateOpen() })
    fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
      target: { value: 'Hello!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(mockWs.send).toHaveBeenCalledWith({ content: 'Hello!', sender: 'Alice' })
  })

  it('received messages appear in the list', () => {
    renderChat()
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: /join/i }))
    act(() => { mockWs.simulateMessage({ content: 'Hi there', sender: 'Bob' }) })
    expect(screen.getByText('Hi there')).toBeInTheDocument()
    expect(screen.getByText(/Bob/)).toBeInTheDocument()
  })
})

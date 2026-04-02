import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LobbyPanel from './LobbyPanel'

const TOKEN = 'test-token'
const USERNAME = 'alice'

function renderLobby(props = {}) {
  const onEnter = vi.fn()
  render(
    <LobbyPanel
      compact={false}
      onEnter={onEnter}
      username={USERNAME}
      token={TOKEN}
      {...props}
    />
  )
  return { onEnter }
}

describe('LobbyPanel', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('fetches rooms on mount and renders the list', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { room_name: 'coding', active_connections: 2 },
          { room_name: 'gaming', active_connections: 1 },
        ]),
        { status: 200 }
      )
    )
    renderLobby()
    await waitFor(() => expect(screen.getByText('coding')).toBeInTheDocument())
    expect(screen.getByText('gaming')).toBeInTheDocument()
  })

  it('shows empty state when no rooms are live', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    )
    renderLobby()
    await waitFor(() =>
      expect(screen.getByText(/no live rooms/i)).toBeInTheDocument()
    )
  })

  it('calls onEnter with room name when a room button is clicked', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ room_name: 'coding', active_connections: 2 }]),
        { status: 200 }
      )
    )
    const { onEnter } = renderLobby()
    await waitFor(() => screen.getByText('coding'))
    fireEvent.click(screen.getByRole('button', { name: /coding/i }))
    expect(onEnter).toHaveBeenCalledWith('coding')
  })

  it('hides the create form in compact mode', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    )
    renderLobby({ compact: true })
    await waitFor(() =>
      expect(screen.queryByLabelText(/new room name/i)).not.toBeInTheDocument()
    )
  })

  it('shows the create form in full mode', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    )
    renderLobby()
    await waitFor(() =>
      expect(screen.getByLabelText(/new room name/i)).toBeInTheDocument()
    )
  })

  it('creates a room and calls onEnter on 201', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ room_name: 'myroom' }), { status: 201 })
      )
    const { onEnter } = renderLobby()
    await waitFor(() => screen.getByLabelText(/new room name/i))
    fireEvent.change(screen.getByLabelText(/new room name/i), {
      target: { value: 'myroom' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() => expect(onEnter).toHaveBeenCalledWith('myroom'))
  })

  it('shows duplicate error message on 409', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 409 }))
    renderLobby()
    await waitFor(() => screen.getByLabelText(/new room name/i))
    fireEvent.change(screen.getByLabelText(/new room name/i), {
      target: { value: 'taken' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i)
    )
  })

  it('shows invalid name error message on 400', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 400 }))
    renderLobby()
    await waitFor(() => screen.getByLabelText(/new room name/i))
    fireEvent.change(screen.getByLabelText(/new room name/i), {
      target: { value: '!!bad!!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid/i)
    )
  })
})

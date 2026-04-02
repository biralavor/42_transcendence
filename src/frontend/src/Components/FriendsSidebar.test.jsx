// src/frontend/src/Components/FriendsSidebar.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import FriendsSidebar from './FriendsSidebar'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: vi.fn() }
})

vi.mock('../context/authContext', () => ({
  useAuth: () => ({ auth: { access_token: 'fake-token' } }),
}))

vi.mock('../context/presenceContext', () => ({
  usePresence: vi.fn(() => ({})),
}))
import { usePresence } from '../context/presenceContext'

vi.mock('../context/unreadContext', () => ({
  useUnread: vi.fn(() => ({ unreadCounts: {}, clearUnread: vi.fn(), setActiveRoom: vi.fn() })),
}))
import { useUnread } from '../context/unreadContext'

function renderSidebar(userId = 1) {
  return render(
    <MemoryRouter>
      <FriendsSidebar userId={userId} />
    </MemoryRouter>
  )
}

describe('FriendsSidebar', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useNavigate.mockReturnValue(vi.fn())
  })

  it('renders search input', () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    renderSidebar()
    expect(screen.getByPlaceholderText(/search players/i)).toBeInTheDocument()
  })

  it('shows friends section heading', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    renderSidebar()
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: /friends/i }).length).toBeGreaterThan(0)
    })
  })

  it('shows no friends message when list is empty', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    renderSidebar()
    await waitFor(() => {
      expect(screen.getByText(/no friends yet/i)).toBeInTheDocument()
    })
  })

  it('shows avatar image for each friend', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 2, username: 'bob', status: 'online', avatar_url: '/img/bob.jpg' },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    renderSidebar()
    await waitFor(() => {
      const img = screen.getByRole('img', { name: /bob/i })
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', '/img/bob.jpg')
    })
  })

  it('falls back to placeholder when avatar_url is null', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 2, username: 'bob', status: 'online', avatar_url: null },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    renderSidebar()
    await waitFor(() => {
      expect(screen.getByRole('img', { name: /bob/i })).toHaveAttribute('src', '/avatar_placeholder.jpg')
    })
  })

  it('shows friend with chat button when list has entries', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify([
          { id: 2, username: 'bob', display_name: 'Bob', status: 'online', avatar_url: null }
        ]), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    renderSidebar()
    await waitFor(() => {
      expect(screen.getByText('bob')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument()
    })
  })

  it('chat button navigates to canonical DM slug (lower id first)', async () => {
    const navigate = vi.fn()
    useNavigate.mockReturnValue(navigate)
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify([
          { id: 5, username: 'dave', display_name: 'Dave', status: 'online', avatar_url: null }
        ]), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ active_connections: 1 }), { status: 200 }))
    renderSidebar(3)  // userId=3, friendId=5 → /chat/DM-3-5
    fireEvent.click(await screen.findByRole('button', { name: /chat/i }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/chat/DM-3-5', expect.any(Object))
    })
  })

  it('chat button produces same DM slug regardless of which user initiates', async () => {
    const navigate = vi.fn()
    useNavigate.mockReturnValue(navigate)
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify([
          { id: 3, username: 'dave', display_name: 'Dave', status: 'online', avatar_url: null }
        ]), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ active_connections: 1 }), { status: 200 }))
    renderSidebar(5)  // userId=5, friendId=3 → /chat/DM-3-5 (canonicalized)
    fireEvent.click(await screen.findByRole('button', { name: /chat/i }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/chat/DM-3-5', expect.any(Object))
    })
  })

  it('accept PUT includes Authorization header', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 7, requester_id: 2, requester_username: 'bob', status: 'pending' },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 2, username: 'bob', status: 'offline' }), { status: 200 }))
    renderSidebar(1)
    fireEvent.click(await screen.findByRole('button', { name: /✓/ }))
    await waitFor(() => {
      const respondCall = global.fetch.mock.calls.find(([url, opts]) =>
        url.includes('/requests/7') && opts?.method === 'PUT'
      )
      expect(respondCall[1].headers?.Authorization).toBe('Bearer fake-token')
    })
  })

  it('accept button calls PUT /requests/{id} with action accept', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 7, requester_id: 2, requester_username: 'bob', status: 'pending' },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 })) // respond call
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 2, username: 'bob', status: 'offline' }), { status: 200 })) // profile re-fetch
    renderSidebar(1)
    fireEvent.click(await screen.findByRole('button', { name: /✓/ }))
    await waitFor(() => {
      const calls = global.fetch.mock.calls
      const respondCall = calls.find(([url, opts]) =>
        url.includes('/requests/7') && opts?.method === 'PUT'
      )
      expect(respondCall).toBeDefined()
      expect(JSON.parse(respondCall[1].body)).toEqual({ action: 'accept' })
    })
  })

  it('decline button calls PUT /requests/{id} with action decline', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 7, requester_id: 2, requester_username: 'bob', status: 'pending' },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 })) // respond call (204 not valid in Response constructor)
    renderSidebar(1)
    fireEvent.click(await screen.findByRole('button', { name: /✗/ }))
    await waitFor(() => {
      const calls = global.fetch.mock.calls
      const respondCall = calls.find(([url, opts]) =>
        url.includes('/requests/7') && opts?.method === 'PUT'
      )
      expect(respondCall).toBeDefined()
      expect(JSON.parse(respondCall[1].body)).toEqual({ action: 'decline' })
    })
  })

  it('shows search results when query is entered', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([
          { id: 3, username: 'charlie', display_name: null, status: 'offline', avatar_url: null }
        ]), { status: 200 })
      )
    renderSidebar()
    fireEvent.change(screen.getByPlaceholderText(/search players/i), {
      target: { value: 'ch' },
    })
    await waitFor(() => {
      expect(screen.getByText('charlie')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add friend/i })).toBeInTheDocument()
    })
  })

  it('shows online dot when presenceMap says online', async () => {
    usePresence.mockReturnValue({ 2: 'online' })
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 2, username: 'bob', status: 'offline', avatar_url: null },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    renderSidebar()
    await waitFor(() => {
      expect(document.querySelector('.friends-status-online')).toBeInTheDocument()
    })
  })

  it('presenceMap online overrides REST offline status', async () => {
    usePresence.mockReturnValue({ 2: 'online' })
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 2, username: 'bob', status: 'offline', avatar_url: null },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    renderSidebar()
    await waitFor(() => {
      expect(document.querySelector('.friends-status-online')).toBeInTheDocument()
      expect(document.querySelector('.friends-status-offline')).not.toBeInTheDocument()
    })
  })

  it('avatar has online border class when presenceMap says online', async () => {
    usePresence.mockReturnValue({ 2: 'online' })
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 2, username: 'bob', status: 'offline', avatar_url: null },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    renderSidebar()
    await waitFor(() => {
      const img = screen.getByRole('img', { name: /bob/i })
      expect(img.className).toContain('friends-avatar-online')
    })
  })

  it('falls back to REST status when presenceMap is empty (e.g. after WS disconnect)', async () => {
    usePresence.mockReturnValue({})  // simulates post-disconnect cleared map
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 2, username: 'bob', status: 'online', avatar_url: null },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    renderSidebar()
    await waitFor(() => {
      expect(document.querySelector('.friends-status-online')).toBeInTheDocument()
    })
  })

  it('calls onViewProfile with friend username and id when friend username is clicked', async () => {
    const navigate = vi.fn()
    useNavigate.mockReturnValue(navigate)
    const onViewProfile = vi.fn()

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 5, username: 'charlie', avatar_url: null, status: 'online' }]), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))

    render(
      <MemoryRouter>
        <FriendsSidebar userId={1} onViewProfile={onViewProfile} />
      </MemoryRouter>
    )

    const usernameBtn = await screen.findByRole('button', { name: 'charlie' })
    fireEvent.click(usernameBtn)
    expect(onViewProfile).toHaveBeenCalledWith('charlie', 5)
  })

  it('renders friend username as plain text when onViewProfile is not provided', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 5, username: 'charlie', avatar_url: null, status: 'online' }]), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))

    render(
      <MemoryRouter>
        <FriendsSidebar userId={1} />
      </MemoryRouter>
    )

    await screen.findByText('charlie')
    // Should not be a button when no onViewProfile prop
    const charlieElements = screen.getAllByText('charlie')
    charlieElements.forEach(el => {
      expect(el.tagName).not.toBe('BUTTON')
    })
  })

  it('shows offline modal when friend is not in DM room', async () => {
    const navigate = vi.fn()
    useNavigate.mockReturnValue(navigate)
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 5, username: 'dave', display_name: 'Dave', status: 'online', avatar_url: null },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ active_connections: 0 }), { status: 200 }))
    renderSidebar(3)
    fireEvent.click(await screen.findByRole('button', { name: /^chat$/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /friend not in chat/i })).toBeInTheDocument()
      expect(screen.getAllByText(/dave/).length).toBeGreaterThan(0)
    })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('Open Chat button navigates to DM room and closes modal', async () => {
    const navigate = vi.fn()
    useNavigate.mockReturnValue(navigate)
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 5, username: 'dave', display_name: 'Dave', status: 'online', avatar_url: null },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ active_connections: 0 }), { status: 200 }))
    renderSidebar(3)
    fireEvent.click(await screen.findByRole('button', { name: /^chat$/i }))
    await waitFor(() => screen.getByRole('dialog', { name: /friend not in chat/i }))
    fireEvent.click(screen.getByRole('button', { name: /open chat/i }))
    expect(navigate).toHaveBeenCalledWith('/chat/DM-3-5', { state: { username: expect.any(String), userId: 3 } })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('Cancel button closes modal without navigating', async () => {
    const navigate = vi.fn()
    useNavigate.mockReturnValue(navigate)
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 5, username: 'dave', display_name: 'Dave', status: 'online', avatar_url: null },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ active_connections: 0 }), { status: 200 }))
    renderSidebar(3)
    fireEvent.click(await screen.findByRole('button', { name: /^chat$/i }))
    await waitFor(() => screen.getByRole('dialog', { name: /friend not in chat/i }))
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(navigate).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('navigates immediately when friend is already in DM room', async () => {
    const navigate = vi.fn()
    useNavigate.mockReturnValue(navigate)
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 5, username: 'dave', display_name: 'Dave', status: 'online', avatar_url: null },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ active_connections: 1 }), { status: 200 }))
    renderSidebar(3)
    fireEvent.click(await screen.findByRole('button', { name: /^chat$/i }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/chat/DM-3-5', expect.any(Object))
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('backdrop click closes the offline modal without navigating', async () => {
    const navigate = vi.fn()
    useNavigate.mockReturnValue(navigate)
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 5, username: 'dave', display_name: 'Dave', status: 'online', avatar_url: null },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ active_connections: 0 }), { status: 200 }))
    renderSidebar(3)
    fireEvent.click(await screen.findByRole('button', { name: /^chat$/i }))
    await waitFor(() => screen.getByRole('dialog', { name: /friend not in chat/i }))
    fireEvent.click(screen.getByRole('dialog', { name: /friend not in chat/i }))
    expect(navigate).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('Escape key closes the offline modal without navigating', async () => {
    const navigate = vi.fn()
    useNavigate.mockReturnValue(navigate)
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 5, username: 'dave', display_name: 'Dave', status: 'online', avatar_url: null },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ active_connections: 0 }), { status: 200 }))
    renderSidebar(3)
    fireEvent.click(await screen.findByRole('button', { name: /^chat$/i }))
    await waitFor(() => screen.getByRole('dialog', { name: /friend not in chat/i }))
    fireEvent.keyDown(screen.getByRole('dialog', { name: /friend not in chat/i }), { key: 'Escape' })
    expect(navigate).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('navigates immediately when active endpoint call fails (network error)', async () => {
    const navigate = vi.fn()
    useNavigate.mockReturnValue(navigate)
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 5, username: 'dave', display_name: 'Dave', status: 'online', avatar_url: null },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockRejectedValueOnce(new Error('network error'))
    renderSidebar(3)
    fireEvent.click(await screen.findByRole('button', { name: /^chat$/i }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/chat/DM-3-5', expect.any(Object))
    })
  })

  it('navigates immediately when active endpoint returns non-2xx (fail-open)', async () => {
    const navigate = vi.fn()
    useNavigate.mockReturnValue(navigate)
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 5, username: 'dave', display_name: 'Dave', status: 'online', avatar_url: null },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
    renderSidebar(3)
    fireEvent.click(await screen.findByRole('button', { name: /^chat$/i }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/chat/DM-3-5', expect.any(Object))
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('FriendsSidebar — unread badge', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useNavigate.mockReturnValue(vi.fn())
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify([{ id: 99, username: 'alice', status: 'online', avatar_url: '' }]), { status: 200 })
      )
    )
  })

  it('shows unread badge count on friend row', async () => {
    useUnread.mockReturnValue({ unreadCounts: { 'DM-1-99': 3 }, clearUnread: vi.fn() })
    render(
      <MemoryRouter>
        <FriendsSidebar userId={1} username="me" />
      </MemoryRouter>
    )
    expect(await screen.findByText('3')).toBeInTheDocument()
  })

  it('calls clearUnread when Chat button is clicked', async () => {
    const clearUnread = vi.fn()
    useUnread.mockReturnValue({ unreadCounts: { 'DM-1-99': 2 }, clearUnread })
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 99, username: 'alice', status: 'online', avatar_url: '' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ active_connections: 1 }), { status: 200 }))
    render(
      <MemoryRouter>
        <FriendsSidebar userId={1} username="me" />
      </MemoryRouter>
    )
    const chatBtn = await screen.findByRole('button', { name: /^chat$/i })
    chatBtn.click()
    expect(clearUnread).toHaveBeenCalledWith('DM-1-99')
  })
})

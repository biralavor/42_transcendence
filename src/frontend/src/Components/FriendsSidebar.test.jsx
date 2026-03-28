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
      expect(screen.getByRole('heading', { name: /friends/i })).toBeInTheDocument()
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
    renderSidebar(3)  // userId=3, friendId=5 → /chat/DM-3-5
    fireEvent.click(await screen.findByRole('button', { name: /chat/i }))
    expect(navigate).toHaveBeenCalledWith('/chat/DM-3-5', expect.any(Object))
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
    renderSidebar(5)  // userId=5, friendId=3 → /chat/DM-3-5 (canonicalized)
    fireEvent.click(await screen.findByRole('button', { name: /chat/i }))
    expect(navigate).toHaveBeenCalledWith('/chat/DM-3-5', expect.any(Object))
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
})

// src/frontend/src/Components/FriendsSidebar.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FriendsSidebar from './FriendsSidebar'

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

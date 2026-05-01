import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Search from './Search'

vi.mock('../Components/Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}))

function renderSearch(initialEntry = '/search?q=ali') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/search" element={<Search />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Search page', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({
          results: [
            { id: 7, username: 'alice', avatar_url: '/avatars/alice.png' },
            { id: 8, username: 'alicia', avatar_url: null },
          ],
          total: 12,
          page: 1,
          per_page: 10,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      )
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches users from the q param and renders results', async () => {
    renderSearch('/search?q=ali')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/search?q=ali&page=1&per_page=10&sort=username',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
    expect(await screen.findByText('@alice')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /@alice/i })).toHaveAttribute('href', '/profile/7')
    expect(screen.getByText(/12 results for "ali"/i)).toBeInTheDocument()
  })

  it('uses pagination buttons to update the page query', async () => {
    renderSearch('/search?q=ali&page=1')

    const nextButton = await screen.findByRole('button', { name: /^next$/i })
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        '/api/users/search?q=ali&page=2&per_page=10&sort=username',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
  })

  it('submits a new query from the full search form', async () => {
    renderSearch('/search?q=ali')

    const input = await screen.findByRole('searchbox', { name: /search users/i })
    fireEvent.change(input, { target: { value: 'bruno' } })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        '/api/users/search?q=bruno&page=1&per_page=10&sort=username',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
  })
})

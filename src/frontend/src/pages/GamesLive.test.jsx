import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import GamesLive from './GamesLive'

vi.mock('../Components/Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}))

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const sampleGames = [
  {
    game_id: 'invite-101-202-aaa',
    player1: { id: 101, username: 'alice', display_name: 'Alice A', avatar_url: '/uploads/avatars/101.png', rank: 4 },
    player2: { id: 202, username: 'bob',   display_name: 'Bob B',   avatar_url: null,                       rank: 9 },
    started_at: new Date(Date.now() - 90_000).toISOString(),
    spectator_count: 3,
    score1: 8,
    score2: 6,
  },
  {
    game_id: 'invite-303-404-bbb',
    player1: { id: 303, username: 'carol', display_name: 'Carol',  avatar_url: null, rank: null },
    player2: { id: 404, username: 'dave',  display_name: 'Dave',   avatar_url: null, rank: 12 },
    started_at: new Date().toISOString(),
    spectator_count: 0,
    score1: 0,
    score2: 0,
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <GamesLive />
    </MemoryRouter>
  )
}

describe('GamesLive page', () => {
  beforeEach(() => {
    // shouldAdvanceTime keeps the fake clock ticking with real time, so
    // testing-library's `waitFor` (which polls via setTimeout) keeps polling
    // while we still control setInterval/Date for the polling-cadence tests.
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders empty state when API returns []', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse([]))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/no games being played right now/i)).toBeInTheDocument()
    })
  })

  it('renders one card per game in API response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(sampleGames))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Alice A')).toBeInTheDocument()
      expect(screen.getByText('Bob B')).toBeInTheDocument()
      expect(screen.getByText('Carol')).toBeInTheDocument()
    })
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('Watch link points to /game/{game_id}?spectate=true', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse([sampleGames[0]]))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Alice A')).toBeInTheDocument()
    })
    const watch = screen.getByRole('link', { name: /watch/i })
    expect(watch).toHaveAttribute('href', '/game/invite-101-202-aaa?spectate=true')
  })

  it('shows spectator_count on the card', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse([sampleGames[0]]))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/3 watching/i)).toBeInTheDocument()
    })
  })

  it('polls /api/games/live every 5 s', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse([]))
    renderPage()
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))

    await act(async () => {
      vi.advanceTimersByTime(5_000)
      await Promise.resolve()
    })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))

    await act(async () => {
      vi.advanceTimersByTime(5_000)
      await Promise.resolve()
    })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(3))
  })

  it('cleans up the interval on unmount (no further fetches)', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse([]))
    const { unmount } = renderPage()
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    unmount()
    await act(async () => {
      vi.advanceTimersByTime(30_000)
      await Promise.resolve()
    })
    expect(spy).toHaveBeenCalledTimes(1)  // no new calls after unmount
  })

  it('falls back to username when display_name is missing', async () => {
    const games = [{
      ...sampleGames[0],
      player1: { ...sampleGames[0].player1, display_name: '' },
    }]
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(games))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument()
    })
  })

  it('renders the live score in place of "vs"', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse([sampleGames[0]]))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('8 : 6')).toBeInTheDocument()
    })
    expect(screen.queryByText(/^vs$/i)).not.toBeInTheDocument()
  })

  it('renders rank under each player name', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse([sampleGames[0]]))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Rank #04')).toBeInTheDocument()
      expect(screen.getByText('Rank #09')).toBeInTheDocument()
    })
  })

  it('renders "Rank —" when a player has no rank (AI / unranked)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse([sampleGames[1]]))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Rank —')).toBeInTheDocument()
      expect(screen.getByText('Rank #12')).toBeInTheDocument()
    })
  })
})

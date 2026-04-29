import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'

vi.mock('../Components/Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}))

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  )
}

describe('Home page', () => {
  it('renders the Navbar slot', () => {
    renderHome()
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
  })

  it('renders the hero title', () => {
    renderHome()
    expect(
      screen.getByRole('heading', { name: /play pong/i, level: 1 })
    ).toBeInTheDocument()
  })

  it('renders primary "Play now" CTA pointing to /play', () => {
    renderHome()
    const playLink = screen.getByRole('link', { name: /play now/i })
    expect(playLink).toHaveAttribute('href', '/play')
  })

  it('renders "View leaderboard" CTA pointing to /leaderboard', () => {
    renderHome()
    const lbLink = screen.getByRole('link', { name: /view leaderboard/i })
    expect(lbLink).toHaveAttribute('href', '/leaderboard')
  })

  it('renders the Sign in CTA pointing to /login', () => {
    renderHome()
    const signInLink = screen.getByRole('link', { name: /sign in/i })
    expect(signInLink).toHaveAttribute('href', '/login')
  })

  it('renders the Learn more CTA pointing to /about', () => {
    renderHome()
    const aboutLink = screen.getByRole('link', { name: /learn more/i })
    expect(aboutLink).toHaveAttribute('href', '/about')
  })

  it('renders the three feature cards', () => {
    renderHome()
    expect(screen.getByRole('heading', { name: /arcade energy/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /instant competition/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /leaderboard mindset/i })).toBeInTheDocument()
  })
})

function jsonResp(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const game = (id, spectators, startedAtOffsetMs = 0, opts = {}) => ({
  game_id: id,
  player1: {
    id: 1, username: 'alice', display_name: 'Alice', avatar_url: null,
    // 'key' in opts (not ??): an explicit null rank must pass through (unranked players)
    rank: 'p1Rank' in opts ? opts.p1Rank : 4,
  },
  player2: {
    id: 2, username: 'bob', display_name: 'Bob', avatar_url: null,
    rank: 'p2Rank' in opts ? opts.p2Rank : 9,
  },
  started_at: new Date(Date.now() + startedAtOffsetMs).toISOString(),
  spectator_count: spectators,
  score1: opts.score1 ?? 0,
  score2: opts.score2 ?? 0,
})

describe('Home Live Match pill', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders the dynamic pill linking to the most-spectated game', async () => {
    const games = [game('g-1', 2), game('g-2', 5), game('g-3', 0)]
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResp(games))
    renderHome()
    const link = await screen.findByRole('link', { name: /live match.*alice.*vs.*bob.*5/i })
    expect(link).toHaveAttribute('href', '/game/g-2?spectate=true')
  })

  it('hides the pill (renders idle text) when /api/games/live returns []', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResp([]))
    renderHome()
    await waitFor(() => {
      expect(screen.getByText(/no live match/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('link', { name: /live match/i })).not.toBeInTheDocument()
  })

  it('updates the pill when the top game changes on the next poll', async () => {
    const first = [game('g-1', 5), game('g-2', 1)]
    const second = [game('g-1', 2), game('g-2', 7)]
    const spy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(jsonResp(first))
      .mockResolvedValueOnce(jsonResp(second))
    renderHome()
    const linkA = await screen.findByRole('link', { name: /live match/i })
    expect(linkA).toHaveAttribute('href', '/game/g-1?spectate=true')

    await act(async () => {
      vi.advanceTimersByTime(5_000)
      await Promise.resolve()
    })
    await waitFor(() => {
      const linkB = screen.getByRole('link', { name: /live match/i })
      expect(linkB).toHaveAttribute('href', '/game/g-2?spectate=true')
    })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('cleans up the polling interval on unmount', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(jsonResp([]))
    const { unmount } = renderHome()
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    unmount()
    await act(async () => {
      vi.advanceTimersByTime(30_000)
      await Promise.resolve()
    })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('renders the live score in the arena topbar (natural format)', async () => {
    const games = [game('g-1', 5, 0, { score1: 8, score2: 6 })]
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResp(games))
    renderHome()
    await waitFor(() => {
      expect(screen.getByText('8 : 6')).toBeInTheDocument()
    })
  })

  it('renders "— : —" score when there is no live match', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResp([]))
    renderHome()
    await waitFor(() => {
      expect(screen.getByText('— : —')).toBeInTheDocument()
    })
  })

  it('renders the topGame player names and ranks in the arena footer', async () => {
    const games = [game('g-1', 5, 0, { score1: 1, score2: 0 })]
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResp(games))
    renderHome()
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('Rank #04')).toBeInTheDocument()
      expect(screen.getByText('Rank #09')).toBeInTheDocument()
    })
  })

  it('renders "Rank —" when a player has no rank (AI / unranked)', async () => {
    const games = [game('g-1', 5, 0, { p2Rank: null })]
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResp(games))
    renderHome()
    await waitFor(() => {
      expect(screen.getByText('Rank #04')).toBeInTheDocument()
      expect(screen.getByText('Rank —')).toBeInTheDocument()
    })
  })

  it('polls /api/games/live every 5 s', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(jsonResp([]))
    renderHome()
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))

    await act(async () => {
      vi.advanceTimersByTime(5_000)
      await Promise.resolve()
    })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
  })
})

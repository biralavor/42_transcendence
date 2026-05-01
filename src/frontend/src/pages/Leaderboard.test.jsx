import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Leaderboard from './Leaderboard'

vi.mock('../Components/Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}))

// Mock the useUser hook
const mockUseUser = vi.fn()
vi.mock('../context/userContext', () => ({
  useUser: () => mockUseUser(),
  UserProvider: ({ children }) => <>{children}</>,
}))

// Helper for the post-Task-7 fetch flow:
//   1. /api/users/auth/me            (returns the caller's user_id)
//   2. /api/game/leaderboard?...     (single fetch with embedded xp/level)
function mockLeaderboardBoot({ results = [], page = 0, last_page = 0, total = 0 } = {}) {
  vi.spyOn(global, 'fetch')
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          page,
          last_page,
          per_page: 20,
          total: total || results.length,
          results,
          summary: {
            max_max_streak: { value: 0, display_name: 'No Data' },
            max_current_streak: { value: 0, display_name: 'No Data' },
            max_points: { value: 0, display_name: 'No Data' },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
}

function renderLeaderboard() {
  return render(
    <MemoryRouter>
      <Leaderboard />
    </MemoryRouter>
  )
}

const SAMPLE_ROW = {
  rank: 1, user_id: 5042, display_name: 'Bob', avatar_url: null,
  wins: 3, losses: 1, total_games: 4, goals_scored: 21, goals_conceded: 8,
  goal_difference: 13, points: 9, max_streak: 2, current_streak: 1,
  xp: 75, level: 1,
}

describe('Leaderboard subtitle captions', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('access_token', 'fake-token')
    sessionStorage.setItem('refresh_token', 'fake-refresh-token')
    sessionStorage.setItem('token_type', 'bearer')
    mockUseUser.mockReturnValue({user: {id: 5001, display_name: 'Alice'}, token: null})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('renders subtitle captions under abbreviated column headers', async () => {
    mockLeaderboardBoot({ results: [SAMPLE_ROW] })
    const { container } = renderLeaderboard()
    await waitFor(() => {
      const subtitleTexts = Array.from(
        container.querySelectorAll('.th-subtitle')
      ).map((el) => el.textContent)
      // textContent strips <br /> tags and concatenates without separators,
      // so multi-word subtitles appear as a single concatenated string.
      expect(subtitleTexts).toEqual(
        expect.arrayContaining([
          'Wins',
          'Losses',
          'GamesPlayed',
          'GoalsFor',
          'GoalsAgainst',
          'GoalDifference',
          'Points',
          'Max WinStreak',
          'CurrentWin Streak',
          'Level',
        ])
      )
    })
  })
})

describe('Leaderboard fetch flow', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('access_token', 'fake-token')
    sessionStorage.setItem('refresh_token', 'fake-refresh-token')
    sessionStorage.setItem('token_type', 'bearer')
    mockUseUser.mockReturnValue({user: {id: 5001, display_name: 'Alice'}, token: null})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('makes a single fetch to /api/game/leaderboard with order=xp:desc by default', async () => {
    mockLeaderboardBoot({ results: [SAMPLE_ROW] })
    renderLeaderboard()
    await waitFor(() => {
      const calls = global.fetch.mock.calls.map(c => c[0])
      expect(calls.some(url =>
        url.includes('/api/game/leaderboard') &&
        url.includes('order=xp%3Adesc') &&
        url.includes('page=0') &&
        url.includes('limit=20')
      )).toBe(true)
      expect(calls.some(url => url.includes('/api/game/xp-leaderboard'))).toBe(false)
    })
  })

  it('renders xp and level from the leaderboard response (no second fetch)', async () => {
    mockLeaderboardBoot({ results: [SAMPLE_ROW] })
    renderLeaderboard()
    await waitFor(() => {
      expect(screen.getByText('75')).toBeInTheDocument()  // XP
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })
  })
})

describe('Leaderboard sort toggle', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('access_token', 'fake-token')
    sessionStorage.setItem('refresh_token', 'fake-refresh-token')
    sessionStorage.setItem('token_type', 'bearer')
    mockUseUser.mockReturnValue({user: {id: 5001, display_name: 'Alice'}, token: null})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('renders XP and Wins toggle buttons with XP active by default', async () => {
    mockLeaderboardBoot({ results: [SAMPLE_ROW] })
    renderLeaderboard()
    await waitFor(() => {
      const xpBtn = screen.getByRole('button', { name: /^xp$/i })
      const winsBtn = screen.getByRole('button', { name: /^wins$/i })
      expect(xpBtn).toHaveClass('active')
      expect(winsBtn).not.toHaveClass('active')
    })
  })

  it('clicking Wins toggle re-fetches with order=wins:desc', async () => {
    mockLeaderboardBoot({ results: [SAMPLE_ROW] })
    // Mock the third fetch (after the toggle click triggers re-fetch)
    global.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          page: 0, last_page: 0, per_page: 20, total: 0, results: [],
          summary: {
            max_max_streak: { value: 0, display_name: 'No Data' },
            max_current_streak: { value: 0, display_name: 'No Data' },
            max_points: { value: 0, display_name: 'No Data' },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    renderLeaderboard()
    await waitFor(() => screen.getByRole('button', { name: /^wins$/i }))

    fireEvent.click(screen.getByRole('button', { name: /^wins$/i }))

    await waitFor(() => {
      const calls = global.fetch.mock.calls.map(c => c[0])
      expect(calls.some(url => url.includes('order=wins%3Adesc'))).toBe(true)
    })
  })
})

describe('Leaderboard pagination', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('access_token', 'fake-token')
    sessionStorage.setItem('refresh_token', 'fake-refresh-token')
    sessionStorage.setItem('token_type', 'bearer')
    mockUseUser.mockReturnValue({user: {id: 5001, display_name: 'Alice'}, token: null})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('disables Previous on first page and Next on last page when only one page exists', async () => {
    mockLeaderboardBoot({ results: [SAMPLE_ROW] })  // page=0, last_page=0
    renderLeaderboard()
    await waitFor(() => {
      const prev = screen.getByRole('button', { name: /previous/i })
      const next = screen.getByRole('button', { name: /next/i })
      expect(prev).toBeDisabled()
      expect(next).toBeDisabled()
    })
  })

  it('shows "Page X of Y · Z players total" footer', async () => {
    vi.spyOn(global, 'fetch')

      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            page: 0, last_page: 2, per_page: 20, total: 47, results: [SAMPLE_ROW],
            summary: {
              max_max_streak: { value: 0, display_name: 'No Data' },
              max_current_streak: { value: 0, display_name: 'No Data' },
              max_points: { value: 0, display_name: 'No Data' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    renderLeaderboard()
    await waitFor(() => {
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument()
      expect(screen.getByText(/47 players total/i)).toBeInTheDocument()
    })
  })

  it('clicking Next increments the page query and re-fetches', async () => {
    vi.spyOn(global, 'fetch')

      // First page response (last_page > 0 so Next is enabled)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            page: 0, last_page: 1, per_page: 20, total: 25, results: [SAMPLE_ROW],
            summary: {
              max_max_streak: { value: 0, display_name: 'No Data' },
              max_current_streak: { value: 0, display_name: 'No Data' },
              max_points: { value: 0, display_name: 'No Data' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      // Second page response (after Next click)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            page: 1, last_page: 1, per_page: 20, total: 25, results: [SAMPLE_ROW],
            summary: {
              max_max_streak: { value: 0, display_name: 'No Data' },
              max_current_streak: { value: 0, display_name: 'No Data' },
              max_points: { value: 0, display_name: 'No Data' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    renderLeaderboard()
    await waitFor(() => screen.getByRole('button', { name: /next/i }))

    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      const calls = global.fetch.mock.calls.map(c => c[0])
      expect(calls.some(url => url.includes('page=1'))).toBe(true)
    })
  })
})

describe('Leaderboard current-user highlight', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('access_token', 'fake-token')
    sessionStorage.setItem('refresh_token', 'fake-refresh-token')
    sessionStorage.setItem('token_type', 'bearer')
    mockUseUser.mockReturnValue({user: {id: 5001, display_name: 'Alice'}, token: null})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('applies current-user-row class to the row whose user_id matches /auth/me', async () => {
    mockLeaderboardBoot({
      results: [
        {
          rank: 1, user_id: 5042, display_name: 'Bob', avatar_url: null,
          wins: 3, losses: 0, total_games: 3, goals_scored: 15, goals_conceded: 5,
          goal_difference: 10, points: 9, max_streak: 3, current_streak: 3,
          xp: 75, level: 1,
        },
        {
          rank: 2, user_id: 5001, display_name: 'Alice', avatar_url: null,
          wins: 2, losses: 1, total_games: 3, goals_scored: 11, goals_conceded: 8,
          goal_difference: 3, points: 6, max_streak: 2, current_streak: 0,
          xp: 50, level: 1,
        },
      ],
    })
    // /auth/me returned id=5001 from the helper (mockLeaderboardBoot mocks it as 5001)
    renderLeaderboard()
    await waitFor(() => screen.getByText('Alice'))

    const aliceRow = screen.getByText('Alice').closest('tr')
    const bobRow = screen.getByText('Bob').closest('tr')
    expect(aliceRow).toHaveClass('current-user-row')
    expect(bobRow).not.toHaveClass('current-user-row')
  })
})

describe('Leaderboard player column', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('access_token', 'fake-token')
    sessionStorage.setItem('refresh_token', 'fake-refresh-token')
    sessionStorage.setItem('token_type', 'bearer')
    mockUseUser.mockReturnValue({user: {id: 5042 }, token: 'fake-token' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('renders an avatar thumbnail and a clickable username link to /profile/{user_id}', async () => {
    mockLeaderboardBoot({
      results: [
        {
          rank: 1, user_id: 5042, display_name: 'Bob', avatar_url: '/uploads/avatars/5042.png',
          wins: 3, losses: 0, total_games: 3, goals_scored: 15, goals_conceded: 5,
          goal_difference: 10, points: 9, max_streak: 3, current_streak: 3,
          xp: 75, level: 1,
        },
      ],
    })
    renderLeaderboard()

    const link = await screen.findByRole('link', { name: /bob/i })
    expect(link).toHaveAttribute('href', '/profile/5042')
    expect(link).toHaveClass('leaderboard-username-link')

    const avatar = screen.getByRole('img')
    expect(avatar).toHaveAttribute('src', '/uploads/avatars/5042.png')
    expect(avatar).toHaveClass('leaderboard-avatar')
  })

  it('falls back to a placeholder image when avatar_url is null', async () => {
    mockLeaderboardBoot({
      results: [
        {
          rank: 1, user_id: 5042, display_name: 'Bob', avatar_url: null,
          wins: 3, losses: 0, total_games: 3, goals_scored: 15, goals_conceded: 5,
          goal_difference: 10, points: 9, max_streak: 3, current_streak: 3,
          xp: 75, level: 1,
        },
      ],
    })
    renderLeaderboard()
    const avatar = await screen.findByRole('img')
    expect(avatar).toHaveAttribute('src', '/avatar_placeholder.jpg')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests added from PR review (issue #238)
// ─────────────────────────────────────────────────────────────────────────────

describe('Leaderboard sort toggle accessibility (aria-pressed)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('access_token', 'fake-token')
    sessionStorage.setItem('refresh_token', 'fake-refresh-token')
    sessionStorage.setItem('token_type', 'bearer')
    mockUseUser.mockReturnValue({user: null, token: null})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('marks the active sort button with aria-pressed=true and the inactive one with aria-pressed=false', async () => {
    mockLeaderboardBoot({ results: [SAMPLE_ROW] })
    renderLeaderboard()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^xp$/i })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: /^wins$/i })).toHaveAttribute('aria-pressed', 'false')
    })
  })

  it('updates aria-pressed when the user toggles to Wins', async () => {
    mockLeaderboardBoot({ results: [SAMPLE_ROW] })
    // Mock the post-toggle re-fetch
    global.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          page: 0, last_page: 0, per_page: 20, total: 0, results: [],
          summary: {
            max_max_streak: { value: 0, display_name: 'No Data' },
            max_current_streak: { value: 0, display_name: 'No Data' },
            max_points: { value: 0, display_name: 'No Data' },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    renderLeaderboard()
    await waitFor(() => screen.getByRole('button', { name: /^wins$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^wins$/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^xp$/i })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: /^wins$/i })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('groups the sort toggle as a button group with an accessible label', async () => {
    mockLeaderboardBoot({ results: [SAMPLE_ROW] })
    const { container } = renderLeaderboard()
    await waitFor(() => screen.getByRole('button', { name: /^xp$/i }))
    const group = container.querySelector('.leaderboard-sort-toggle')
    expect(group).toHaveAttribute('role', 'group')
    expect(group).toHaveAttribute('aria-label', expect.stringMatching(/sort/i))
  })
})

describe('Leaderboard pagination stability (tie-breaker columns)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('access_token', 'fake-token')
    sessionStorage.setItem('refresh_token', 'fake-refresh-token')
    sessionStorage.setItem('token_type', 'bearer')
    mockUseUser.mockReturnValue({user: null, token: null})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('includes points/goal_difference/user_id tie-breakers in the order param when sorting by XP', async () => {
    mockLeaderboardBoot({ results: [SAMPLE_ROW] })
    renderLeaderboard()
    await waitFor(() => {
      const calls = global.fetch.mock.calls.map(c => c[0])
      const lbCall = calls.find(url => typeof url === 'string' && url.includes('/api/game/leaderboard'))
      expect(lbCall).toBeTruthy()
      // URL-encoded comma is %2C, colon is %3A
      expect(lbCall).toContain('xp%3Adesc')
      expect(lbCall).toContain('points%3Adesc')
      expect(lbCall).toContain('goal_difference%3Adesc')
      expect(lbCall).toContain('user_id%3Aasc')
    })
  })

  it('includes tie-breakers when sorting by Wins too', async () => {
    mockLeaderboardBoot({ results: [SAMPLE_ROW] })
    global.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          page: 0, last_page: 0, per_page: 20, total: 0, results: [],
          summary: {
            max_max_streak: { value: 0, display_name: 'No Data' },
            max_current_streak: { value: 0, display_name: 'No Data' },
            max_points: { value: 0, display_name: 'No Data' },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    renderLeaderboard()
    await waitFor(() => screen.getByRole('button', { name: /^wins$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^wins$/i }))
    await waitFor(() => {
      const calls = global.fetch.mock.calls.map(c => c[0])
      const winsCall = calls.find(url =>
        typeof url === 'string' && url.includes('order=wins%3Adesc')
      )
      expect(winsCall).toBeTruthy()
      expect(winsCall).toContain('points%3Adesc')
      expect(winsCall).toContain('goal_difference%3Adesc')
      expect(winsCall).toContain('user_id%3Aasc')
    })
  })
})

describe('Leaderboard auth/me on public route (skipRefreshOn401)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('access_token', 'fake-token')
    sessionStorage.setItem('refresh_token', 'fake-refresh-token')
    sessionStorage.setItem('token_type', 'bearer')
    mockUseUser.mockReturnValue({user: null, token: null})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('does not trigger a token-refresh request when /auth/me returns 401', async () => {
    // First call: /auth/me 401 (logged-out visitor)
    // Second call: /api/game/leaderboard 200 (page should still render)
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            page: 0, last_page: 0, per_page: 20, total: 1, results: [SAMPLE_ROW],
            summary: {
              max_max_streak: { value: 0, display_name: 'No Data' },
              max_current_streak: { value: 0, display_name: 'No Data' },
              max_points: { value: 0, display_name: 'No Data' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

    renderLeaderboard()
    // Wait for the leaderboard to render (proves the 401 didn't redirect away)
    await waitFor(() => screen.getByText('Bob'))

    // Verify NO token-refresh endpoint was called as a side-effect of the 401
    const calls = global.fetch.mock.calls.map(c => c[0])
    expect(calls.some(url =>
      typeof url === 'string' && (url.includes('/refresh') || url.includes('/auth/refresh'))
    )).toBe(false)
  })
})

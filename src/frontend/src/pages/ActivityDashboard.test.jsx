import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// chart.js / react-chartjs-2 use canvas which jsdom doesn't implement.
// Stub both so the page renders deterministically and we can assert on the
// data passed in.
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  BarElement: {},
  PointElement: {},
  LineElement: {},
  Tooltip: {},
  Legend: {},
}))
vi.mock('react-chartjs-2', () => ({
  Bar: ({ data }) => (
    <div
      data-testid="bar-chart"
      data-labels={JSON.stringify(data?.labels ?? [])}
      data-values={JSON.stringify(data?.datasets?.[0]?.data ?? [])}
    />
  ),
  Line: ({ data }) => (
    <div
      data-testid="line-chart"
      data-labels={JSON.stringify(data?.labels ?? [])}
      data-values={JSON.stringify(data?.datasets?.[0]?.data ?? [])}
    />
  ),
}))

vi.mock('../Components/Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}))

import ActivityDashboard from './ActivityDashboard'

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function buildActivityPayload({ games = [], messages = [], lastLogin = '2026-04-27T18:30:00Z', streak = 4 } = {}) {
  return {
    last_login_at: lastLogin,
    active_streak_days: streak,
    games_per_day: games,
    messages_per_day: messages,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/profile/activity']}>
      <ActivityDashboard />
    </MemoryRouter>
  )
}

describe('ActivityDashboard page', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('access_token', 'fake-token')
    sessionStorage.setItem('refresh_token', 'fake-refresh-token')
    sessionStorage.setItem('token_type', 'bearer')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('renders both charts and the streak/last-login cards from the activity payload', async () => {
    const games = [
      { date: '2026-04-26', count: 2 },
      { date: '2026-04-27', count: 5 },
    ]
    const messages = [
      { date: '2026-04-26', count: 7 },
      { date: '2026-04-27', count: 3 },
    ]
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      jsonResponse(buildActivityPayload({ games, messages, streak: 4 }))
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()

    expect(screen.getByText('Active streak (days)')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Last login')).toBeInTheDocument()

    const bar = screen.getByTestId('bar-chart')
    expect(JSON.parse(bar.getAttribute('data-values'))).toEqual([2, 5])
    expect(JSON.parse(bar.getAttribute('data-labels'))).toEqual(['04-26', '04-27'])

    const line = screen.getByTestId('line-chart')
    expect(JSON.parse(line.getAttribute('data-values'))).toEqual([7, 3])
  })

  it('shows "Never" when last_login_at is null', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      jsonResponse(buildActivityPayload({ lastLogin: null, streak: 0 }))
    )
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Never')).toBeInTheDocument()
    })
  })

  it('shows the loading state before the response resolves', () => {
    vi.spyOn(global, 'fetch').mockImplementationOnce(
      () => new Promise(() => {})
    )
    renderPage()
    expect(screen.getByText(/Loading activity/i)).toBeInTheDocument()
  })

  it('shows an error message when the activity endpoint fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('boom', { status: 500 })
    )
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Failed to load activity/i)).toBeInTheDocument()
    })
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument()
  })

  it('polls /api/users/activity every 5s and updates the visible chart', async () => {
    const initialPayload = buildActivityPayload({
      games: [{ date: '2026-04-27', count: 1 }],
      messages: [{ date: '2026-04-27', count: 0 }],
      streak: 1,
    })
    const updatedPayload = buildActivityPayload({
      games: [{ date: '2026-04-27', count: 5 }],
      messages: [{ date: '2026-04-27', count: 0 }],
      streak: 2,
    })
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(jsonResponse(initialPayload))
      .mockResolvedValueOnce(jsonResponse(updatedPayload))

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
    try {
      renderPage()
      await waitFor(() => {
        const bar = screen.getByTestId('bar-chart')
        expect(JSON.parse(bar.getAttribute('data-values'))).toEqual([1])
      })
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(5000)
      await waitFor(() => {
        const bar = screen.getByTestId('bar-chart')
        expect(JSON.parse(bar.getAttribute('data-values'))).toEqual([5])
      })
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('pauses polling while the tab is hidden and resumes on visibility change', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse(buildActivityPayload({
        games: [{ date: '2026-04-27', count: 1 }],
        messages: [{ date: '2026-04-27', count: 0 }],
        streak: 1,
      }))
    )

    const visibilityState = { value: 'visible' }
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => visibilityState.value === 'hidden',
    })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState.value,
    })

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
    try {
      renderPage()
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1)
      })

      visibilityState.value = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))

      await vi.advanceTimersByTimeAsync(20_000)
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      visibilityState.value = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(2)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders an accessible data table next to each chart', async () => {
    const games = [{ date: '2026-04-27', count: 1 }]
    const messages = [{ date: '2026-04-27', count: 9 }]
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      jsonResponse(buildActivityPayload({ games, messages }))
    )
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })
    expect(
      screen.getByRole('table', { name: /Games played per day/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('table', { name: /Messages sent per day/i })
    ).toBeInTheDocument()
  })
})

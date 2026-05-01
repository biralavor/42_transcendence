import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// chart.js / react-chartjs-2 use canvas which jsdom doesn't implement.
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
      data-values={JSON.stringify(data?.datasets?.[0]?.data ?? [])}
    />
  ),
  Line: ({ data }) => (
    <div
      data-testid="line-chart"
      data-values={JSON.stringify(data?.datasets?.[0]?.data ?? [])}
    />
  ),
}))

vi.mock('../Components/Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}))

import Admin from './Admin'

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Per-day counts intentionally differ from totals so getByText('5')/getByText('34')
// asserts uniquely against the StatCard values, not the per-day table cells.
function buildAdminPayload({
  rangeStart = '2026-03-30',
  rangeEnd = '2026-04-28',
  activeUsers = 12,
  gamesTotal = 5,
  messagesTotal = 34,
  gamesPerDay = [{ date: '2026-04-28', count: 2 }],
  messagesPerDay = [{ date: '2026-04-28', count: 7 }],
} = {}) {
  return {
    range_start: rangeStart,
    range_end: rangeEnd,
    active_users: activeUsers,
    games_total: gamesTotal,
    messages_total: messagesTotal,
    games_per_day: gamesPerDay,
    messages_per_day: messagesPerDay,
  }
}

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<div data-testid="home">HOME</div>} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Admin page', () => {
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

  it('renders the three aggregate stats and both charts for admin users', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ id: 1, username: 'admin', is_admin: true }))
      .mockResolvedValueOnce(jsonResponse(buildAdminPayload()))
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('Active users')).toBeInTheDocument()
    })
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('34')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('redirects non-admin users to /', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ id: 2, username: 'bob', is_admin: false }))
    renderAdmin()
    await waitFor(() => {
      expect(screen.getByTestId('home')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Active users/i)).not.toBeInTheDocument()
  })

  it('polls /admin/activity every 5s and updates the visible stats', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ id: 1, username: 'admin', is_admin: true }))
      .mockResolvedValueOnce(jsonResponse(buildAdminPayload({
        activeUsers: 12, gamesTotal: 5, messagesTotal: 34,
      })))
      .mockResolvedValueOnce(jsonResponse(buildAdminPayload({
        activeUsers: 13, gamesTotal: 6, messagesTotal: 40,
      })))

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
    try {
      renderAdmin()
      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument()
      })
      expect(fetchSpy).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(5000)
      await waitFor(() => {
        expect(screen.getByText('6')).toBeInTheDocument()
      })
      expect(screen.getByText('40')).toBeInTheDocument()
      expect(fetchSpy).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('pauses polling while the tab is hidden and resumes on visibility change', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ id: 1, username: 'admin', is_admin: true }))
      .mockResolvedValue(jsonResponse(buildAdminPayload({
        activeUsers: 1, gamesTotal: 1, messagesTotal: 1,
      })))

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
      renderAdmin()
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(2) // /auth/me + first /activity
      })

      visibilityState.value = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))

      await vi.advanceTimersByTimeAsync(20_000)
      expect(fetchSpy).toHaveBeenCalledTimes(2)

      visibilityState.value = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(3)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('passes start and end query params on every request', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ id: 1, username: 'admin', is_admin: true }))
      .mockResolvedValueOnce(jsonResponse(buildAdminPayload()))

    renderAdmin()
    await waitFor(() => {
      expect(screen.getByText('Active users')).toBeInTheDocument()
    })

    const activityCall = fetchSpy.mock.calls.find(
      ([url]) => typeof url === 'string' && url.includes('/admin/activity'),
    )
    expect(activityCall).toBeDefined()
    expect(activityCall[0]).toMatch(/start=\d{4}-\d{2}-\d{2}/)
    expect(activityCall[0]).toMatch(/end=\d{4}-\d{2}-\d{2}/)
  })

  it('shows the loading state before /auth/me resolves', () => {
    let resolveMe
    vi.spyOn(global, 'fetch').mockImplementationOnce(
      () => new Promise(resolve => { resolveMe = resolve })
    )
    renderAdmin()
    expect(screen.getByText(/Loading admin stats/i)).toBeInTheDocument()
    resolveMe(jsonResponse({ id: 1, username: 'admin', is_admin: false }))
  })
})

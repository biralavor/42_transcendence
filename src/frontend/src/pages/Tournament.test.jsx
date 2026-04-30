import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Tournament from './Tournament'
import { apiCall, apiJson } from '../utils/apiClient'

let wsHandlers = {}
const mockWsClient = {
  send: vi.fn(),
  close: vi.fn(),
}

vi.mock('../utils/wsClient', () => ({
  createWsClient: vi.fn((_url, handlers = {}) => {
    wsHandlers = handlers
    return mockWsClient
  }),
}))

vi.mock('../utils/apiClient', () => ({
  apiCall: vi.fn(),
  apiJson: vi.fn(),
}))

vi.mock('../context/authContext', () => ({
  useAuth: () => ({
    auth: { access_token: 'test-token' },
  }),
}))

vi.mock('../Components/Navbar', () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}))

function mockOk(data) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  }
}

function makeTournament(participantIds) {
  return {
    id: 99,
    name: 'Spring Cup',
    creator_id: 1,
    max_participants: 4,
    status: 'open',
    created_at: '2026-04-21T00:00:00Z',
    participants: participantIds.map((userId, index) => ({
      user_id: userId,
      joined_at: `2026-04-21T00:00:0${index}Z`,
    })),
    matches: [],
  }
}

function renderTournamentPage() {
  return render(
    <MemoryRouter initialEntries={['/tournaments/99']}>
      <Routes>
        <Route path="/tournaments/:id" element={<Tournament />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Tournament page realtime sync', () => {
  const originalVisibilityState = Object.getOwnPropertyDescriptor(
    Document.prototype,
    'visibilityState',
  )

  beforeEach(() => {
    wsHandlers = {}
    mockWsClient.send.mockClear()
    mockWsClient.close.mockClear()
    vi.clearAllMocks()
    apiJson.mockResolvedValue({})
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalVisibilityState) {
      Object.defineProperty(Document.prototype, 'visibilityState', originalVisibilityState)
    } else {
      delete Document.prototype.visibilityState
    }
  })

  it('refreshes tournament data when websocket sends tournament_updated', async () => {
    const firstTournament = makeTournament([1])
    const secondTournament = makeTournament([1, 2])
    let tournamentReads = 0

    apiCall.mockImplementation(async (url) => {
      if (url === '/api/users/auth/me') {
        return mockOk({ id: 1, username: 'owner' })
      }
      if (url === '/api/game/tournaments/99') {
        tournamentReads += 1
        return tournamentReads === 1
          ? mockOk(firstTournament)
          : mockOk(secondTournament)
      }
      if (url === '/api/users/profile/1') {
        return mockOk({ username: 'owner', display_name: 'Owner', avatar_url: null })
      }
      if (url === '/api/users/profile/2') {
        return mockOk({ username: 'alice', display_name: 'Alice', avatar_url: null })
      }
      throw new Error(`Unexpected URL in test: ${url}`)
    })

    renderTournamentPage()

    await screen.findByText(/1 \/ 4 participants/i)

    await act(async () => {
      await wsHandlers.onMessage?.({
        type: 'tournament_updated',
        tournament_id: 99,
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/2 \/ 4 participants/i)).toBeInTheDocument()
    })
  })

  it('polls and refreshes participants without websocket events', async () => {
    const firstTournament = makeTournament([1])
    const secondTournament = makeTournament([1, 2])
    let tournamentReads = 0
    const intervalCallbacks = new Map()
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation((cb, ms) => {
      intervalCallbacks.set(Number(ms), cb)
      return intervalCallbacks.size
    })
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {})

    apiCall.mockImplementation(async (url) => {
      if (url === '/api/users/auth/me') {
        return mockOk({ id: 1, username: 'owner' })
      }
      if (url === '/api/game/tournaments/99') {
        tournamentReads += 1
        return tournamentReads === 1
          ? mockOk(firstTournament)
          : mockOk(secondTournament)
      }
      if (url === '/api/users/profile/1') {
        return mockOk({ username: 'owner', display_name: 'Owner', avatar_url: null })
      }
      if (url === '/api/users/profile/2') {
        return mockOk({ username: 'alice', display_name: 'Alice', avatar_url: null })
      }
      throw new Error(`Unexpected URL in test: ${url}`)
    })

    renderTournamentPage()

    try {
      await screen.findByText(/1 \/ 4 participants/i)

      const pollingCallback = intervalCallbacks.get(3000)
      expect(typeof pollingCallback).toBe('function')

      await act(async () => {
        await pollingCallback?.()
      })

      await waitFor(() => {
        expect(screen.getByText(/2 \/ 4 participants/i)).toBeInTheDocument()
      })
    } finally {
      setIntervalSpy.mockRestore()
      clearIntervalSpy.mockRestore()
    }
  })

  it('refreshes when page becomes visible again', async () => {
    const firstTournament = makeTournament([1])
    const secondTournament = makeTournament([1, 2])
    let tournamentReads = 0
    let visibilityState = 'hidden'

    Object.defineProperty(Document.prototype, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    })

    apiCall.mockImplementation(async (url) => {
      if (url === '/api/users/auth/me') {
        return mockOk({ id: 1, username: 'owner' })
      }
      if (url === '/api/game/tournaments/99') {
        tournamentReads += 1
        return tournamentReads === 1
          ? mockOk(firstTournament)
          : mockOk(secondTournament)
      }
      if (url === '/api/users/profile/1') {
        return mockOk({ username: 'owner', display_name: 'Owner', avatar_url: null })
      }
      if (url === '/api/users/profile/2') {
        return mockOk({ username: 'alice', display_name: 'Alice', avatar_url: null })
      }
      throw new Error(`Unexpected URL in test: ${url}`)
    })

    renderTournamentPage()

    await screen.findByText(/1 \/ 4 participants/i)

    visibilityState = 'visible'
    await act(async () => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => {
      expect(screen.getByText(/2 \/ 4 participants/i)).toBeInTheDocument()
    })
  })

  it('shows WO message when tournament ready timeout has a winner', async () => {
    apiCall.mockImplementation(async (url) => {
      if (url === '/api/users/auth/me') {
        return mockOk({ id: 1, username: 'owner' })
      }
      if (url === '/api/game/tournaments/99') {
        return mockOk(makeTournament([1, 2]))
      }
      if (url === '/api/users/profile/1') {
        return mockOk({ username: 'owner', display_name: 'Owner', avatar_url: null })
      }
      if (url === '/api/users/profile/2') {
        return mockOk({ username: 'alice', display_name: 'Alice', avatar_url: null })
      }
      throw new Error(`Unexpected URL in test: ${url}`)
    })

    renderTournamentPage()
    await screen.findByText(/2 \/ 4 participants/i)

    await act(async () => {
      await wsHandlers.onMessage?.({
        type: 'match_ready_timeout',
        tournament_id: 99,
        match_id: 10,
        winner_id: 1,
      })
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Ready timeout: match resolved by WO.')
  })

  it('shows no-winner message when tournament ready timeout has no ready players', async () => {
    apiCall.mockImplementation(async (url) => {
      if (url === '/api/users/auth/me') {
        return mockOk({ id: 1, username: 'owner' })
      }
      if (url === '/api/game/tournaments/99') {
        return mockOk(makeTournament([1, 2]))
      }
      if (url === '/api/users/profile/1') {
        return mockOk({ username: 'owner', display_name: 'Owner', avatar_url: null })
      }
      if (url === '/api/users/profile/2') {
        return mockOk({ username: 'alice', display_name: 'Alice', avatar_url: null })
      }
      throw new Error(`Unexpected URL in test: ${url}`)
    })

    renderTournamentPage()
    await screen.findByText(/2 \/ 4 participants/i)

    await act(async () => {
      await wsHandlers.onMessage?.({
        type: 'match_ready_timeout',
        tournament_id: 99,
        match_id: 10,
        winner_id: null,
      })
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ready timeout: no player ready, no winner assigned.',
    )
  })
})

import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import GamePage from './GamePage'
import { apiJson } from '../utils/apiClient'
import { useAuth } from '../context/authContext'

// apiJson rejects by default so profile fetches fail silently and names
// fall back to location.state values. Override per-test for fetch assertions.
vi.mock('../utils/apiClient', () => ({
  apiJson: vi.fn().mockRejectedValue(new Error('no server in tests')),
}))

// Default: authenticated. Spectator + auth-gate tests override per-test.
vi.mock('../context/authContext', () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: true, isAuthReady: true })),
}))

// Two buttons so tests can fire either player winning
vi.mock('../Components/PongCanvasMultiplayer', () => ({
  default: ({ onGameEnd, onSpectatorCount }) => (
    <>
      <button onClick={() => onGameEnd?.({ winner_id: 1, score_p1: 10, score_p2: 3 })}>
        Simulate Game End
      </button>
      <button onClick={() => onGameEnd?.({ winner_id: 2, score_p1: 3, score_p2: 10 })}>
        Simulate Opponent Win
      </button>
      <button onClick={() => onSpectatorCount?.(0)}>Set Spectators 0</button>
      <button onClick={() => onSpectatorCount?.(3)}>Set Spectators 3</button>
    </>
  ),
}))

vi.mock('../Components/Navbar', () => ({ default: () => <nav /> }))

// Expose all props used in tests via data-testid
vi.mock('../Components/GameOverOverlay', () => ({
  default: ({ isCurrentUserWinner, winnerName, p1Name, p2Name, scoreP1, scoreP2, isSpectator }) => (
    <div>
      {isSpectator
        ? <h1>MATCH OVER</h1>
        : <h1>{isCurrentUserWinner ? 'YOU WON' : 'YOU LOST'}</h1>
      }
      <span data-testid="winner-name">{winnerName}</span>
      <span data-testid="p1-name">{p1Name}</span>
      <span data-testid="p2-name">{p2Name}</span>
      <span>p1:{scoreP1}</span>
      <span>p2:{scoreP2}</span>
    </div>
  ),
}))

function renderGamePage(state = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/game/room-1', state }]}>
      <Routes>
        <Route path="/game/:roomId" element={<GamePage />} />
        <Route path="/play" element={<div>Play page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

const remoteState = {
  currentUser: { id: 1, username: 'Alice', avatar_url: null },
  opponent:    { id: 2, username: 'Bob',   avatar_url: null },
}

const tournamentState = {
  currentUser: { id: 1, username: 'Alice', avatar_url: null },
  opponent: { id: 2, username: 'Bob', avatar_url: null },
  player1_id: 1,
  player2_id: 2,
  tournamentId: 99,
  matchId: 7,
}

describe('GamePage game over overlay', () => {
  beforeEach(() => {
    apiJson.mockRejectedValue(new Error('no server in tests'))
  })

  it('shows YOU WON with correct scores when currentUser wins', async () => {
    renderGamePage(remoteState)
    fireEvent.click(screen.getByText('Simulate Game End'))
    expect(await screen.findByRole('heading', { name: /you won/i })).toBeInTheDocument()
    expect(screen.getByText('p1:10')).toBeInTheDocument()
    expect(screen.getByText('p2:3')).toBeInTheDocument()
  })

  it('shows YOU LOST and winnerName is the current user (not the opponent) when opponent wins', async () => {
    renderGamePage(remoteState)
    fireEvent.click(screen.getByText('Simulate Opponent Win'))
    expect(await screen.findByRole('heading', { name: /you lost/i })).toBeInTheDocument()
    // winnerName comes from myName (/auth/me), so the screen always addresses the viewer
    expect(screen.getByTestId('winner-name').textContent).toBe('Alice')
  })

  it('fetches and displays player names from /api/users/profile/:id', async () => {
    apiJson.mockImplementation((url) => {
      if (url.includes('/profile/1')) return Promise.resolve({ id: 1, username: 'alice', display_name: 'Alice from DB' })
      if (url.includes('/profile/2')) return Promise.resolve({ id: 2, username: 'bob',   display_name: 'Bob from DB' })
      return Promise.reject(new Error('unexpected url'))
    })
    renderGamePage(remoteState)
    // Flush async profile fetches
    await act(async () => {})
    fireEvent.click(screen.getByText('Simulate Game End'))
    await screen.findByRole('heading', { name: /you won/i })
    expect(screen.getByTestId('p1-name').textContent).toBe('Alice from DB')
    expect(screen.getByTestId('p2-name').textContent).toBe('Bob from DB')
    expect(apiJson).toHaveBeenCalledWith('/api/users/profile/1')
    expect(apiJson).toHaveBeenCalledWith('/api/users/profile/2')
  })

  it('shows YOU LOST for player2 in tournament even when player1_id in state is the opponent', async () => {
    // Regression: tournament navigation puts bracket player1_id (opponent) in location.state.
    // João (id=2) is bracket player2; state.player1_id = 1 (Maria).
    // Without the /auth/me fix, João would see isCurrentUserWinner=true because
    // winner_id(1) === player1_id(1). With the fix, myId=2 so he sees YOU LOST.
    apiJson.mockImplementation((url) => {
      if (url.includes('/auth/me')) return Promise.resolve({ id: 2, username: 'joao', display_name: 'João' })
      return Promise.reject(new Error('no-op'))
    })
    const tournamentState = {
      player1_id: 1,   // bracket's player1 = Maria (the OPPONENT for João)
      player2_id: 2,   // bracket's player2 = João (the VIEWER)
      tournamentId: 99,
      matchId: 7,
    }
    renderGamePage(tournamentState)
    await act(async () => {})
    // Maria (winner_id=1) wins — João clicks the "Simulate Game End" (winner_id=1)
    fireEvent.click(screen.getByText('Simulate Game End'))
    // João should see YOU LOST, not YOU WON
    expect(await screen.findByRole('heading', { name: /you lost/i })).toBeInTheDocument()
    expect(screen.getByTestId('winner-name').textContent).toBe('João')
    expect(apiJson.mock.calls.some(([url]) =>
      url.includes('/api/game/tournaments/99/matches/7/result')
    )).toBe(false)
  })

  it('skips profile fetch for player2 in AI games (player2Id === 0)', async () => {
    apiJson.mockResolvedValue({ id: 1, username: 'alice', display_name: 'Alice' })
    const aiState = { player1_id: 1, player2_id: 0, difficulty: 'medium', gameType: 'ai',
      currentUser: { id: 1, username: 'Alice', avatar_url: null } }
    renderGamePage(aiState)
    await act(async () => {})
    expect(apiJson).toHaveBeenCalledWith('/api/users/profile/1')
    expect(apiJson).not.toHaveBeenCalledWith('/api/users/profile/0')
  })

  it('falls back to display_name, then username when display_name is absent', async () => {
    apiJson.mockImplementation((url) => {
      if (url.includes('/profile/1')) return Promise.resolve({ id: 1, username: 'alice', display_name: null })
      if (url.includes('/profile/2')) return Promise.resolve({ id: 2, username: 'bob',   display_name: null })
      return Promise.reject(new Error('unexpected url'))
    })
    renderGamePage(remoteState)
    await act(async () => {})
    fireEvent.click(screen.getByText('Simulate Game End'))
    await screen.findByRole('heading', { name: /you won/i })
    expect(screen.getByTestId('p1-name').textContent).toBe('alice')
    expect(screen.getByTestId('p2-name').textContent).toBe('bob')
  })

  it('does not submit tournament results from the game page client', async () => {
    apiJson.mockImplementation((url) => {
      if (url.includes('/auth/me')) {
        return Promise.resolve({ id: 1, username: 'alice', display_name: 'Alice' })
      }
      if (url.includes('/profile/')) {
        return Promise.reject(new Error('profile ignored'))
      }
      if (url.includes('/api/game/tournaments/99/matches/7/result')) {
        return Promise.resolve({})
      }
      return Promise.reject(new Error(`unexpected url: ${url}`))
    })

    renderGamePage(tournamentState)
    await act(async () => {})

    fireEvent.click(screen.getByText('Simulate Game End'))

    expect(await screen.findByRole('heading', { name: /you won/i })).toBeInTheDocument()

    fireEvent.click(screen.getByText('Simulate Game End'))

    const resultCalls = apiJson.mock.calls.filter(([url]) =>
      url.includes('/api/game/tournaments/99/matches/7/result')
    )
    expect(resultCalls).toHaveLength(0)
  })

  it('does not submit tournament result from the losing client', async () => {
    apiJson.mockImplementation((url) => {
      if (url.includes('/auth/me')) {
        return Promise.resolve({ id: 2, username: 'bob', display_name: 'Bob' })
      }
      if (url.includes('/profile/')) {
        return Promise.reject(new Error('profile ignored'))
      }
      if (url.includes('/api/game/tournaments/99/matches/7/result')) {
        return Promise.resolve({})
      }
      return Promise.reject(new Error(`unexpected url: ${url}`))
    })

    renderGamePage({
      ...tournamentState,
      currentUser: { id: 2, username: 'Bob', avatar_url: null },
    })
    await act(async () => {})

    fireEvent.click(screen.getByText('Simulate Game End'))

    expect(await screen.findByRole('heading', { name: /you lost/i })).toBeInTheDocument()
    expect(apiJson.mock.calls.some(([url]) =>
      url.includes('/api/game/tournaments/99/matches/7/result')
    )).toBe(false)
  })
})

function renderSpectator(roomId = 'invite-101-202-aaa') {
  return render(
    <MemoryRouter initialEntries={[`/game/${roomId}?spectate=true`]}>
      <Routes>
        <Route path="/game/:roomId" element={<GamePage />} />
        <Route path="/play" element={<div>Play page</div>} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('GamePage spectator branch', () => {
  beforeEach(() => {
    apiJson.mockRejectedValue(new Error('no server in tests'))
    useAuth.mockReturnValue({ isAuthenticated: false, isAuthReady: true })
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            game_id: 'invite-101-202-aaa',
            player1: { id: 101, username: 'alice', display_name: 'Alice A', avatar_url: null },
            player2: { id: 202, username: 'bob',   display_name: 'Bob B',   avatar_url: null },
            started_at: new Date().toISOString(),
            spectator_count: 2,
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the "Watching as spectator" banner', async () => {
    renderSpectator()
    expect(await screen.findByText(/watching as spectator/i)).toBeInTheDocument()
  })

  it('does NOT redirect to /play even though location.state has no player IDs', async () => {
    renderSpectator()
    await screen.findByText(/watching as spectator/i)
    expect(screen.queryByText(/play page/i)).not.toBeInTheDocument()
  })

  it('shows initial spectator count from /api/games/live', async () => {
    renderSpectator()
    await screen.findByText(/watching as spectator/i)
    expect(await screen.findByText(/👁 2/)).toBeInTheDocument()
  })

  it('shows the GameOverOverlay with MATCH OVER (not YOU WON/YOU LOST) when game ends for spectator', async () => {
    renderSpectator()
    await screen.findByText(/watching as spectator/i)
    fireEvent.click(screen.getByText('Simulate Game End'))
    expect(await screen.findByRole('heading', { name: /match over/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /you won/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /you lost/i })).not.toBeInTheDocument()
  })
})

describe('GamePage spectator winnerName', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockLiveGame(player1Id, player2Id, p1DisplayName, p2DisplayName) {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            game_id: 'invite-101-202-aaa',
            player1: { id: player1Id, username: p1DisplayName.toLowerCase(), display_name: p1DisplayName, avatar_url: null },
            player2: { id: player2Id, username: p2DisplayName.toLowerCase(), display_name: p2DisplayName, avatar_url: null },
            started_at: new Date().toISOString(),
            spectator_count: 0,
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
  }

  it('shows p1Name as winnerName when winner_id matches player1 from live fetch', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isAuthReady: true })
    // winner_id=1 from "Simulate Game End" — match player1.id=1
    mockLiveGame(1, 2, 'Alice Live', 'Bob Live')
    renderSpectator()
    await screen.findByText(/watching as spectator/i)
    // Flush the live-game fetch effects so specPlayer1Id/specPlayer2Id are set
    await act(async () => {})
    fireEvent.click(screen.getByText('Simulate Game End'))   // winner_id: 1
    await screen.findByRole('heading', { name: /match over/i })
    expect(screen.getByTestId('winner-name').textContent).toBe('Alice Live')
  })

  it('shows p2Name as winnerName when winner_id matches player2 from live fetch', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isAuthReady: true })
    // winner_id=2 from "Simulate Opponent Win" — match player2.id=2
    mockLiveGame(1, 2, 'Alice Live', 'Bob Live')
    renderSpectator()
    await screen.findByText(/watching as spectator/i)
    await act(async () => {})
    fireEvent.click(screen.getByText('Simulate Opponent Win'))  // winner_id: 2
    await screen.findByRole('heading', { name: /match over/i })
    expect(screen.getByTestId('winner-name').textContent).toBe('Bob Live')
  })
})

describe('GamePage non-spectator auth gate', () => {
  beforeEach(() => {
    apiJson.mockRejectedValue(new Error('no server in tests'))
    useAuth.mockReturnValue({ isAuthenticated: false, isAuthReady: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects to /login when not authenticated and not a spectator', async () => {
    render(
      <MemoryRouter initialEntries={[`/game/some-room`]}>
        <Routes>
          <Route path="/game/:roomId" element={<GamePage />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText(/login page/i)).toBeInTheDocument()
  })
})

describe('GamePage player audience banner', () => {
  beforeEach(() => {
    apiJson.mockRejectedValue(new Error('no server in tests'))
    useAuth.mockReturnValue({ isAuthenticated: true, isAuthReady: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderPlayer() {
    return render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/game/room-1',
            state: { player1_id: 1, player2_id: 2 },
          },
        ]}
      >
        <Routes>
          <Route path="/game/:roomId" element={<GamePage />} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('does NOT render the audience banner when spectator count is 0', () => {
    renderPlayer()
    expect(screen.queryByText(/audience/i)).not.toBeInTheDocument()
  })

  it('renders the "Audience" banner when count > 0', () => {
    renderPlayer()
    fireEvent.click(screen.getByText('Set Spectators 3'))
    expect(screen.getByText(/audience/i)).toBeInTheDocument()
    expect(screen.getByText(/👁 3/)).toBeInTheDocument()
  })

  it('hides the audience banner again when count returns to 0', () => {
    renderPlayer()
    fireEvent.click(screen.getByText('Set Spectators 3'))
    expect(screen.getByText(/audience/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Set Spectators 0'))
    expect(screen.queryByText(/audience/i)).not.toBeInTheDocument()
  })

  it('does NOT render the spectator banner for a player', () => {
    renderPlayer()
    fireEvent.click(screen.getByText('Set Spectators 3'))
    expect(screen.queryByText(/watching as spectator/i)).not.toBeInTheDocument()
  })
})

describe('GamePage auth guards (review batch)', () => {
  beforeEach(() => {
    apiJson.mockReset()
    apiJson.mockRejectedValue(new Error('no server in tests'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does NOT render the canvas before auth is ready for non-spectators', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isAuthReady: false })
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/game/room-1',
            state: { player1_id: 1, player2_id: 2 },
          },
        ]}
      >
        <Routes>
          <Route path="/game/:roomId" element={<GamePage />} />
        </Routes>
      </MemoryRouter>
    )
    // The canvas mock renders a "Simulate Game End" button. If the page
    // suppresses rendering before auth is ready, the button is absent.
    expect(screen.queryByText('Simulate Game End')).not.toBeInTheDocument()
  })

  it('does NOT call /api/users/auth/me for spectators', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isAuthReady: true })
    render(
      <MemoryRouter initialEntries={[{ pathname: '/game/room-1', search: '?spectate=true' }]}>
        <Routes>
          <Route path="/game/:roomId" element={<GamePage />} />
        </Routes>
      </MemoryRouter>
    )
    // Yield once so any pending effects flush.
    await act(async () => { await Promise.resolve() })
    const calls = apiJson.mock.calls.map((args) => args[0])
    expect(calls).not.toContain('/api/users/auth/me')
  })
})

import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import GamePage from './GamePage'
import { apiJson } from '../utils/apiClient'

// apiJson rejects by default so profile fetches fail silently and names
// fall back to location.state values. Override per-test for fetch assertions.
vi.mock('../utils/apiClient', () => ({
  apiJson: vi.fn().mockRejectedValue(new Error('no server in tests')),
}))

// Two buttons so tests can fire either player winning
vi.mock('../Components/PongCanvasMultiplayer', () => ({
  default: ({ onGameEnd }) => (
    <>
      <button onClick={() => onGameEnd?.({ winner_id: 1, score_p1: 10, score_p2: 3 })}>
        Simulate Game End
      </button>
      <button onClick={() => onGameEnd?.({ winner_id: 2, score_p1: 3, score_p2: 10 })}>
        Simulate Opponent Win
      </button>
    </>
  ),
}))

vi.mock('../Components/Navbar', () => ({ default: () => <nav /> }))

// Expose all props used in tests via data-testid
vi.mock('../Components/GameOverOverlay', () => ({
  default: ({ isCurrentUserWinner, winnerName, p1Name, p2Name, scoreP1, scoreP2 }) => (
    <div>
      <h1>{isCurrentUserWinner ? 'YOU WON' : 'YOU LOST'}</h1>
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
})

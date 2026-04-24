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

  it('shows YOU LOST and winnerName is still current user when opponent wins', async () => {
    renderGamePage(remoteState)
    fireEvent.click(screen.getByText('Simulate Opponent Win'))
    expect(await screen.findByRole('heading', { name: /you lost/i })).toBeInTheDocument()
    // winnerName is always p1Name (current user viewing the screen), not the actual game winner
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

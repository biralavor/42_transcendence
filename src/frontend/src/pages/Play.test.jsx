import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Play from './Play'
import { apiJson } from '../utils/apiClient'

// apiJson rejects by default so auth/me fails silently and p1Name stays "Player 1".
// Override per-test to verify the name-fetch behavior.
vi.mock('../utils/apiClient', () => ({
  apiJson: vi.fn().mockRejectedValue(new Error('no server in tests')),
}))

vi.mock('../Components/Navbar', () => ({ default: () => <nav /> }))
vi.mock('../Components/PongCanvas', () => ({
  default: ({ onGameEnd }) => (
    <>
      <button onClick={() => onGameEnd?.({ winner: 'p1', score_p1: 10, score_p2: 5 })}>
        P1 Wins
      </button>
      <button onClick={() => onGameEnd?.({ winner: 'p2', score_p1: 5, score_p2: 10 })}>
        P2 Wins
      </button>
    </>
  ),
}))
vi.mock('../Components/VsCpuCard', () => ({ default: () => <div>VsCpuCard</div> }))
vi.mock('../Components/GameOverOverlay', () => ({
  default: ({ winnerName, p1Name, isCurrentUserWinner, onPlayAgain, onClose }) => (
    <div>
      <h1>{isCurrentUserWinner ? 'YOU WON' : 'YOU LOST'}</h1>
      <span data-testid="winner-name">{winnerName}</span>
      <span data-testid="p1-name">{p1Name}</span>
      <span data-testid="is-current-user-winner">{String(isCurrentUserWinner)}</span>
      <button onClick={onPlayAgain}>Play Again</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

beforeEach(() => {
  apiJson.mockRejectedValue(new Error('no server in tests'))
})

describe('Play page local game over', () => {
  it('shows YOU WON when logged user (P1) wins', async () => {
    render(<MemoryRouter><Play /></MemoryRouter>)
    fireEvent.click(screen.getByText('P1 Wins'))
    expect(await screen.findByRole('heading', { name: /you won/i })).toBeInTheDocument()
    expect(screen.getByTestId('is-current-user-winner').textContent).toBe('true')
    expect(screen.getByTestId('winner-name').textContent).toBe('Player 1')
  })

  it('shows YOU LOST when opponent (P2) wins', async () => {
    render(<MemoryRouter><Play /></MemoryRouter>)
    fireEvent.click(screen.getByText('P2 Wins'))
    expect(await screen.findByRole('heading', { name: /you lost/i })).toBeInTheDocument()
    expect(screen.getByTestId('is-current-user-winner').textContent).toBe('false')
    // winnerName still shows the logged-in user's name (headline addresses the viewer)
    expect(screen.getByTestId('winner-name').textContent).toBe('Player 1')
  })

  it('hides overlay when Close is clicked', async () => {
    render(<MemoryRouter><Play /></MemoryRouter>)
    fireEvent.click(screen.getByText('P1 Wins'))
    await screen.findByRole('heading', { name: /you won/i })
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('heading', { name: /you won/i })).not.toBeInTheDocument()
  })

  it('remounts canvas when Play Again is clicked', async () => {
    render(<MemoryRouter><Play /></MemoryRouter>)
    fireEvent.click(screen.getByText('P1 Wins'))
    await screen.findByRole('heading', { name: /you won/i })
    fireEvent.click(screen.getByRole('button', { name: /play again/i }))
    expect(screen.queryByRole('heading', { name: /you won/i })).not.toBeInTheDocument()
    expect(screen.getByText('P1 Wins')).toBeInTheDocument()
  })

  it('uses display_name from /api/users/auth/me as viewer name on win', async () => {
    apiJson.mockResolvedValueOnce({ id: 1, username: 'alice', display_name: 'Alice' })
    render(<MemoryRouter><Play /></MemoryRouter>)
    await act(async () => {})
    fireEvent.click(screen.getByText('P1 Wins'))
    expect(await screen.findByRole('heading', { name: /you won/i })).toBeInTheDocument()
    expect(screen.getByTestId('winner-name').textContent).toBe('Alice')
    expect(screen.getByTestId('p1-name').textContent).toBe('Alice')
  })

  it('uses display_name from /api/users/auth/me as viewer name on loss', async () => {
    apiJson.mockResolvedValueOnce({ id: 1, username: 'alice', display_name: 'Alice' })
    render(<MemoryRouter><Play /></MemoryRouter>)
    await act(async () => {})
    fireEvent.click(screen.getByText('P2 Wins'))
    expect(await screen.findByRole('heading', { name: /you lost/i })).toBeInTheDocument()
    // winnerName = viewer's name even on loss
    expect(screen.getByTestId('winner-name').textContent).toBe('Alice')
  })

  it('falls back to username when display_name is absent', async () => {
    apiJson.mockResolvedValueOnce({ id: 1, username: 'alice', display_name: null })
    render(<MemoryRouter><Play /></MemoryRouter>)
    await act(async () => {})
    fireEvent.click(screen.getByText('P1 Wins'))
    expect(await screen.findByRole('heading', { name: /you won/i })).toBeInTheDocument()
    expect(screen.getByTestId('p1-name').textContent).toBe('alice')
  })

  it('falls back to Player 1 when auth/me fails', async () => {
    render(<MemoryRouter><Play /></MemoryRouter>)
    await act(async () => {})
    fireEvent.click(screen.getByText('P1 Wins'))
    expect(await screen.findByRole('heading', { name: /you won/i })).toBeInTheDocument()
    expect(screen.getByTestId('winner-name').textContent).toBe('Player 1')
    expect(screen.getByTestId('p1-name').textContent).toBe('Player 1')
  })
})

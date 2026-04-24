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
    <button onClick={() => onGameEnd?.({ winner: 'p1', score_p1: 10, score_p2: 5 })}>
      End Game
    </button>
  ),
}))
vi.mock('../Components/VsCpuCard', () => ({ default: () => <div>VsCpuCard</div> }))
vi.mock('../Components/GameOverOverlay', () => ({
  default: ({ winnerName, p1Name, isCurrentUserWinner, onPlayAgain, onClose }) => (
    <div>
      <h1>{winnerName} WINS!</h1>
      <span data-testid="p1-name">{p1Name}</span>
      <span data-testid="is-local">{String(isCurrentUserWinner)}</span>
      <button onClick={onPlayAgain}>Play Again</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}))

beforeEach(() => {
  apiJson.mockRejectedValue(new Error('no server in tests'))
})

describe('Play page local game over', () => {
  it('shows overlay with neutral headline when local game ends', async () => {
    render(<MemoryRouter><Play /></MemoryRouter>)
    fireEvent.click(screen.getByText('End Game'))
    expect(await screen.findByRole('heading', { name: /player 1 wins!/i })).toBeInTheDocument()
    expect(screen.getByTestId('is-local').textContent).toBe('null')
  })

  it('hides overlay when Close is clicked', async () => {
    render(<MemoryRouter><Play /></MemoryRouter>)
    fireEvent.click(screen.getByText('End Game'))
    await screen.findByRole('heading', { name: /wins!/i })
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('heading', { name: /wins/i })).not.toBeInTheDocument()
  })

  it('remounts canvas when Play Again is clicked', async () => {
    render(<MemoryRouter><Play /></MemoryRouter>)
    fireEvent.click(screen.getByText('End Game'))
    await screen.findByRole('heading', { name: /wins!/i })
    fireEvent.click(screen.getByRole('button', { name: /play again/i }))
    expect(screen.queryByRole('heading', { name: /wins/i })).not.toBeInTheDocument()
    expect(screen.getByText('End Game')).toBeInTheDocument()
  })

  it('uses display_name from /api/users/auth/me as Player 1 name', async () => {
    apiJson.mockResolvedValueOnce({ id: 1, username: 'alice', display_name: 'Alice' })
    render(<MemoryRouter><Play /></MemoryRouter>)
    // Flush the async auth/me fetch so p1Name state updates
    await act(async () => {})
    fireEvent.click(screen.getByText('End Game'))
    expect(await screen.findByRole('heading', { name: /alice wins!/i })).toBeInTheDocument()
    expect(screen.getByTestId('p1-name').textContent).toBe('Alice')
  })

  it('falls back to username when display_name is absent', async () => {
    apiJson.mockResolvedValueOnce({ id: 1, username: 'alice', display_name: null })
    render(<MemoryRouter><Play /></MemoryRouter>)
    await act(async () => {})
    fireEvent.click(screen.getByText('End Game'))
    expect(await screen.findByRole('heading', { name: /alice wins!/i })).toBeInTheDocument()
    expect(screen.getByTestId('p1-name').textContent).toBe('alice')
  })

  it('falls back to Player 1 when auth/me fails', async () => {
    // apiJson already rejects by default — no override needed
    render(<MemoryRouter><Play /></MemoryRouter>)
    await act(async () => {})
    fireEvent.click(screen.getByText('End Game'))
    expect(await screen.findByRole('heading', { name: /player 1 wins!/i })).toBeInTheDocument()
    expect(screen.getByTestId('p1-name').textContent).toBe('Player 1')
  })
})

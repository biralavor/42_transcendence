import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VsCpuCard from './VsCpuCard'

vi.mock('../utils/apiClient', () => ({ apiJson: vi.fn() }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))

import { apiJson } from '../utils/apiClient'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('VsCpuCard', () => {
  it('renders vs CPU button in idle state', () => {
    render(<VsCpuCard />)
    expect(screen.getByRole('button', { name: /vs cpu/i })).toBeInTheDocument()
    expect(screen.queryByText(/easy/i)).not.toBeInTheDocument()
  })

  it('clicking vs CPU shows difficulty picker with Medium selected by default', () => {
    render(<VsCpuCard />)
    fireEvent.click(screen.getByRole('button', { name: /vs cpu/i }))
    expect(screen.getByRole('button', { name: /easy/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /medium/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /medium/i }).getAttribute('aria-pressed')).toBe('true')
  })

  it('Cancel returns to idle state', () => {
    render(<VsCpuCard />)
    fireEvent.click(screen.getByRole('button', { name: /vs cpu/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByRole('button', { name: /vs cpu/i })).toBeInTheDocument()
    expect(screen.queryByText(/confirm/i)).not.toBeInTheDocument()
  })

  it('Confirm calls GET /auth/me then POST /ai with player_id and difficulty', async () => {
    apiJson.mockResolvedValueOnce({ id: 42, username: 'bira' })
    apiJson.mockResolvedValueOnce({ game_id: 'abc-123' })
    render(<VsCpuCard />)
    fireEvent.click(screen.getByRole('button', { name: /vs cpu/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => expect(apiJson).toHaveBeenCalledTimes(2))
    expect(apiJson).toHaveBeenNthCalledWith(1, '/api/users/auth/me')
    expect(apiJson).toHaveBeenNthCalledWith(2, '/api/game/ai', {
      method: 'POST',
      body: JSON.stringify({ player_id: 42, difficulty: 'medium' }),
    })
  })

  it('on success navigates to /game/{game_id} with player IDs in state', async () => {
    apiJson.mockResolvedValueOnce({ id: 42, username: 'bira' })
    apiJson.mockResolvedValueOnce({ game_id: 'abc-123' })
    render(<VsCpuCard />)
    fireEvent.click(screen.getByRole('button', { name: /vs cpu/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(
      '/game/abc-123',
      { state: { player1_id: 42, player2_id: 0 } },
    ))
  })

  it('on API error shows error message and stays on picker', async () => {
    apiJson.mockResolvedValueOnce({ id: 42, username: 'bira' })
    apiJson.mockRejectedValueOnce(new Error('Server error'))
    render(<VsCpuCard />)
    fireEvent.click(screen.getByRole('button', { name: /vs cpu/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
  })

  it('on /auth/me error shows alert and does not call POST /ai', async () => {
    apiJson.mockRejectedValueOnce(new Error('401 Unauthorized'))
    render(<VsCpuCard />)
    fireEvent.click(screen.getByRole('button', { name: /vs cpu/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(apiJson).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
  })

  it('selecting Easy and confirming sends difficulty: "easy"', async () => {
    apiJson.mockResolvedValueOnce({ id: 42, username: 'bira' })
    apiJson.mockResolvedValueOnce({ game_id: 'xyz-789' })
    render(<VsCpuCard />)
    fireEvent.click(screen.getByRole('button', { name: /vs cpu/i }))
    fireEvent.click(screen.getByRole('button', { name: /easy/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => expect(apiJson).toHaveBeenNthCalledWith(2, '/api/game/ai', {
      method: 'POST',
      body: JSON.stringify({ player_id: 42, difficulty: 'easy' }),
    }))
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import UserProfileModal from './UserProfileModal'

vi.mock('../context/authContext', () => ({
  useAuth: () => ({ auth: { access_token: 'fake-token' } }),
}))

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <UserProfileModal
        username="alice"
        userId={null}
        currentUserId={99}
        onClose={vi.fn()}
        onChat={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('UserProfileModal', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    )
  })

  it('renders modal backdrop', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders close button', () => {
    renderModal()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    screen.getByRole('button', { name: /close/i }).click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

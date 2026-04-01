import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import UserProfileModal from './UserProfileModal'

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

afterEach(() => {
  vi.restoreAllMocks()
})

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

describe('UserProfileModal — with data', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch')
      // search call → resolves username to id
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 7, username: 'alice' }]), { status: 200 })
      )
      // profile call
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ display_name: 'Alice', username: 'alice', avatar_url: '/av.jpg', bio: '', status: 'online' }),
          { status: 200 }
        )
      )
      // history call
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 1, result: 'Win' }, { id: 2, result: 'Loss' }]),
          { status: 200 }
        )
      )
  })

  it('displays display name after loading', async () => {
    renderModal()
    expect(await screen.findByText('Alice')).toBeInTheDocument()
  })

  it('displays @username', async () => {
    renderModal()
    expect(await screen.findByText('@alice')).toBeInTheDocument()
  })

  it('shows win count', async () => {
    renderModal()
    expect(await screen.findByText('1')).toBeInTheDocument() // 1 win
  })

  it('shows match count', async () => {
    renderModal()
    expect(await screen.findByText('2')).toBeInTheDocument() // 2 matches
  })

  it('shows Chat button', async () => {
    renderModal()
    expect(await screen.findByRole('button', { name: /chat/i })).toBeInTheDocument()
  })

  it('calls onChat when Chat button is clicked', async () => {
    const onChat = vi.fn()
    renderModal({ onChat })
    const btn = await screen.findByRole('button', { name: /chat/i })
    btn.click()
    expect(onChat).toHaveBeenCalledWith(7)
  })
})

describe('UserProfileModal — userId provided directly', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch')
      // no search call — profile first
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ display_name: 'Bob', username: 'bob', avatar_url: '/bob.jpg', bio: '', status: 'offline' }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 })
      )
  })

  it('skips search when userId is provided and shows profile', async () => {
    render(
      <MemoryRouter>
        <UserProfileModal
          username="bob"
          userId={42}
          currentUserId={99}
          onClose={vi.fn()}
          onChat={vi.fn()}
        />
      </MemoryRouter>
    )
    expect(await screen.findByText('Bob')).toBeInTheDocument()
    // fetch should have been called twice (profile + history), NOT three times (no search)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})

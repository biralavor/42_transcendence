import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Register from './Register'

vi.mock('../Components/Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}))

vi.mock('../Components/RegisterForm', () => ({
  default: () => <div data-testid="register-form" />,
}))

describe('Register page', () => {
  it('mounts cleanly and renders the Navbar + RegisterForm slots', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
    expect(screen.getByTestId('register-form')).toBeInTheDocument()
  })
})

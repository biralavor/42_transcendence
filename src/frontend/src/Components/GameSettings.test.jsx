import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GameSettings from './GameSettings'

// Mock the context with controllable state
let mockTheme = 'classic'
let mockBallSpeedMultiplier = 1.0
const mockSetTheme = vi.fn((t) => { mockTheme = t })
const mockSetBallSpeedMultiplier = vi.fn((s) => { mockBallSpeedMultiplier = s })

vi.mock('../context/gameSettingsContext', () => ({
  useGameSettings: () => ({
    theme: mockTheme,
    ballSpeedMultiplier: mockBallSpeedMultiplier,
    setTheme: mockSetTheme,
    setBallSpeedMultiplier: mockSetBallSpeedMultiplier,
  }),
}))

vi.mock('../game/themes', () => ({
  THEMES: {
    classic: { label: 'Classic', thumbnail: null },
    neon: { label: 'Neon', thumbnail: '/themes/neon.png' },
    retro: { label: 'Retro', thumbnail: '/themes/retro.png' },
  },
}))

describe('GameSettings', () => {
  beforeEach(() => {
    mockTheme = 'classic'
    mockBallSpeedMultiplier = 1.0
    mockSetTheme.mockClear()
    mockSetBallSpeedMultiplier.mockClear()
  })

  describe('Map theme section', () => {
    it('renders the "Map theme" section title', () => {
      render(<GameSettings />)
      expect(screen.getByText(/map theme/i)).toBeInTheDocument()
    })

    it('renders one button per theme', () => {
      render(<GameSettings />)
      expect(screen.getByRole('button', { name: /classic/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /neon/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retro/i })).toBeInTheDocument()
    })

    it('marks the active theme with aria-pressed=true and the others false', () => {
      render(<GameSettings />)
      expect(screen.getByRole('button', { name: /classic/i })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: /neon/i })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: /retro/i })).toHaveAttribute('aria-pressed', 'false')
    })

    it('calls setTheme when a theme button is clicked', () => {
      render(<GameSettings />)
      fireEvent.click(screen.getByRole('button', { name: /neon/i }))
      expect(mockSetTheme).toHaveBeenCalledWith('neon')
    })

    it('renders a thumbnail image when the theme has one', () => {
      render(<GameSettings />)
      const neonBtn = screen.getByRole('button', { name: /neon/i })
      const img = neonBtn.querySelector('img')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', '/themes/neon.png')
    })

    it('renders a "CLASSIC" placeholder when the theme has no thumbnail', () => {
      render(<GameSettings />)
      const classicBtn = screen.getByRole('button', { name: /classic/i })
      expect(classicBtn.textContent).toMatch(/CLASSIC/)
    })
  })

  describe('Ball speed section', () => {
    it('renders the "Ball speed" section title', () => {
      render(<GameSettings />)
      expect(screen.getByText(/ball speed/i)).toBeInTheDocument()
    })

    it('renders a slider with the correct min/max/step', () => {
      render(<GameSettings />)
      const slider = screen.getByRole('slider', { name: /ball speed multiplier/i })
      expect(slider).toHaveAttribute('min', '0.5')
      expect(slider).toHaveAttribute('max', '2.0')
      expect(slider).toHaveAttribute('step', '0.25')
    })

    it('shows the current multiplier value with × suffix', () => {
      render(<GameSettings />)
      expect(screen.getByText(/1×/)).toBeInTheDocument()
    })

    it('calls setBallSpeedMultiplier when the slider changes, parsed as a float', () => {
      render(<GameSettings />)
      const slider = screen.getByRole('slider', { name: /ball speed multiplier/i })
      fireEvent.change(slider, { target: { value: '1.5' } })
      expect(mockSetBallSpeedMultiplier).toHaveBeenCalledWith(1.5)
    })
  })
})

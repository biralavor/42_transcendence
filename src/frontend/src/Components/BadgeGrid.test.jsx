import { render, screen } from '@testing-library/react'
import BadgeGrid from './BadgeGrid'

const earned = [
  { key: 'win1', name: 'Win 1 Match', description: 'You Won 1 regular matches', icon: '(•̀ᴗ•́)و', earned: true, earned_at: '2026-01-01T00:00:00Z' },
]
const locked = [
  { key: 'perfect_game', name: 'Perfect Pong', description: 'Win a game 10-0', icon: '¬‿¬', earned: false, earned_at: null },
]
const all = [...earned, ...locked]

describe('BadgeGrid', () => {
  it('renders earned badges at full opacity', () => {
    render(<BadgeGrid achievements={all} />)
    const earnedCard = screen.getByTestId('badge-win1')
    expect(earnedCard).not.toHaveClass('badge-locked')
  })

  it('renders locked badges with locked class', () => {
    render(<BadgeGrid achievements={all} />)
    const lockedCard = screen.getByTestId('badge-perfect_game')
    expect(lockedCard).toHaveClass('badge-locked')
  })

  it('shows icon text in earned badge', () => {
    render(<BadgeGrid achievements={earned} />)
    expect(screen.getByText('(•̀ᴗ•́)و')).toBeInTheDocument()
  })

  it('renders lock emoji on locked badge', () => {
    render(<BadgeGrid achievements={locked} />)
    expect(screen.getByText('🔒')).toBeInTheDocument()
  })
})

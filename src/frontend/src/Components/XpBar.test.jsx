import { render, screen } from '@testing-library/react'
import XpBar from './XpBar'

describe('XpBar', () => {
  it('shows level label and XP fraction', () => {
    render(<XpBar level={5} xpInLevel={25} />)
    expect(screen.getByText(/level 5/i)).toBeInTheDocument()
    expect(screen.getByText(/25 \/ 100 xp/i)).toBeInTheDocument()
  })

  it('sets bar width to fill percentage', () => {
    render(<XpBar level={3} xpInLevel={60} />)
    const fill = document.querySelector('.xp-bar-fill')
    expect(fill).toHaveStyle('width: 60%')
  })

  it('shows 0% fill when xpInLevel is 0', () => {
    render(<XpBar level={1} xpInLevel={0} />)
    const fill = document.querySelector('.xp-bar-fill')
    expect(fill).toHaveStyle('width: 0%')
  })
})

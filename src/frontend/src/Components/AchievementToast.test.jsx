import { render, screen, act } from '@testing-library/react'
import AchievementToast from './AchievementToast'

describe('AchievementToast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders icon, name and description', () => {
    render(<AchievementToast icon="(•̀ᴗ•́)و" name="Win 1 Match" description="You Won 1 regular matches" onDismiss={vi.fn()} />)
    expect(screen.getByText('(•̀ᴗ•́)و')).toBeInTheDocument()
    expect(screen.getByText('Win 1 Match')).toBeInTheDocument()
    expect(screen.getByText('You Won 1 regular matches')).toBeInTheDocument()
  })

  it('calls onDismiss after 4 seconds', () => {
    const onDismiss = vi.fn()
    render(<AchievementToast icon="x" name="test" description="desc" onDismiss={onDismiss} />)
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(4000))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

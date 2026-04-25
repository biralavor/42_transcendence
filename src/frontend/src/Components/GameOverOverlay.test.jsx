import { render, screen, fireEvent, act } from '@testing-library/react'
import GameOverOverlay from './GameOverOverlay'

// Suppress DOM emoji side-effects in tests
// Call through for RTL's internal container div; suppress flying-emoji divs spawned by the component
let appendChildSpy
const realAppendChild = document.body.appendChild.bind(document.body)
beforeEach(() => {
  appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
    if (node && node.classList && node.classList.contains('flying-emoji')) return node
    return realAppendChild(node)
  })
})
afterEach(() => {
  appendChildSpy.mockRestore()
})

const makeBaseProps = () => ({
  winnerName: 'Alice',
  scoreP1: 10,
  scoreP2: 4,
  p1Name: 'Alice',
  p2Name: 'Bob',
  onPlayAgain: vi.fn(),
  onClose: vi.fn(),
})

describe('GameOverOverlay — YOU WON / YOU LOST headline', () => {
  it('shows YOU WON when isCurrentUserWinner is true', () => {
    render(<GameOverOverlay {...makeBaseProps()} isCurrentUserWinner={true} />)
    expect(screen.getByRole('heading', { name: /you won/i })).toBeInTheDocument()
  })

  it('shows YOU LOST when isCurrentUserWinner is false', () => {
    render(<GameOverOverlay {...makeBaseProps()} isCurrentUserWinner={false} />)
    expect(screen.getByRole('heading', { name: /you lost/i })).toBeInTheDocument()
  })

  it('shows winnerName, WINS! when isCurrentUserWinner is null (local game)', () => {
    render(<GameOverOverlay {...makeBaseProps()} isCurrentUserWinner={null} />)
    // heading accessible name collapses <br> to whitespace: "Alice, WINS!"
    expect(screen.getByRole('heading', { name: /alice,\s*wins!/i })).toBeInTheDocument()
  })

  it('shows winner name in headline when isCurrentUserWinner is not null', () => {
    const props = makeBaseProps()
    render(<GameOverOverlay {...props} isCurrentUserWinner={true} />)
    // winnerName is now inside h1: "Alice, YOU WON"
    expect(screen.getByRole('heading', { name: /alice,\s*you won/i })).toBeInTheDocument()
  })
})

describe('GameOverOverlay — score display', () => {
  it('renders final score for both players', () => {
    render(<GameOverOverlay {...makeBaseProps()} isCurrentUserWinner={true} />)
    expect(screen.getAllByText(/alice/i).length).toBeGreaterThan(0)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getAllByText(/bob/i).length).toBeGreaterThan(0)
    expect(screen.getByText('4')).toBeInTheDocument()
  })
})

describe('GameOverOverlay — emoji burst', () => {
  afterEach(() => vi.useRealTimers())

  it('spawns at least one emoji on victory', () => {
    vi.useFakeTimers()
    render(<GameOverOverlay {...makeBaseProps()} isCurrentUserWinner={true} />)
    appendChildSpy.mockClear()
    vi.advanceTimersByTime(1)  // fires the delay-0 first spawn timer
    const emojiCalls = appendChildSpy.mock.calls.filter(
      ([node]) => node?.classList?.contains('flying-emoji')
    )
    expect(emojiCalls.length).toBeGreaterThan(0)
  })

  it('spawns at least one emoji on defeat', () => {
    vi.useFakeTimers()
    render(<GameOverOverlay {...makeBaseProps()} isCurrentUserWinner={false} />)
    appendChildSpy.mockClear()
    vi.advanceTimersByTime(1)
    const emojiCalls = appendChildSpy.mock.calls.filter(
      ([node]) => node?.classList?.contains('flying-emoji')
    )
    expect(emojiCalls.length).toBeGreaterThan(0)
  })

  it('spawns victory emojis when isCurrentUserWinner is null (local game)', () => {
    vi.useFakeTimers()
    render(<GameOverOverlay {...makeBaseProps()} isCurrentUserWinner={null} />)
    appendChildSpy.mockClear()
    vi.advanceTimersByTime(1)  // fires the delay-0 first spawn timer
    const emojiCalls = appendChildSpy.mock.calls.filter(
      ([node]) => node?.classList?.contains('flying-emoji')
    )
    expect(emojiCalls.length).toBeGreaterThan(0)
  })
})

describe('GameOverOverlay — buttons', () => {
  it('shows Play Again and Close for non-tournament games', () => {
    render(<GameOverOverlay {...makeBaseProps()} isCurrentUserWinner={true} />)
    expect(screen.getByRole('button', { name: /play again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /view bracket/i })).not.toBeInTheDocument()
  })

  it('shows View Bracket and Next Turn instead of Play Again for tournament games', () => {
    render(
      <GameOverOverlay
        {...makeBaseProps()}
        isCurrentUserWinner={true}
        isTournamentGame={true}
        onViewBracket={vi.fn()}
        onNextTurn={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /play again/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /view bracket/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next turn/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('calls onPlayAgain when Play Again is clicked', () => {
    const props = makeBaseProps()
    render(<GameOverOverlay {...props} isCurrentUserWinner={true} />)
    fireEvent.click(screen.getByRole('button', { name: /play again/i }))
    expect(props.onPlayAgain).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Close is clicked', () => {
    const props = makeBaseProps()
    render(<GameOverOverlay {...props} isCurrentUserWinner={true} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onViewBracket when View Bracket is clicked in tournament mode', () => {
    const onViewBracket = vi.fn()
    render(
      <GameOverOverlay
        {...makeBaseProps()}
        isCurrentUserWinner={true}
        isTournamentGame={true}
        onViewBracket={onViewBracket}
        onNextTurn={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /view bracket/i }))
    expect(onViewBracket).toHaveBeenCalledTimes(1)
  })

  it('calls onNextTurn when Next Turn is clicked in tournament mode', () => {
    const onNextTurn = vi.fn()
    render(
      <GameOverOverlay
        {...makeBaseProps()}
        isCurrentUserWinner={true}
        isTournamentGame={true}
        onViewBracket={vi.fn()}
        onNextTurn={onNextTurn}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /next turn/i }))
    expect(onNextTurn).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', () => {
    const props = makeBaseProps()
    render(<GameOverOverlay {...props} isCurrentUserWinner={true} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('does not throw when Escape is pressed and onClose is undefined', () => {
    const props = { ...makeBaseProps(), onClose: undefined }
    render(<GameOverOverlay {...props} isCurrentUserWinner={true} />)
    expect(() => fireEvent.keyDown(window, { key: 'Escape' })).not.toThrow()
  })

  it('does not call onClose for non-Escape keys', () => {
    const props = makeBaseProps()
    render(<GameOverOverlay {...props} isCurrentUserWinner={true} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'Space' })
    expect(props.onClose).not.toHaveBeenCalled()
  })
})

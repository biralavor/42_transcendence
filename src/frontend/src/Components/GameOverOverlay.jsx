import { useEffect, useRef } from 'react'
import './GameOverOverlay.css'

const victoryEmojiList = ['😊', '🎉', '🔥', '🚀', '✨', '💖', '🌈', '🍪']
const defeatEmojiList  = ['😢', '😭', '💀', '💩', '🥀', '👎', '💣', '👀']

// Matches the CSS animation-duration on .flying-emoji (flyUp / flyDown: 3s).
// Controls both the spawn-stagger window and the post-animation removal delay.
const EMOJI_ANIM_MS = 7000
// How many times the emoji list is repeated per burst (1 = one pass, 2 = double, etc.)
const EMOJI_BURST_REPEAT = 7

function createFlyingEmoji(char, extraClass) {
  const el = document.createElement('div')
  el.classList.add('flying-emoji')
  if (extraClass) el.classList.add(extraClass)
  el.textContent = char
  el.style.left = `${Math.random() * 100}vw`
  el.style.fontSize = `${30 + Math.random() * 40}px`
  document.body.appendChild(el)
  return el
}

function spawnEmojiBurst(emojiList, extraClass) {
  const expandedList = Array.from({ length: EMOJI_BURST_REPEAT }, () => emojiList).flat()
  // Spread emojis evenly across the full animation window so the last one
  // spawns just as the first finishes, giving a continuous one-by-one effect.
  const interval = Math.floor(EMOJI_ANIM_MS / expandedList.length)
  const spawnTimers = []
  const createdEls = []
  expandedList.forEach((emoji, i) => {
    const t = setTimeout(() => {
      const el = createFlyingEmoji(emoji, extraClass)
      createdEls.push(el)
      // Removal timer is intentionally not tracked — cleanup handles it via createdEls
      setTimeout(() => el.remove(), EMOJI_ANIM_MS + 500)
    }, i * interval)
    spawnTimers.push(t)
  })
  return { spawnTimers, createdEls }
}

export default function GameOverOverlay({
  winnerName,
  scoreP1,
  scoreP2,
  p1Name,
  p2Name,
  isCurrentUserWinner = null,
  isTournamentGame,
  onPlayAgain,
  onClose,
  onViewBracket,
  onNextTurn,
}) {
  const panelRef = useRef(null)

  useEffect(() => {
    panelRef.current?.focus()
    let spawnTimers = []
    let createdEls = []
    if (isCurrentUserWinner === true)
      ({ spawnTimers, createdEls } = spawnEmojiBurst(victoryEmojiList, null))
    else if (isCurrentUserWinner === false)
      ({ spawnTimers, createdEls } = spawnEmojiBurst(defeatEmojiList, 'flying-emoji--sad'))
    return () => {
      spawnTimers.forEach(clearTimeout)   // cancel pending spawns
      createdEls.forEach(el => el.remove()) // immediately remove any already-created nodes
    }
  // isCurrentUserWinner is intentionally read once at mount — burst fires only on appearance
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const headline = isCurrentUserWinner === null
    ? 'WINS!'
    : isCurrentUserWinner ? 'YOU WON' : 'YOU LOST'

  const headlineClass = [
    'game-over-headline',
    isCurrentUserWinner === true  && 'game-over-headline--won',
    isCurrentUserWinner === false && 'game-over-headline--lost',
  ].filter(Boolean).join(' ')

  return (
    <div className="game-over-overlay" role="dialog" aria-modal="true" aria-label="Game Over">
      <div className="game-over-panel" ref={panelRef} tabIndex="-1">
        <h1 className={headlineClass}>
          {winnerName && <>{winnerName},<br /></>}
          {headline}
        </h1>
        <div className="game-over-score">
          <span className="game-over-player">{p1Name}: <strong>{scoreP1}</strong></span>
          <span className="game-over-separator">—</span>
          <span className="game-over-player">{p2Name}: <strong>{scoreP2}</strong></span>
        </div>
        <div className="game-over-actions">
          {!isTournamentGame && (
            <button className="btn btn-primary game-over-btn" onClick={onPlayAgain}>
              Play Again
            </button>
          )}
          {isTournamentGame && (
            <>
              <button className="btn btn-primary game-over-btn" onClick={onViewBracket ?? undefined}>
                View Bracket
              </button>
              <button className="btn btn-success game-over-btn" onClick={onNextTurn ?? undefined}>
                Next Turn
              </button>
            </>
          )}
          <button className="btn btn-secondary game-over-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

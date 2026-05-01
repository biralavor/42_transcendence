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
  const interval = Math.max(1, Math.floor(EMOJI_ANIM_MS / expandedList.length))
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
  isSpectator = false,
  forfeitReason = null,
  onPlayAgain,
  onClose,
  onViewBracket,
  onNextTurn,
}) {
  const panelRef = useRef(null)
  const isForfeit = forfeitReason === 'opponent_disconnected'

  useEffect(() => {
    panelRef.current?.focus()
    if (isSpectator) return  // No celebratory/defeat burst for spectators.
    let spawnTimers = []
    let createdEls = []
    if (isCurrentUserWinner === true)
      ({ spawnTimers, createdEls } = spawnEmojiBurst(victoryEmojiList, null))
    else if (isCurrentUserWinner === false)
      ({ spawnTimers, createdEls } = spawnEmojiBurst(defeatEmojiList, 'flying-emoji--sad'))
    else
      // null = local game (both players share the screen); show victory emojis
      // since the winner is always known and celebration is for everyone.
      ({ spawnTimers, createdEls } = spawnEmojiBurst(victoryEmojiList, null))
    return () => {
      spawnTimers.forEach(clearTimeout)   // cancel pending spawns
      createdEls.forEach(el => el.remove()) // immediately remove any already-created nodes
    }
  // isCurrentUserWinner / isSpectator intentionally read once at mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Escape key: proper modal dismissal so aria-modal="true" semantics are correct
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const headline = isSpectator
    ? 'MATCH OVER'
    : isCurrentUserWinner === null
      ? 'WINS!'
      : isCurrentUserWinner ? 'YOU WON' : 'YOU LOST'

  const headlineClass = [
    'game-over-headline',
    !isSpectator && isCurrentUserWinner === true  && 'game-over-headline--won',
    !isSpectator && isCurrentUserWinner === false && 'game-over-headline--lost',
  ].filter(Boolean).join(' ')

  let forfeitSubtitle = null
  if (isForfeit) {
    forfeitSubtitle = isSpectator
      ? `${winnerName} wins — opponent disconnected`
      : isCurrentUserWinner
        ? 'Won by forfeit — opponent disconnected'
        : 'Match ended — opponent disconnected'
  }

  return (
    <div className="game-over-overlay" role="dialog" aria-modal="true" aria-label="Game Over">
      <div className="game-over-panel" ref={panelRef} tabIndex="-1">
        <h1 className={headlineClass}>
          {!isSpectator && winnerName && <>{winnerName},<br /></>}
          {headline}
        </h1>
        {forfeitSubtitle && (
          <p className="game-over-subtitle">{forfeitSubtitle}</p>
        )}
        <div className="game-over-score">
          <span className="game-over-player">{p1Name}: <strong>{scoreP1}</strong></span>
          <span className="game-over-separator">—</span>
          <span className="game-over-player">{p2Name}: <strong>{scoreP2}</strong></span>
        </div>
        <div className="game-over-actions">
          {isSpectator ? (
            <button className="btn btn-primary game-over-btn" onClick={onClose}>
              OK
            </button>
          ) : (
            <>
              {!isTournamentGame && !isForfeit && (
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}

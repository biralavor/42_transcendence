import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJson } from '../utils/apiClient'
import './VsCpuCard.css'

const DIFFICULTIES = ['easy', 'medium', 'hard']

export default function VsCpuCard() {
  const navigate = useNavigate()
  const [step, setStep] = useState('idle')
  const [difficulty, setDifficulty] = useState('medium')
  const [error, setError] = useState(null)

  async function handleConfirm() {
    if (step === 'loading') return
    setStep('loading')
    setError(null)
    try {
      const me = await apiJson('/api/users/auth/me')
      if (!me?.id) throw new Error('Not authenticated')
      const { game_id } = await apiJson('/api/game/ai', {
        method: 'POST',
        body: JSON.stringify({ difficulty }),
      })
      navigate(`/game/${game_id}`, {
        state: { player1_id: me.id, player2_id: 0, difficulty, gameType: 'ai' },
      })
    } catch (err) {
      setError(err?.message || 'Failed to start game. Please try again.')
      setStep('picking')
    }
  }

  if (step === 'idle') {
    return (
      <article className="arcade-card h-100 p-4">
        <span className="arcade-display mb-2 d-inline-block">Mode</span>
        <h2 className="arcade-section-title mb-3">vs CPU</h2>
        <p className="arcade-copy mb-3">
          Challenge the AI opponent. Pick a difficulty and play a solo match against the server-side AI.
        </p>
        <button className="btn btn-primary w-100" onClick={() => setStep('picking')}>
          vs CPU
        </button>
      </article>
    )
  }

  return (
    <article className="arcade-card h-100 p-4">
      <span className="arcade-display mb-2 d-inline-block">Mode</span>
      <h2 className="arcade-section-title mb-3">vs CPU</h2>

      <p className="arcade-copy mb-2">Select difficulty:</p>

      <div className="vs-cpu-difficulty-grid">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            className="btn btn-outline-secondary"
            data-selected={difficulty === d ? 'true' : 'false'}
            aria-pressed={difficulty === d}
            onClick={() => setDifficulty(d)}
          >
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="vs-cpu-error" role="alert">{error}</p>}

      <div className="d-flex gap-2">
        <button
          className="btn btn-primary flex-grow-1"
          onClick={handleConfirm}
          disabled={step === 'loading'}
        >
          {step === 'loading' ? 'Starting…' : 'Confirm'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => { setStep('idle'); setError(null) }}
          disabled={step === 'loading'}
        >
          Cancel
        </button>
      </div>
    </article>
  )
}

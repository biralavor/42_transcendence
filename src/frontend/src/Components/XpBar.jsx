import './XpBar.css'

export default function XpBar({ level, xpInLevel }) {
  const fillPct = Math.min(100, Math.max(0, xpInLevel))
  return (
    <div className="xp-bar-container">
      <div className="xp-bar-labels">
        <span className="xp-bar-level">Level {level}</span>
        <span className="xp-bar-fraction">{xpInLevel} / 100 XP</span>
      </div>
      <div className="xp-bar-track">
        <div className="xp-bar-fill" style={{ width: `${fillPct}%` }} />
      </div>
    </div>
  )
}

import './BadgeGrid.css'

export default function BadgeGrid({ achievements = [] }) {
  return (
    <div className="badge-grid">
      {achievements.map((a) => (
        <div
          key={a.key}
          data-testid={`badge-${a.key}`}
          className={`badge-card ${a.earned ? '' : 'badge-locked'}`}
          title={a.earned ? `${a.name} — ${a.description}` : `${a.name} — ???`}
        >
          <span className="badge-icon">
            {a.earned ? a.icon : '🔒'}
          </span>
          <span className="badge-name">{a.name}</span>
        </div>
      ))}
    </div>
  )
}

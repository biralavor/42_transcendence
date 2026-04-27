import { useEffect } from 'react'
import './AchievementToast.css'

export default function AchievementToast({ icon, name, description, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="achievement-toast" role="alert" aria-live="polite">
      <span className="achievement-toast-icon" style={{ fontFamily: 'monospace' }}>{icon}</span>
      <div className="achievement-toast-body">
        <strong className="achievement-toast-name">{name}</strong>
        <span className="achievement-toast-desc">{description}</span>
      </div>
    </div>
  )
}

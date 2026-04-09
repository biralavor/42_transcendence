import { useEffect, useRef } from 'react'
import { useNotifications } from '../context/notificationContext'
import './NotificationPanel.css'

const TYPE_LABELS = {
  friend_request: 'Friend Request',
  friend_request_accepted: 'Friend Accepted',
  game_invite: 'Game Invite',
  game_invite_response: 'Invite Response',
  game_invite_timeout: 'Invite Expired',
}

export default function NotificationPanel({ onClose }) {
  const { notifications, fetchNotifications, markRead, markAllRead } = useNotifications()
  const panelRef = useRef(null)

  useEffect(() => {
    fetchNotifications()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div className="notif-panel" ref={panelRef} role="dialog" aria-label="Notifications">
      <div className="notif-panel__header">
        <h3 className="notif-panel__title">Notifications</h3>
        <button
          type="button"
          className="notif-panel__mark-all"
          onClick={markAllRead}
        >
          Mark all as read
        </button>
      </div>
      <ul className="notif-panel__list">
        {notifications.length === 0 && (
          <li className="notif-panel__empty">No notifications</li>
        )}
        {notifications.map(notif => (
          <li
            key={notif.id}
            role="listitem"
            className={`notif-panel__item${notif.read ? '' : ' notif-panel__item--unread'}`}
            onClick={() => !notif.read && markRead(notif.id)}
          >
            <span className="notif-panel__type">
              {TYPE_LABELS[notif.type] ?? notif.type}
            </span>
            <span className="notif-panel__msg">{notif.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/notificationContext'
import './NotificationPanel.css'

const TYPE_LABELS = {
    friend_request: 'Friend Request',
    friend_request_accepted: 'Friend Accepted',
    game_invite: 'Game Invite',
    game_invite_response: 'Invite Response',
    game_invite_timeout: 'Invite Expired',
    unread_chat: 'Unread Chat',
}

// Format datetime to relative or short format
function formatDateTime(isoString) {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Get navigation path based on notification type
function getNotificationRoute(notif) {
    switch (notif.type) {
        case 'friend_request':
            return '/profile'
        case 'friend_request_accepted':
            return '/profile'
        case 'game_invite':
            return '/play'
        case 'game_invite_response':
            return '/play'
        case 'game_invite_timeout':
            return '/play'
        case 'unread_chat':
            // Navigate to chat with the room slug
            return `/chat/${notif.room_slug}`
        default:
            return null
    }
}

export default function NotificationPanel({ onClose }) {
    const { notifications, fetchNotifications, markRead, markAllRead } = useNotifications()
    const navigate = useNavigate()
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

    const handleNotificationClick = (notif) => {
        // Mark as read if not already
        if (!notif.read) {
            markRead(notif.id)
        }

        // Navigate based on notification type
        const route = getNotificationRoute(notif)
        if (route) {
            navigate(route)
            onClose()
        }
    }

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
                        onClick={() => handleNotificationClick(notif)}
                    >
                        <div className="notif-panel__item-header">
                            <span className="notif-panel__type">
                                {TYPE_LABELS[notif.type] ?? notif.type}
                            </span>
                            <span className="notif-panel__time">
                                {formatDateTime(notif.created_at)}
                            </span>
                        </div>
                        <span className="notif-panel__msg">{notif.message}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}

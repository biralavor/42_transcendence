import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/authContext'
import { useNotifications } from '../context/notificationContext'
import { useGameInvite } from '../context/gameInviteContext'
import './GameInviteModal.css'

/**
 * GameInviteModal - Displays game invite response notifications as a modal.
 * 
 * Handles responses from the database (game_invite_response notifications).
 * These are shown to the user who sent the original invite.
 */
export default function GameInviteModal() {
    const { user } = useAuth()
    const { notifications, markRead } = useNotifications()
    const { activeInvite, setGameInvite, clearGameInvite } = useGameInvite()

    const [visibleNotification, setVisibleNotification] = useState(null)
    const processedIdsRef = useRef(new Set())
    const debounceTimerRef = useRef(null)

    // Monitor database notifications for game_invite and game_invite_response
    // Use debounce to prevent processing multiple at once
    useEffect(() => {
        // Clear previous debounce timer
        clearTimeout(debounceTimerRef.current)

        // Debounce: wait 100ms to batch rapid notifications
        debounceTimerRef.current = setTimeout(() => {
            // Find first unread notification (either invite or response) we haven't shown yet
            // Prioritize responses over invites (invites come from WebSocket, responses from DB)
            const unreadNotifs = notifications.filter(n =>
                (n.type === 'game_invite_response' || n.type === 'game_invite') && !n.read && n.id != null
            )

            for (const notif of unreadNotifs) {
                // Skip if we've already shown this one
                if (processedIdsRef.current.has(notif.id)) {
                    continue
                }

                // Found a new one to display
                processedIdsRef.current.add(notif.id)
                setVisibleNotification({
                    id: notif.id,
                    message: notif.message,
                })

                break // Only show one at a time
            }
        }, 100)

        return () => clearTimeout(debounceTimerRef.current)
    }, [notifications])

    if (!visibleNotification) return null

    const handleDismiss = () => {
        if (visibleNotification.id) {
            markRead(visibleNotification.id)
        }
        setVisibleNotification(null)
    }

    return (
        <div
            className="game-invite-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Game invite response"
            tabIndex={-1}
        >
            <div className="game-invite-modal">
                <div className="game-invite-modal__content">
                    <h2 className="game-invite-modal__title">Invite Response</h2>
                    <p className="game-invite-modal__message">{visibleNotification.message}</p>
                </div>
                <div className="game-invite-modal__actions">
                    <button
                        type="button"
                        className="arcade-btn arcade-btn-secondary game-invite-btn"
                        onClick={handleDismiss}
                        autoFocus
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    )
}

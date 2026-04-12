import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'
import { useNotifications } from '../context/notificationContext'
import { apiCall } from '../utils/apiClient'
import './GameInviteModal.css'

/**
 * GameInviteModal - Global modal for game invite notifications
 * Shows both incoming invites (game_invite) and responses (game_invite_response)
 * Works on ANY page, not just Profile/Chat
 */
export default function GameInviteModal() {
    const { user } = useAuth()
    const { notifications, markRead } = useNotifications()
    const navigate = useNavigate()

    const [visibleNotification, setVisibleNotification] = useState(null)
    const [isResponding, setIsResponding] = useState(false)
    const processedIdsRef = useRef(new Set())
    const debounceTimerRef = useRef(null)

    // Extract room_id from notification message if present
    const extractRoomId = (message) => {
        if (!message) return null
        const match = message.match(/\[ROOM_ID:([^\]]+)\]/)
        return match ? match[1] : null
    }

    // Parse sender info from game_invite notification
    const parseSenderInfo = (message, notif) => {
        const match = message.match(/^(.+?) invited you/)
        return {
            username: match ? match[1] : 'Player',
            fromUserId: notif.from_user_id || notif.user_id, // Use from_user_id if available, else fallback to user_id
        }
    }

    // Monitor database notifications for game_invite and game_invite_response
    useEffect(() => {
        clearTimeout(debounceTimerRef.current)

        debounceTimerRef.current = setTimeout(() => {
            const unreadNotifs = notifications.filter(n =>
                (n.type === 'game_invite_response' || n.type === 'game_invite') && !n.read && n.id != null
            )

            for (const notif of unreadNotifs) {
                if (processedIdsRef.current.has(notif.id)) {
                    continue
                }

                processedIdsRef.current.add(notif.id)
                const roomId = extractRoomId(notif.message)
                const senderInfo = parseSenderInfo(notif.message, notif)

                setVisibleNotification({
                    id: notif.id,
                    type: notif.type,
                    message: notif.message,
                    roomId,
                    senderUserId: senderInfo.fromUserId,
                    senderUsername: senderInfo.username,
                })

                break
            }
        }, 100)

        return () => clearTimeout(debounceTimerRef.current)
    }, [notifications])

    if (!visibleNotification) return null

    const isInvite = visibleNotification.type === 'game_invite'
    const isResponse = visibleNotification.type === 'game_invite_response'

    const handleAccept = async () => {
        setIsResponding(true)
        try {
            // Get the current notification from the live notifications array to ensure we have latest data
            const currentNotif = notifications.find(n => n.id === visibleNotification.id)
            const senderUserId = currentNotif?.from_user_id || currentNotif?.user_id

            const response = await apiCall('/api/users/game-invite/response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to_user_id: senderUserId,
                    status: 'accepted',
                    room_id: visibleNotification.roomId,
                }),
            })
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error('[GameInviteModal] Accept API error:', { status: response.status, error: errorData })
            } else {
                markRead(visibleNotification.id)
            }
            if (visibleNotification.roomId) {
                navigate(`/game/waiting/${visibleNotification.roomId}`)
            }
        } catch (error) {
            console.error('[GameInviteModal] Error accepting invite:', error)
        } finally {
            setIsResponding(false)
            setVisibleNotification(null)
        }
    }

    const handleDecline = async () => {
        setIsResponding(true)
        try {
            // Get the current notification from the live notifications array to ensure we have latest data
            const currentNotif = notifications.find(n => n.id === visibleNotification.id)
            const senderUserId = currentNotif?.from_user_id || currentNotif?.user_id

            const response = await apiCall('/api/users/game-invite/response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to_user_id: senderUserId,
                    status: 'declined',
                }),
            })
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error('[GameInviteModal] Decline API error:', { status: response.status, error: errorData })
            } else {
                markRead(visibleNotification.id)
            }
        } catch (error) {
            console.error('[GameInviteModal] Error declining invite:', error)
        } finally {
            setIsResponding(false)
            setVisibleNotification(null)
        }
    }

    const handleDismiss = () => {
        // Navigate to game if this is an accepted response with room_id
        if (isResponse && visibleNotification.roomId) {
            navigate(`/game/waiting/${visibleNotification.roomId}`)
        }

        // Mark as read
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
            aria-label={isInvite ? 'Game invite' : 'Game invite response'}
            tabIndex={-1}
        >
            <div className="game-invite-modal">
                <div className="game-invite-modal__content">
                    <h2 className="game-invite-modal__title">
                        {isInvite ? 'Match Invite' : 'Invite Response'}
                    </h2>
                    <p className="game-invite-modal__message">{visibleNotification.message}</p>
                </div>
                <div className="game-invite-modal__actions">
                    {isInvite ? (
                        <>
                            <button
                                type="button"
                                className="arcade-btn arcade-btn-primary game-invite-btn"
                                onClick={handleAccept}
                                disabled={isResponding}
                                autoFocus
                            >
                                {isResponding ? 'Accepting...' : 'Accept'}
                            </button>
                            <button
                                type="button"
                                className="arcade-btn arcade-btn-secondary game-invite-btn"
                                onClick={handleDecline}
                                disabled={isResponding}
                            >
                                {isResponding ? 'Declining...' : 'Decline'}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className="arcade-btn arcade-btn-secondary game-invite-btn"
                            onClick={handleDismiss}
                            autoFocus
                        >
                            OK
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

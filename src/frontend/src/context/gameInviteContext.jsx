import { createContext, useCallback, useContext, useState } from 'react'
import { apiCall } from '../utils/apiClient'
import { useNotifications } from './notificationContext'

const GameInviteContext = createContext(null)

export function GameInviteProvider({ children }) {
    const [activeInvite, setActiveInvite] = useState(null)
    const { markRead } = useNotifications()

    const respondToInvite = useCallback(async (status, onNavigate) => {
        if (!activeInvite) {
            console.warn('[gameInviteContext] No active invite to respond to')
            return
        }

        console.debug('[gameInviteContext] Responding to invite:', {
            activeInvite,
            status,
            payload: { to_user_id: activeInvite.fromUserId, status },
        })

        try {
            // Call the API to notify the inviter with authenticated request
            const body = {
                to_user_id: activeInvite.fromUserId,
                status,
            }

            // Include room_id for accepted responses so User A can navigate
            if (status === 'accepted' && activeInvite.roomId) {
                body.room_id = activeInvite.roomId
                console.debug('[gameInviteContext] Sending room_id:', body.room_id)
            } else {
                console.debug('[gameInviteContext] No room_id for status:', { status, roomId: activeInvite?.roomId })
            }

            console.debug('[gameInviteContext] Full request body:', body)
            console.debug('[gameInviteContext] Calling /api/users/game-invite/response with:', JSON.stringify(body))

            const response = await apiCall('/api/users/game-invite/response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            if (!response.ok) {
                const text = await response.text()
                console.error(
                    `[gameInviteContext] Failed to respond to invite: ${response.status}`,
                    text
                )
                return
            }

            console.debug('[gameInviteContext] Response endpoint returned successfully')

            // For accepted invites, navigate to waiting room
            if (status === 'accepted' && onNavigate) {
                onNavigate(activeInvite)
            }

            // Mark the notification as read
            if (activeInvite.notificationId) {
                markRead(activeInvite.notificationId)
            }

            setActiveInvite(null)
        } catch (error) {
            console.error('Error responding to invite:', error)
        }
    }, [activeInvite, markRead])

    const setGameInvite = useCallback((invite) => {
        setActiveInvite(invite)
    }, [])

    const clearGameInvite = useCallback(() => {
        setActiveInvite(null)
    }, [])

    const value = {
        activeInvite,
        setGameInvite,
        clearGameInvite,
        respondToInvite,
    }

    return (
        <GameInviteContext.Provider value={value}>
            {children}
        </GameInviteContext.Provider>
    )
}

export function useGameInvite() {
    const context = useContext(GameInviteContext)
    if (!context) {
        throw new Error('useGameInvite must be used within GameInviteProvider')
    }
    return context
}

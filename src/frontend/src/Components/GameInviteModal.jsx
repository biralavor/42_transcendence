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
  const { auth } = useAuth()
  const { notifications, markRead } = useNotifications()
  const navigate = useNavigate()

  const [visibleNotification, setVisibleNotification] = useState(null)
  const [isResponding, setIsResponding] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)

  const processedIdsRef = useRef(new Set())
  const debounceTimerRef = useRef(null)

  const extractRoomId = (message) => {
    if (!message) return null
    const match = message.match(/\[ROOM_ID:([^\]]+)\]/)
    return match ? match[1] : null
  }

  const extractTournamentId = (message) => {
    if (!message) return null
    const match = message.match(/\[TOURNAMENT_ID:(\d+)\]/)
    return match ? match[1] : null
  }

  const parseSenderInfo = (message, notif) => {
    const match = message.match(/^(.+?) invited you/)
    return {
      username: match ? match[1] : 'Player',
      fromUserId: notif.from_user_id || notif.user_id,
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadMe() {
      if (!auth?.access_token) {
        setCurrentUser(null)
        return
      }

      try {
        const response = await apiCall('/api/users/auth/me')
        if (!response.ok) {
          throw new Error(`Failed to load current user: ${response.status}`)
        }

        const me = await response.json()

        if (!cancelled) {
          setCurrentUser({
            id: me.id,
            username: me.username,
          })
        }
      } catch (error) {
        console.error('[GameInviteModal] Failed to resolve current user:', error)
        if (!cancelled) {
          setCurrentUser(null)
        }
      }
    }

    loadMe()

    return () => {
      cancelled = true
    }
  }, [auth?.access_token])

  useEffect(() => {
    clearTimeout(debounceTimerRef.current)

    debounceTimerRef.current = setTimeout(() => {
      const unreadNotifs = notifications.filter(
        (n) =>
          (['game_invite_response', 'game_invite', 'tournament_full', 'tournament_match_available', 'tournament_complete'].includes(n.type)) &&
          !n.read &&
          n.id != null,
      )

      for (const notif of unreadNotifs) {
        if (processedIdsRef.current.has(notif.id)) {
          continue
        }

        if (!notif.from_user_id) {
          console.error(
            '[GameInviteModal] Notification missing from_user_id, will not process:',
            notif,
          )
          processedIdsRef.current.add(notif.id)
          markRead(notif.id)
          continue
        }

        const roomId = extractRoomId(notif.message)
        const senderInfo = parseSenderInfo(notif.message, notif)

        setVisibleNotification({
          id: notif.id,
          type: notif.type,
          message: notif.message,
          roomId,
          tournamentId: extractTournamentId(notif.message),
          senderUserId: senderInfo.fromUserId,
          senderUsername: senderInfo.username,
          recipientUserId: notif.user_id,
        })
        setErrorMessage(null)
        break
      }
    }, 100)

    return () => clearTimeout(debounceTimerRef.current)
  }, [notifications, markRead])

  const buildWaitingRoomState = ({
    opponentId,
    opponentUsername,
    fallbackSelfId = null,
    fallbackSelfUsername = 'You',
  }) => {
    const selfId = currentUser?.id ?? fallbackSelfId
    const selfUsername = currentUser?.username || fallbackSelfUsername
    const selfNumericId = Number(selfId)
    const opponentNumericId = Number(opponentId)

    const hasValidIds =
      Number.isInteger(selfNumericId) && Number.isInteger(opponentNumericId)

    const [player1Id, player2Id] = hasValidIds
      ? selfNumericId <= opponentNumericId
        ? [selfNumericId, opponentNumericId]
        : [opponentNumericId, selfNumericId]
      : [null, null]

    return {
      ...(selfId != null && {
        currentUser: {
          id: hasValidIds ? selfNumericId : selfId,
          username: selfUsername,
        },
      }),
      opponent: {
        id: hasValidIds ? opponentNumericId : opponentId,
        username: opponentUsername,
      },
      friendId: hasValidIds ? opponentNumericId : opponentId,
      friendUsername: opponentUsername,
      player1_id: player1Id,
      player2_id: player2Id,
    }
  }

  if (!visibleNotification) return null

  const isInvite = visibleNotification.type === 'game_invite'
  const isResponse = visibleNotification.type === 'game_invite_response'
  const isTournamentNotice = ['tournament_full', 'tournament_match_available', 'tournament_complete'].includes(visibleNotification.type)

  const handleAccept = async () => {
    setIsResponding(true)
    setErrorMessage(null)

    try {
      const currentNotif = notifications.find((n) => n.id === visibleNotification.id)
      const senderUserId = currentNotif?.from_user_id

      if (!senderUserId) {
        console.error(
          '[GameInviteModal] Cannot accept: missing from_user_id in notification',
          currentNotif,
        )
        setErrorMessage('Error: Invalid invite data. Please try again or dismiss.')
        setIsResponding(false)
        return
      }

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
        console.error('[GameInviteModal] Accept API error:', {
          status: response.status,
          error: errorData,
        })
        setErrorMessage(`Failed to accept invite (${response.status}). Please try again.`)
        setIsResponding(false)
        return
      }

      markRead(visibleNotification.id)
      processedIdsRef.current.add(visibleNotification.id)

      const recipientUserId =
        currentNotif?.user_id ?? visibleNotification.recipientUserId

      if (visibleNotification.roomId) {
        navigate(`/game/waiting/${visibleNotification.roomId}`, {
          state: buildWaitingRoomState({
            opponentId: visibleNotification.senderUserId,
            opponentUsername: visibleNotification.senderUsername,
            fallbackSelfId: recipientUserId,
          }),
        })
      }

      setVisibleNotification(null)
      setErrorMessage(null)
      setIsResponding(false)
    } catch (error) {
      console.error('[GameInviteModal] Error accepting invite:', error)
      setErrorMessage('Network error. Please try again.')
      setIsResponding(false)
    }
  }

  const handleDecline = async () => {
    setIsResponding(true)
    setErrorMessage(null)

    try {
      const currentNotif = notifications.find((n) => n.id === visibleNotification.id)
      const senderUserId = currentNotif?.from_user_id

      if (!senderUserId) {
        console.error(
          '[GameInviteModal] Cannot decline: missing from_user_id in notification',
          currentNotif,
        )
        setErrorMessage('Error: Invalid invite data. Please try again or dismiss.')
        setIsResponding(false)
        return
      }

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
        console.error('[GameInviteModal] Decline API error:', {
          status: response.status,
          error: errorData,
        })
        setErrorMessage(`Failed to decline invite (${response.status}). Please try again.`)
        setIsResponding(false)
        return
      }

      markRead(visibleNotification.id)
      processedIdsRef.current.add(visibleNotification.id)

      setVisibleNotification(null)
      setErrorMessage(null)
      setIsResponding(false)
    } catch (error) {
      console.error('[GameInviteModal] Error declining invite:', error)
      setErrorMessage('Network error. Please try again.')
      setIsResponding(false)
    }
  }

  const handleDismiss = () => {
    if (visibleNotification.id) {
      markRead(visibleNotification.id)
      processedIdsRef.current.add(visibleNotification.id)
    }

    if (isResponse && visibleNotification.roomId) {
      const currentNotif = notifications.find((n) => n.id === visibleNotification.id)
      const recipientUserId =
        currentNotif?.user_id ?? visibleNotification.recipientUserId

      navigate(`/game/waiting/${visibleNotification.roomId}`, {
        state: buildWaitingRoomState({
          opponentId: visibleNotification.senderUserId,
          opponentUsername: visibleNotification.senderUsername,
          fallbackSelfId: recipientUserId,
        }),
      })
    }

    if (isTournamentNotice && visibleNotification.tournamentId) {
      navigate(`/tournaments/${visibleNotification.tournamentId}`)
    }

    setVisibleNotification(null)
    setErrorMessage(null)
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
            {isInvite ? 'Match Invite' : isResponse ? 'Invite Response' : 'Tournament Update'}
          </h2>
          <p className="game-invite-modal__message">{visibleNotification.message}</p>
          {errorMessage && (
            <p className="game-invite-modal__error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="game-invite-modal__actions">
          {errorMessage ? (
            <>
              <button
                type="button"
                className="arcade-btn arcade-btn-primary game-invite-btn"
                onClick={() => setErrorMessage('')}
              >
                Retry
              </button>
              <button
                type="button"
                className="arcade-btn arcade-btn-secondary game-invite-btn"
                onClick={() => {
                  setVisibleNotification(null)
                  setErrorMessage(null)
                }}
              >
                Close
              </button>
            </>
          ) : isInvite ? (
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

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './authContext'

const UnreadContext = createContext(null)

export function UnreadProvider({ children }) {
  const { auth } = useAuth()
  const [unreadCounts, setUnreadCounts] = useState({})
  // useRef so the WS onmessage handler always sees the latest value without being recreated
  const activeRoomRef = useRef(null)

  useEffect(() => {
    if (!auth.access_token) return

    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${scheme}//${window.location.host}/api/chat/ws/notifications?token=${auth.access_token}`
    const ws = new WebSocket(url)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_dm' && data.room_slug) {
          // Suppress increment if the user is already viewing this room
          if (activeRoomRef.current === data.room_slug) return
          setUnreadCounts(prev => ({
            ...prev,
            [data.room_slug]: (prev[data.room_slug] ?? 0) + 1,
          }))
        }
      } catch {
        // ignore non-JSON
      }
    }

    return () => {
      ws.close()
    }
  }, [auth.access_token])

  const clearUnread = useCallback((slug) => {
    setUnreadCounts(prev => {
      if (!(slug in prev)) return prev  // short-circuit: nothing to delete
      const next = { ...prev }
      delete next[slug]
      return next
    })
  }, [])

  const setActiveRoom = useCallback((slug) => {
    activeRoomRef.current = slug ?? null
  }, [])

  const value = useMemo(
    () => ({ unreadCounts, clearUnread, setActiveRoom }),
    [unreadCounts, clearUnread, setActiveRoom]
  )

  return (
    <UnreadContext.Provider value={value}>
      {children}
    </UnreadContext.Provider>
  )
}

export function useUnread() {
  const context = useContext(UnreadContext)
  if (context === null) throw new Error('useUnread must be used within UnreadProvider')
  return context
}

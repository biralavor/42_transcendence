import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './authContext'

const UnreadContext = createContext(null)

export function UnreadProvider({ children }) {
  const { auth } = useAuth()
  const [unreadCounts, setUnreadCounts] = useState({})

  useEffect(() => {
    if (!auth.access_token) return

    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${scheme}//${window.location.host}/api/chat/ws/notifications?token=${auth.access_token}`
    const ws = new WebSocket(url)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_dm' && data.room_slug) {
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

  function clearUnread(slug) {
    setUnreadCounts(prev => {
      const next = { ...prev }
      delete next[slug]
      return next
    })
  }

  return (
    <UnreadContext.Provider value={{ unreadCounts, clearUnread }}>
      {children}
    </UnreadContext.Provider>
  )
}

export function useUnread() {
  const context = useContext(UnreadContext)
  if (context === null) throw new Error('useUnread must be used within UnreadProvider')
  return context
}

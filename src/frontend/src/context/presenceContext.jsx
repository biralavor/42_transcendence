import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './authContext'

const PresenceContext = createContext(null)

export function PresenceProvider({ children }) {
  const { auth } = useAuth()
  const [presenceMap, setPresenceMap] = useState({})

  useEffect(() => {
    if (!auth.access_token) return

    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${scheme}//${window.location.host}/api/users/ws/presence?token=${auth.access_token}`
    const ws = new WebSocket(url)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'presence') {
          setPresenceMap(prev => ({ ...prev, [data.user_id]: data.status }))
        }
      } catch {
        // ignore non-JSON
      }
    }

    ws.onclose = () => {
      setPresenceMap({})
    }

    return () => {
      ws.close()
    }
  }, [auth.access_token])

  return (
    <PresenceContext.Provider value={presenceMap}>
      {children}
    </PresenceContext.Provider>
  )
}

export function usePresence() {
  const context = useContext(PresenceContext)
  if (context === null) throw new Error('usePresence must be used within a PresenceProvider')
  return context
}

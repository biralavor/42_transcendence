// src/frontend/src/pages/Chat.jsx
import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { createWsClient } from '../utils/wsClient'
import NavbarComponent from '../Components/Navbar'
import FriendsSidebar from '../Components/FriendsSidebar'
import UserProfileModal from '../Components/UserProfileModal'
import { useAuth } from '../context/authContext'
import { useUnread } from '../context/unreadContext'
import './Chat.css'

function senderHue(name) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

export default function Chat() {
  const { roomId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { auth } = useAuth()
  const { clearUnread } = useUnread()
  const autoName = location.state?.username ?? ''
  const passedUserId = location.state?.userId ?? null
  const [name, setName] = useState(autoName)
  const [joined, setJoined] = useState(!!autoName)
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [userId, setUserId] = useState(passedUserId)
  const [typingUsers, setTypingUsers] = useState([])
  const [profileTarget, setProfileTarget] = useState(null) // { username, userId? }
  const wsRef = useRef(null)
  const bottomRef = useRef(null)
  const typingTimers = useRef(new Map())
  const emitThrottle = useRef(null)

  // Fetch userId if not passed via navigation state (e.g. direct URL access)
  useEffect(() => {
    if (userId || !auth.access_token) return
    const controller = new AbortController()
    fetch('/api/users/auth/me', {
      headers: { Authorization: `Bearer ${auth.access_token}` },
      signal: controller.signal,
    })
      .then(r => r.ok ? r.json() : null)
      .then(me => { if (me) setUserId(me.id) })
      .catch((err) => { if (err.name !== 'AbortError') console.warn('Failed to fetch user identity for chat sidebar:', err) })
    return () => controller.abort()
  }, [auth.access_token, userId])

  // Clear unread count for this room whenever we enter it
  useEffect(() => {
    clearUnread(roomId)
  }, [roomId, clearUnread])

  function join(e) {
    e.preventDefault()
    if (!name.trim()) return
    setJoined(true)
  }

  useEffect(() => {
    if (!joined) return
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const base = `${scheme}//${window.location.host}/api/chat/ws/chat/${roomId}`
    const url = auth.access_token ? `${base}?token=${auth.access_token}` : base
    const ws = createWsClient(url, {
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onMessage: (data) => {
        if (data?.type === 'typing') {
          const sender = data.sender
          if (!sender) return
          const isSelf = (userId && data.sender_uid != null)
            ? data.sender_uid === userId
            : sender === name
          if (isSelf) return
          setTypingUsers(prev => prev.includes(sender) ? prev : [...prev, sender])
          clearTimeout(typingTimers.current.get(sender))
          typingTimers.current.set(
            sender,
            setTimeout(() => {
              setTypingUsers(prev => prev.filter(u => u !== sender))
              typingTimers.current.delete(sender)
            }, 2000)
          )
        } else {
          setMessages(prev => [...prev, data])
        }
      },
    })
    wsRef.current = ws
    return () => {
      ws.close()
      clearTimeout(emitThrottle.current)
      typingTimers.current.forEach(id => clearTimeout(id))
      typingTimers.current.clear()
      setTypingUsers([])
    }
  }, [joined, roomId])

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  function handleInputChange(e) {
    setInput(e.target.value)
    if (!connected || !wsRef.current || !e.target.value.trim()) return
    clearTimeout(emitThrottle.current)
    emitThrottle.current = setTimeout(() => {
      wsRef.current?.send({ type: 'typing', sender: name, sender_uid: userId })
    }, 300)
  }

  function send() {
    if (!input.trim() || !connected || !wsRef.current) return
    wsRef.current.send({ content: input.trim(), sender: name })
    setInput('')
  }

  function handleChatFromModal(targetUserId) {
    if (!userId) return
    const [a, b] = [userId, targetUserId].sort((x, y) => x - y)
    setProfileTarget(null)
    navigate(`/chat/DM-${a}-${b}`, { state: { username: name, userId } })
  }

  // ── Name form ─────────────────────────────────────────────────────────────
  if (!joined) {
    return (
      <>
        <NavbarComponent />
        <div className="container py-5 chat-join">
          <h2 className="mb-4">Join Room: <code>{roomId}</code></h2>
          <form onSubmit={join}>
            <div className="mb-3">
              <input className="form-control" placeholder="Your name" aria-label="Your name"
                value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <button className="btn btn-primary w-100" type="submit">Join</button>
          </form>
        </div>
      </>
    )
  }

  // ── Chat view ─────────────────────────────────────────────────────────────
  return (
    <>
      <NavbarComponent />
      <div className="chat-layout">
        {userId && (
          <FriendsSidebar
            userId={userId}
            username={name}
            onViewProfile={(uname, uid) => setProfileTarget({ username: uname, userId: uid ?? null })}
          />
        )}
        <div className="container py-4 chat-view">
          <div className="d-flex align-items-center gap-2 mb-3">
            <h2 className="mb-0">Room: <code>{roomId}</code></h2>
            <span className={`badge ${connected ? 'bg-success' : 'bg-danger'}`}>
              {connected ? 'Connected' : 'Connecting…'}
            </span>
          </div>
          <div className="border rounded p-3 mb-3 bg-light chat-messages">
            {messages.length === 0 && (
              <p className="text-muted text-center mt-5">No messages yet. Say hello!</p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className="mb-2 chat-msg" style={{ '--sender-hue': senderHue(msg.sender ?? 'anon') }}>
                <button
                  className="chat-sender-btn"
                  onClick={() => setProfileTarget({ username: msg.sender ?? 'anon', userId: null })}
                >
                  {msg.sender ?? 'anon'}
                </button>
                {': '}
                <span>{msg.content}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="chat-typing">
            {typingUsers.length === 1 && `${typingUsers[0]} is typing…`}
            {typingUsers.length === 2 && `${typingUsers[0]} and ${typingUsers[1]} are typing…`}
            {typingUsers.length > 2 && 'Several people are typing…'}
          </div>
          <div className="input-group">
            <input className="form-control" placeholder="Type a message…" aria-label="Type a message"
              value={input} onChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && send()} disabled={!connected} autoFocus />
            <button className="btn btn-primary" onClick={send} disabled={!connected}>Send</button>
          </div>
          <p className="text-muted mt-2 chat-share-url">
            Share this URL to invite others:{' '}
            <code>{window.location.href.replace(window.location.hostname, import.meta.env.VITE_DOMAIN || window.location.hostname)}</code>
          </p>
        </div>
      </div>

      {profileTarget && (
        <UserProfileModal
          username={profileTarget.username}
          userId={profileTarget.userId}
          currentUserId={userId}
          onClose={() => setProfileTarget(null)}
          onChat={handleChatFromModal}
        />
      )}
    </>
  )
}

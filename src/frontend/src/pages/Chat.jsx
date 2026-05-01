// src/frontend/src/pages/Chat.jsx
import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { createWsClient } from '../utils/wsClient'
import NavbarComponent from '../Components/Navbar'
import FriendsSidebar from '../Components/FriendsSidebar'
import LobbyPanel from '../Components/LobbyPanel'
import UserProfileModal from '../Components/UserProfileModal'
import { useAuth } from '../context/authContext'
import { useUnread } from '../context/unreadContext'
import { useUser } from '../context/userContext'
import './Chat.css'

function senderHue(name) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

export default function Chat() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, token } = useUser()
  const { clearUnread, setActiveRoom } = useUnread()
  const [joined, setJoined] = useState(!!user)
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typingUsers, setTypingUsers] = useState([])
  const [profileTarget, setProfileTarget] = useState(null)
  const wsRef = useRef(null)
  const bottomRef = useRef(null)
  const typingTimers = useRef(new Map())
  const emitThrottle = useRef(null)

  useEffect(() => {
    // Clear room messages when changing room
    setMessages([])
    setTypingUsers([])
  }, [roomId])

  // Mark room as active (suppresses badge increments) and clear any existing count
  useEffect(() => {
    if (!roomId) return
    setActiveRoom(roomId)
    clearUnread(roomId)
    return () => setActiveRoom(null)
  }, [roomId, clearUnread, setActiveRoom])

  useEffect(() => {
    if (!joined || !roomId) return
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const base = `${scheme}//${window.location.host}/api/chat/ws/chat/${roomId}`
    const url = token ? `${base}?token=${token}` : base
    const ws = createWsClient(url, {
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onMessage: data => {
        if (data?.type === 'typing') {
          const sender = data.sender
          if (!sender) return
          const isSelf =
            user && data.sender_uid != null
              && data.sender_uid === user.id
          if (isSelf) return
          setTypingUsers(prev => (prev.includes(sender) ? prev : [...prev, sender]))
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

  // Auto-join once identity is known — covers nav-state entry AND direct URL / refresh
  useEffect(() => {
    if (user && roomId) setJoined(true)
  }, [user, roomId])

  // Safety-net redirect: auth fully loaded, no token, still no identity → go to lobby
  // (PrivateRoute normally handles unauthenticated users before reaching here)
  useEffect(() => {
    if (roomId && !joined && !token) {
      navigate('/chat', { replace: true })
    }
  }, [roomId, joined, token, navigate])

  function handleInputChange(e) {
    setInput(e.target.value)
    if (!connected || !wsRef.current || !e.target.value.trim() || !user) return
    clearTimeout(emitThrottle.current)
    emitThrottle.current = setTimeout(() => {
      wsRef.current?.send({ type: 'typing', sender: user.username, sender_uid: user.id })
    }, 300)
  }

  function send() {
    if (!input.trim() || !connected || !wsRef.current) return
    wsRef.current.send({ content: input.trim(), sender: user.username })
    setInput('')
  }

  function handleChatFromModal(targetUserId) {
    if (!user) return
    const [a, b] = [user.id, targetUserId].sort((x, y) => x - y)
    setProfileTarget(null)
    navigate(`/chat/DM-${a}-${b}`, { state: { username: user.username, userId: user.id } })
  }

  function handleEnterRoom(slug) {
    if (!user) return  // auth/me fetch not yet resolved — LobbyPanel disables buttons when username is empty
    navigate(`/chat/${slug}`, { state: { username: user.username, userId: user.id } })
  }

  // ── Lobby view (no roomId) ────────────────────────────────────────────────
  if (!roomId) {
    return (
      <>
        <NavbarComponent />
        <div className="chat-layout">
          {user && (
            <FriendsSidebar
              userId={user.id}
              username={user.username}
              onViewProfile={(uname, uid) =>
                setProfileTarget({ username: uname, userId: uid ?? null })
              }
            />
          )}
          <LobbyPanel
            compact={false}
            onEnter={handleEnterRoom}
            username={user.username}
            token={token}
          />
        </div>
        {profileTarget && user && (
          <UserProfileModal
            username={profileTarget.username}
            userId={profileTarget.userId}
            currentUserId={user.id}
            onClose={() => setProfileTarget(null)}
            onChat={handleChatFromModal}
          />
        )}
      </>
    )
  }

  // ── Direct URL access: wait for effect to redirect ───────────────────────
  if (roomId && !joined) return null

  // ── Room view ─────────────────────────────────────────────────────────────
  return (
    <>
      <NavbarComponent />
      <div className="chat-layout">
        {user && (
          <FriendsSidebar
            userId={user.id}
            username={user.username}
            onViewProfile={(uname, uid) =>
              setProfileTarget({ username: uname, userId: uid ?? null })
            }
          />
        )}
        <div className="container py-4 chat-view">
          <div className="d-flex align-items-center gap-2 mb-3">
            <Link to="/chat" className="chat-lobby-back">
              ← Lobby
            </Link>
            <h2 className="mb-0">
              Room: <code>{roomId}</code>
            </h2>
            <span className={`badge ${connected ? 'bg-success' : 'bg-danger'}`}>
              {connected ? 'Connected' : 'Connecting…'}
            </span>
          </div>
          <div className="border rounded p-3 mb-3 bg-light chat-messages">
            {messages.length === 0 && (
              <p className="text-muted text-center mt-5">No messages yet. Say hello!</p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className="mb-2 chat-msg"
                style={{ '--sender-hue': senderHue(msg.sender ?? 'anon') }}
              >
                <button
                  className="chat-sender-btn"
                  onClick={() =>
                    setProfileTarget({ username: msg.sender ?? 'anon', userId: null })
                  }
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
            {typingUsers.length === 2 &&
              `${typingUsers[0]} and ${typingUsers[1]} are typing…`}
            {typingUsers.length > 2 && 'Several people are typing…'}
          </div>
          <div className="input-group">
            <input
              className="form-control"
              placeholder="Type a message…"
              aria-label="Type a message"
              value={input}
              onChange={handleInputChange}
              onKeyDown={e => e.key === 'Enter' && send()}
              disabled={!connected}
              autoFocus
            />
            <button
              className="btn btn-primary"
              onClick={send}
              disabled={!connected}
            >
              Send
            </button>
          </div>
          <p className="text-muted mt-2 chat-share-url">
            Share this URL to invite others:{' '}
            <code>
              {window.location.href.replace(
                window.location.hostname,
                import.meta.env.VITE_DOMAIN || window.location.hostname
              )}
            </code>
          </p>
        </div>
        <LobbyPanel
          compact={true}
          onEnter={handleEnterRoom}
          username={user.username}
          token={token}
        />
      </div>

      {profileTarget && (
        <UserProfileModal
          username={profileTarget.username}
          userId={profileTarget.userId}
          currentUserId={user.id}
          onClose={() => setProfileTarget(null)}
          onChat={handleChatFromModal}
        />
      )}
    </>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { createWsClient } from '../utils/wsClient'
import NavbarComponent from '../Components/Navbar'
import './Chat.css'

function senderHue(name) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

export default function Chat() {
  const { roomId } = useParams()
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const wsRef = useRef(null)
  const bottomRef = useRef(null)

  function join(e) {
    e.preventDefault()
    if (!name.trim()) return
    setJoined(true)
  }

  useEffect(() => {
    if (!joined) return

    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${scheme}//${window.location.host}/api/chat/ws/chat/${roomId}`
    const ws = createWsClient(url, {
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onMessage: (data) => setMessages((prev) => [...prev, data]),
    })
    wsRef.current = ws
    return () => ws.close()
  }, [joined, roomId])

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  function send() {
    if (!input.trim() || !connected || !wsRef.current) return
    wsRef.current.send({ content: input.trim(), sender: name })
    setInput('')
  }

  // ── Name form ─────────────────────────────────────────────────────────────
  if (!joined) {
    return (
      <>
        <NavbarComponent />
        <div className="container py-5 chat-join">
          <h2 className="mb-4">
            Join Room: <code>{roomId}</code>
          </h2>
          <form onSubmit={join}>
            <div className="mb-3">
              <input
                className="form-control"
                placeholder="Your name"
                aria-label="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <button className="btn btn-primary w-100" type="submit">
              Join
            </button>
          </form>
        </div>
      </>
    )
  }

  // ── Chat view ─────────────────────────────────────────────────────────────
  return (
    <>
      <NavbarComponent />
      <div className="container py-4 chat-view">
        <div className="d-flex align-items-center gap-2 mb-3">
          <h2 className="mb-0">
            Room: <code>{roomId}</code>
          </h2>
          <span className={`badge ${connected ? 'bg-success' : 'bg-danger'}`}>
            {connected ? 'Connected' : 'Connecting…'}
          </span>
        </div>

        <div
          className="border rounded p-3 mb-3 bg-light chat-messages"
        >
          {messages.length === 0 && (
            <p className="text-muted text-center mt-5">No messages yet. Say hello!</p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className="mb-2 chat-msg" style={{ '--sender-hue': senderHue(msg.sender ?? 'anon') }}>
              <strong>{msg.sender ?? 'anon'}:</strong>{' '}
              <span>{msg.content}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="input-group">
          <input
            className="form-control"
            placeholder="Type a message…"
            aria-label="Type a message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            disabled={!connected}
            autoFocus
          />
          <button className="btn btn-primary" onClick={send} disabled={!connected}>
            Send
          </button>
        </div>

        <p className="text-muted mt-2 chat-share-url">
          Share this URL to invite others: <code>{window.location.href}</code>
        </p>
      </div>
    </>
  )
}

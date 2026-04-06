import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { resetInactivityTimer, ACTIVITY_EVENTS, ACTIVITY_DEBOUNCE_SECONDS } from './utils/inactivityTracker'
import Home from './pages/Home'
import Login from './pages/Login'
import About from './pages/About'
import Play from './pages/Play'
import Leaderboard from './pages/Leaderboard'
import Register from './pages/Register'
import Profile from './pages/Profile'
import ForgotPassword from './pages/ForgotPassword'
import Chat from './pages/Chat'
import PongCanvas from './Components/PongCanvas'
import PrivateRoute from './Components/PrivateRoute'
import GameWaitingRoom from './pages/GameWaitingRoom'
import GamePage from './pages/GamePage'

export default function App() {
  useEffect(() => {
    let lastResetTime = 0

    const handleActivity = () => {
      const now = Date.now()
      if (now - lastResetTime >= ACTIVITY_DEBOUNCE_SECONDS * 1000) {
        resetInactivityTimer(false)
        lastResetTime = now
      }
    }

    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { capture: true, passive: true })
    })

    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity, { capture: true, passive: true })
      })
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/about" element={<About />} />
        <Route path="/play" element={<Play />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pong-develop" element={<PongCanvas
          player1Kind='local'
          player2Kind='remote-ai' />} />

        <Route
          path="/profile"
          element={(
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          )}
        />

        <Route
          path="/chat"
          element={(
            <PrivateRoute>
              <Chat />
            </PrivateRoute>
          )}
        />

        <Route
          path="/chat/:roomId"
          element={(
            <PrivateRoute>
              <Chat />
            </PrivateRoute>
          )}
        />

        <Route
          path="/game/waiting/:roomId"
          element={(
            <PrivateRoute>
              <GameWaitingRoom />
            </PrivateRoute>
          )}
        />

        <Route
          path="/game/:roomId"
          element={(
            <PrivateRoute>
              <GamePage />
            </PrivateRoute>
          )}
        />

        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>
    </BrowserRouter>
  )
}

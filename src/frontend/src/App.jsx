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
import GamesLive from './pages/GamesLive'
import Chat from './pages/Chat'
import PongCanvas from './Components/PongCanvas'
import PrivateRoute from './Components/PrivateRoute'
import GameWaitingRoom from './pages/GameWaitingRoom'
import GamePage from './pages/GamePage'
import GameInviteModal from './Components/GameInviteModal'
import Tournament from './pages/Tournament'
import Tournaments from './pages/Tournaments'
import Search from './pages/Search'

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
        <Route path="/games/live" element={<GamesLive />} />
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
          path="/profile/:profileUserId"
          element={(
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          )}
        />

        <Route
          path="/search"
          element={(
            <PrivateRoute>
              <Search />
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

        {/* /game/:roomId is public so spectators (?spectate=true) can reach it.
            GamePage redirects non-spectators without auth to /login internally. */}
        <Route path="/game/:roomId" element={<GamePage />} />

        <Route path="/tournaments/:id" element={<Tournament />} />

        {/* Tournaments list and creation - authenticated users only */}
        <Route
          path="/tournaments"
          element={(
            <PrivateRoute>
              <Tournaments />
            </PrivateRoute>
          )}
        />

        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>
      <GameInviteModal />
    </BrowserRouter>
  )
}

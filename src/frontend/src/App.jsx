import { BrowserRouter, Routes, Route } from 'react-router-dom'
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

export default function App() {
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
          path="/chat/:roomId"
          element={(
            <PrivateRoute>
              <Chat />
            </PrivateRoute>
          )}
        />

        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>
    </BrowserRouter>
  )
}

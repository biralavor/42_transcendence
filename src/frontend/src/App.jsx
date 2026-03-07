import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import About from './pages/About'
import Play from './pages/Play'
import Leaderboard from './pages/Leaderboard'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'


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
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>
    </BrowserRouter>
  )
}

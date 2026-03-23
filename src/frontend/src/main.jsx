import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './theme/fonts.css'
import './theme/theme.css'
import './theme/index.css'
import './theme/arcade.css'
import './theme/leaderboard.css'
import './theme/about.css'
import App from './App'
import { AuthProvider } from './context/authContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
)

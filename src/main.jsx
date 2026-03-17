import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AuthProvider } from './lib/AuthContext.jsx'
import App from './App.jsx'

// Clean up any legacy data; all app data is now in Firebase (Firestore / Storage).
localStorage.clear()

// Default theme until Auth + Firestore load user settings
document.documentElement.setAttribute('data-theme', 'dark')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

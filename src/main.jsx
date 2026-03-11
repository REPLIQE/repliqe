import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

let savedTheme = localStorage.getItem('theme') || 'dark'
if (savedTheme === 'light-bone') {
  savedTheme = 'bone'
  localStorage.setItem('theme', 'bone')
}
document.documentElement.setAttribute('data-theme', savedTheme)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

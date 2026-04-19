import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar'
import './index.css'
import { initPortraitOrientationLock } from './orientationPortrait.js'
import { AuthProvider } from './lib/AuthContext.jsx'
import { ensureSocialLoginInitialized } from './lib/auth'
import App from './App.jsx'

const isNative = Capacitor.isNativePlatform()

initPortraitOrientationLock()

// Clean up any legacy web data; all app data is now in Firebase. Skip on native: would wipe Auth's cached session every launch.
if (!isNative) localStorage.clear()

// Native: warm up Google/Apple sign-in plugin so the first tap is instant. Errors are logged but non-fatal — the helpers retry on demand.
if (isNative) ensureSocialLoginInitialized().catch((err) => console.error('SocialLogin.initialize:', err))

// Native status bar: opaque dark bar with light glyphs. Overlay=false so the WKWebView starts below the Dynamic Island/notch.
if (isNative) {
  // Style.Dark = light icons (designed for dark backgrounds); Style.Light = dark icons.
  StatusBar.setStyle({ style: StatusBarStyle.Dark }).catch((err) => console.error('StatusBar.setStyle:', err))
  StatusBar.setOverlaysWebView({ overlay: false }).catch((err) => console.error('StatusBar.setOverlaysWebView:', err))
  if (Capacitor.getPlatform() === 'android') {
    StatusBar.setBackgroundColor({ color: '#0D0D1A' }).catch((err) => console.error('StatusBar.setBackgroundColor:', err))
  }
}

// Default theme until Auth + Firestore load user settings
document.documentElement.setAttribute('data-theme', 'dark')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

// Brand splash (inline SVG in index.html) covers the WebView until React's first paint is settled.
// Held for ~1s after script execution, then fades over 250ms. The native plugin splash is configured
// to dismiss after ~500ms (capacitor.config.ts) so the handoff goes:
//   system splash -> plugin splash (brief) -> brand splash (full composition) -> app
// On web/PWA the same brand splash appears as soon as HTML parses.
{
  const SPLASH_MIN_VISIBLE_MS = 1000
  const SPLASH_FADE_MS = 250
  const dismissBrandSplash = () => {
    const el = document.getElementById('brand-splash')
    if (!el || el.dataset.hiding === '1') return
    el.dataset.hiding = '1'
    el.classList.add('is-hiding')
    setTimeout(() => el.remove(), SPLASH_FADE_MS + 50)
  }
  // requestAnimationFrame defers to after React's first paint commits, then we hold for SPLASH_MIN_VISIBLE_MS.
  requestAnimationFrame(() => {
    setTimeout(dismissBrandSplash, SPLASH_MIN_VISIBLE_MS)
  })
}

// Production web only: register updated SW (network-first). Skipped on native — Capacitor's WebView handles caching and SW interferes.
if (import.meta.env.PROD && !isNative && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

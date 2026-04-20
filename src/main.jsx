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

// Native status bar: opaque dark bar with light glyphs. Glyph style + bg color are reapplied here
// as a safety net once the bridge is up; the *primary* configuration happens at native init time
// from capacitor.config.ts (StatusBar.overlaysWebView/style/backgroundColor) plus the Android-side
// MainActivity.onCreate override + styles.xml entries.
//
// IMPORTANT: do NOT call StatusBar.setOverlaysWebView() from JS here. It is already set to false
// at native init via capacitor.config.ts. Calling it again from JS clears FLAG_LAYOUT_NO_LIMITS
// at runtime which triggers a WebView resize (full-screen edge-to-edge -> between-bars). That
// resize re-centers everything inside `position: fixed; inset: 0` and was the visible "jump" of
// the brand splash icon during boot. Setting style / backgroundColor here is safe — they only
// change appearance attributes and do not cause a layout pass.
if (isNative) {
  // Style.Dark = light icons (designed for dark backgrounds); Style.Light = dark icons.
  StatusBar.setStyle({ style: StatusBarStyle.Dark }).catch((err) => console.error('StatusBar.setStyle:', err))
  if (Capacitor.getPlatform() === 'android') {
    // setBackgroundColor is Android-only; on iOS it throws — guard via the platform check above.
    // No-op on API 36+ where statusBarColor is deprecated under forced edge-to-edge, but harmless.
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

// Brand splash dismissal.
//
// The splash element (#brand-splash, inline SVG in index.html) is shown as soon as the WebView
// parses the HTML. Dismissal is driven by AuthContext.jsx which calls window.__dismissBrandSplash
// the moment Firebase Auth's onAuthStateChanged resolves the persisted session — that is the
// "app knows what to render next" signal. AuthContext also waits two animation frames before
// calling, so React has actually painted the post-loading screen (login or AppContent) before
// the splash starts to fade. Without that, the user sees the splash dissolve into a half-painted
// or blank frame on slower Android devices.
//
// Two guard rails:
//   - SPLASH_MIN_VISIBLE_MS (1500ms after .is-stable is set) so a near-instant auth resolve
//     doesn't make the brand flash by. Measured from when the user first SAW the splash (not
//     from script execution time) because the visibility gate in index.html may have delayed
//     the first paint by up to 200ms. 1500ms is the comfortable lower bound for "I noticed
//     the brand and registered the logo" per Material Design splash guidance.
//   - SPLASH_SAFETY_CAP_MS (10s after script execution) so a network-stalled auth or a missing
//     dismiss call never traps the user on the splash forever. After this point we force
//     dismissal even if AuthContext hasn't fired.
{
  const SPLASH_MIN_VISIBLE_MS = 1500
  const SPLASH_FADE_MS = 250
  const SPLASH_SAFETY_CAP_MS = 10000
  const scriptStartedAt = Date.now()

  let dismissed = false
  const performDismiss = () => {
    const el = document.getElementById('brand-splash')
    if (!el) return
    el.classList.add('is-hiding')
    setTimeout(() => el.remove(), SPLASH_FADE_MS + 50)
  }

  const dismissBrandSplash = () => {
    if (dismissed) return
    dismissed = true
    const stableAt = window.__brandSplashStableAt || scriptStartedAt
    const minVisibleUntil = stableAt + SPLASH_MIN_VISIBLE_MS
    const wait = Math.max(0, minVisibleUntil - Date.now())
    setTimeout(performDismiss, wait)
  }

  window.__dismissBrandSplash = dismissBrandSplash
  setTimeout(dismissBrandSplash, SPLASH_SAFETY_CAP_MS)
}

// Production web only: register updated SW (network-first). Skipped on native — Capacitor's WebView handles caching and SW interferes.
if (import.meta.env.PROD && !isNative && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

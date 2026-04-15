/**
 * Prefer portrait: Screen Orientation API where allowed (often needs user gesture on mobile Chrome).
 * PWA manifest + CSS fallback in index.css handle the rest.
 */
export function initPortraitOrientationLock() {
  if (typeof window === 'undefined' || typeof screen === 'undefined') return

  function tryLock() {
    try {
      const o = screen.orientation
      if (o && typeof o.lock === 'function') {
        void o.lock('portrait').catch(() => {})
      }
    } catch {
      /* unsupported */
    }
  }

  tryLock()

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryLock()
  })

  const once = () => {
    tryLock()
    window.removeEventListener('click', once)
    window.removeEventListener('touchend', once, true)
  }
  window.addEventListener('click', once, { passive: true })
  window.addEventListener('touchend', once, { passive: true, capture: true })
}

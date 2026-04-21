/* Bump CACHE_NAME after each deploy so clients drop stale HTML/JS (cache-first was blocking updates). */
const CACHE_NAME = 'repliqe-pwa-v8'

/* Pre-cached on install so offline launches still get the app icon, favicons, and Add-to-Home-Screen splash assets. */
const PRECACHE_URLS = [
  '/manifest.json',
  '/icon.svg',
  '/favicon-16.png',
  '/favicon-32.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icons/apple-splash-2048-2732@2x.png',
  '/icons/apple-splash-1668-2388@2x.png',
  '/icons/apple-splash-1668-2224@2x.png',
  '/icons/apple-splash-1620-2160@2x.png',
  '/icons/apple-splash-1536-2048@2x.png',
  '/icons/apple-splash-1284-2778@3x.png',
  '/icons/apple-splash-1242-2688@3x.png',
  '/icons/apple-splash-1170-2532@3x.png',
  '/icons/apple-splash-1125-2436@3x.png',
  '/icons/apple-splash-828-1792@2x.png',
  '/icons/apple-splash-750-1334@2x.png',
  '/icons/apple-splash-640-1136@2x.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      // addAll is atomic; tolerate individual misses so a stale ref doesn't kill install.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => console.warn('[sw] precache miss:', url, err)),
        ),
      )
    })(),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  // Prefer network so new builds load; offline falls back to cache if present
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
    )
    return
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})

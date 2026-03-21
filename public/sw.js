/* Bump CACHE_NAME after each deploy so clients drop stale HTML/JS (cache-first was blocking updates). */
const CACHE_NAME = 'repliqe-pwa-v3'

self.addEventListener('install', () => {
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

// T'asPrisCombien — service worker minimal
// Stratégie:
//   - /api/*  → network-first (frais, fallback cache si offline)
//   - assets statiques (_next/static, fonts, /icon*) → cache-first
//   - HTML / autres → network-first avec fallback cache

const CACHE_VERSION = 'tpc-v3'
const RUNTIME = 'tpc-runtime-v3'
const PRECACHE_URLS = ['/']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((c) => c.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION && k !== RUNTIME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

const STATIC_PATTERN = /\/_next\/static\/|\.(?:woff2?|ttf|otf|css|js|svg|png|jpg|jpeg|webp|ico)$/

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // API → network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(req))
    return
  }

  // Static assets / icons → cache-first
  if (STATIC_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirst(req))
    return
  }

  // HTML & rest → network-first with cache fallback
  event.respondWith(networkFirst(req))
})

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME)
  const cached = await cache.match(req)
  if (cached) return cached
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch (e) {
    return cached || Response.error()
  }
}

async function networkFirst(req) {
  const cache = await caches.open(RUNTIME)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(req, res.clone())
    return res
  } catch (e) {
    const cached = await cache.match(req)
    if (cached) return cached
    if (req.mode === 'navigate') {
      const fallback = await cache.match('/')
      if (fallback) return fallback
    }
    throw e
  }
}

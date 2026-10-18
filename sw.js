// Bump VERSION on every deploy so phones pick up the new page.
const VERSION = 'rt-v1';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'];
const TILE_CACHE = 'rt-tiles';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== TILE_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Page itself: network first (so updates arrive), fall back to cache when offline
  if (req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', cp)); return r; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  // Leaflet + own static files: cache first
  if (url.hostname === 'cdnjs.cloudflare.com' || url.origin === location.origin) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const cp = res.clone(); caches.open(VERSION).then(c => c.put(req, cp)); return res; })));
    return;
  }
  // Map tiles: keep tiles you've already viewed, for spots with no signal
  if (/tile\.openstreetmap\.org|tile\.opentopomap\.org/.test(url.hostname)) {
    e.respondWith(caches.open(TILE_CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; });
      return hit || net;
    })));
  }
});

/* ThermiGraph PWA service worker v28.6 - cache-first for app shell, network-first for live weather */
/* v28.3: cache name bumped from v28.5 so the browser drops the old
   cached app shell (which hid the tour bar and kept the English
   WBGT formula) and fetches the fixed files. */
const CACHE = 'thermigraph-v28.7';
const SHELL = ['./', './index.html', './app.js', './logic.js', './styles.css', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './og-image.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('open-meteo.com')) {
    e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (e.request.method === 'GET' && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; }).catch(() => caches.match('./index.html'))));
});

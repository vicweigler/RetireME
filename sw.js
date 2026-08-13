const CACHE = 'retireme-v5';
const ASSETS = ['./', './index.html', './icon.png', './apple-touch-icon.png', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for the HTML document so updates always come through
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(new Request(e.request.url, {cache: 'reload', credentials: 'include'}))
        .then(r => { const cl = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cl)); return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  // Cache-first for all other assets
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'PURGE_CACHES') {
    e.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
    );
    return;
  }
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

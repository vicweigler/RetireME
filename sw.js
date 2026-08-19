const CACHE = 'retireme-v58';
// Exclude HTML from pre-cache so the navigate handler always serves it fresh.
const ASSETS = ['./icon.png', './apple-touch-icon.png', './manifest.json'];

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
    // Append SW version to URL so every deploy busts the CDN cache.
    const navUrl = new URL(e.request.url);
    navUrl.searchParams.set('_v', CACHE);
    e.respondWith(
      fetch(navUrl.toString(), {cache: 'no-store', credentials: 'include'})
        .catch(() => caches.match(e.request))
    );
    return;
  }
  // For app shell assets, prefer network first so new versions land immediately.
  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isAppShell = isSameOrigin && (
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/manifest.json') ||
    url.pathname.endsWith('/icon.png') ||
    url.pathname.endsWith('/apple-touch-icon.png') ||
    url.pathname.endsWith('/tabbar-react.js') ||
    url.pathname.endsWith('/tabbar.js')
  );
  if (isAppShell) {
    e.respondWith(
      fetch(new Request(e.request.url, {cache: 'no-store', credentials: 'include'}))
        .then(r => { const cl = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cl)); return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  // Cache-first fallback for everything else.
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

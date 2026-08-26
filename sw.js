const CACHE_NAME = 'ielts-ai-master-v2';
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(['/', '/index.html', '/manifest.json'])));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/') || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const cl = r.clone();
      caches.open(CACHE_NAME).then((c) => c.put(e.request, cl));
      return r;
    }).catch(() => caches.match(e.request).then((c) => c || caches.match('/index.html')))
  );
});
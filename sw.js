const CACHE_NAME = 'ielts-ai-master-v3';
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  // API chaqiruvlarini keshlama
  if (e.request.url.includes('/api/')) return;
  // Har doim tarmoqdan ol (network-first), oflayn bo'lsa keshdan
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
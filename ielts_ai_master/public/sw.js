const CACHE_NAME = 'ielts-ai-master-v10';
const ASSETS = [
  './',
  'css/app.css?v=10.0',
  'js/app.js?v=10.0',
  'js/article.js?v=10.0',
  'js/podcast.js?v=10.0',
  'js/dictation.js?v=10.0',
  'js/vocabulary.js?v=10.0',
  'js/mistakes.js?v=10.0',
  'js/sentences.js?v=10.0',
  'js/study_plan.js?v=10.0',
  'js/settings.js?v=10.0',
  'js/bug_fixer.js?v=10.0',
  'js/coach.js?v=10.0'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => {
        if (k !== CACHE_NAME) return caches.delete(k);
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
  } else {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});

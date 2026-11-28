self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Оставляем сетевой поток браузера без перехвата, чтобы авторизация и оценки всегда были актуальными
});
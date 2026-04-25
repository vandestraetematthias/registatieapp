/* ══════════════════════════════════════════
   BUURTWERK VENNING — Service Worker
   Cache-first strategie voor offline gebruik
══════════════════════════════════════════ */

var CACHE_NAAM = 'buurtwerk-v2.9.6';
var CACHE_BESTANDEN = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
  './logo app/logo app.jpg',
  './logo app/logo app.png',
  './achtergrond foto.jpeg'
];

// Installeer: cache alle lokale bestanden
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAAM).then(function(cache) {
      return cache.addAll(CACHE_BESTANDEN);
    })
  );
  self.skipWaiting();
});

// Activeer: verwijder oude caches en neem onmiddellijk controle
self.addEventListener('activate', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.keys().then(function(namen) {
      return Promise.all(
        namen.filter(function(naam) { return naam !== CACHE_NAAM; })
             .map(function(naam) { return caches.delete(naam); })
      );
    })
  );
  self.clients.claim();
});

// Ontvang SKIP_WAITING bericht van client om onmiddellijk te activeren
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: cache-first voor lokale bestanden, network-first voor externe CDN
self.addEventListener('fetch', function(event) {
  var url = event.request.url;
  // Externe CDN-verzoeken: altijd via netwerk proberen
  if (url.indexOf('fonts.googleapis') !== -1 ||
      url.indexOf('unpkg.com') !== -1 ||
      url.indexOf('cdnjs.cloudflare.com') !== -1 ||
      url.indexOf('gstatic.com') !== -1 ||
      url.indexOf('firebaseio.com') !== -1 ||
      url.indexOf('googleapis.com') !== -1) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }
  // Lokale bestanden: cache-first
  event.respondWith(
    caches.match(event.request).then(function(gecached) {
      return gecached || fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var kopie = response.clone();
          caches.open(CACHE_NAAM).then(function(cache) {
            cache.put(event.request, kopie);
          });
        }
        return response;
      });
    })
  );
});

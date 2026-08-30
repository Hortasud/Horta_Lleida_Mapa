/* Servei fora de línia de la PWA. Incrementa aquesta versió quan es publiqui
   una actualització important del projecte. */
const CACHE_NAME = 'mapa-horta-shell-v3';
const APP_SHELL = [
  './', './index.html', './mapa.html', './guia.html', './app.css',
  './app-shell.js', './manifest.webmanifest', './icons/icon.svg',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(caches.open(CACHE_NAME).then(function(cache){
    return cache.addAll(APP_SHELL);
  }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(event){
  event.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(key){
      return key.indexOf('mapa-horta-shell-') === 0 && key !== CACHE_NAME;
    }).map(function(key){ return caches.delete(key); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(event){
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(caches.match(request).then(function(cached){
      return cached || fetch(request);
    }).catch(function(){ return caches.match('./index.html'); }));
    return;
  }

  event.respondWith(caches.match(request).then(function(cached){
    return cached || fetch(request).then(function(response){
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(request, copy); });
      }
      return response;
    });
  }));
});

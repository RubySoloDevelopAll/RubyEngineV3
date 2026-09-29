/* =========================================
   RubyEngine — Service Worker
   Cache-first untuk static asset
   Network-first untuk HTML
========================================= */

const CACHE_NAME = 'rubyengine-v1';
const OFFLINE_URL = 'offline.html';

/* File yang di-cache saat install */
const PRECACHE = [
  './',
  './index.html',
  './login.html',
  './home.html',
  './apk.html',
  './game.html',
  './wa.html',
  './admin.html',
  './404.html',
  './offline.html',
  './css/style.css',
  './js/script.js',
  './js/sfx.js',
  './js/auth.js',
  './manifest.json',
  './image/icon-192.png',
  './image/icon-512.png'
];

/* =========================================
   INSTALL — precache semua aset
========================================= */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE.map(url =>
          cache.add(url).catch(err => {
            console.warn('[SW] Gagal cache:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* =========================================
   ACTIVATE — hapus cache lama
========================================= */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

/* =========================================
   FETCH — strategi per tipe request
========================================= */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Skip non-GET (POST, dll)
  if (req.method !== 'GET') return;

  // Skip cross-origin (kecuali gambar)
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Skip video (biar streaming gak keganggu cache)
  if (req.destination === 'video') return;

  // HTML → Network-first, fallback ke cache, fallback ke 404/offline
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          return caches.match('404.html');
        })
    );
    return;
  }

  // CSS / JS / gambar / font → Cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(() => {
        if (req.destination === 'image') {
          return caches.match('./image/icon-192.png');
        }
      });
    })
  );
});

/* =========================================
   MESSAGE — update / skipWaiting manual
========================================= */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
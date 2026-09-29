const CACHE_NAME = 'caresync-v1';
const PRECACHE_URLS = [
  '/',
  '/login',
  '/patient',
  '/patient/new',
  '/offline.html',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER cache API calls, doctor routes, Supabase domains, signed storage URLs
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/doctor') ||
    url.hostname.includes('supabase.co') ||
    url.searchParams.has('token')
  ) {
    return;
  }

  // Handle HTML Page Navigations for patient area
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Attempt network fetch with 3s timeout
          const fetchPromise = fetch(event.request);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 3000)
          );

          const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
          if (response && response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, response.clone());
            return response;
          }
          throw new Error('Network response not ok');
        } catch (err) {
          // Fallback to cached patient shell or offline page
          const cache = await caches.open(CACHE_NAME);
          const cachedPatientShell = await cache.match('/patient');
          if (cachedPatientShell) return cachedPatientShell;
          
          const offlinePage = await cache.match('/offline.html');
          if (offlinePage) return offlinePage;
          
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Stale-While-Revalidate for static assets
  if (event.request.destination === 'style' || event.request.destination === 'script' || event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});

// Service Worker for CloudGame PWA
const CACHE_NAME = 'cloudgame-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  'index.html',
  'manifest.json',
  'images/favicon.svg',
  'images/game-icon.svg',
  'images/apple-touch-icon.svg',
  'images/favicon.ico',
  'games/action.html',
  'games/puzzle.html',
  'games/sports.html',
  'games/shooter.html',
  'games/anime.html',
  'games/racing.html',
  'games/fighting.html',
  'games/new.html'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return cacheNames.filter(cacheName => !currentCaches.includes(cacheName));
    }).then(cachesToDelete => {
      return Promise.all(cachesToDelete.map(cacheToDelete => {
        return caches.delete(cacheToDelete);
      }));
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // 处理 /games/action 与 /games/action.html 的兼容性
          const url = new URL(event.request.url);
          const pathWithoutExtension = url.pathname.replace(/\/$/, '');
          const htmlPath = pathWithoutExtension + '.html';
          
          // 如果请求的是不带扩展名的路径，尝试查找带有.html的缓存
          if (!url.pathname.endsWith('.html') && !url.pathname.endsWith('/')) {
            return caches.match(new Request(url.origin + htmlPath))
              .then(htmlResponse => {
                if (htmlResponse) {
                  return htmlResponse;
                }
                return fetchAndCache(event.request);
              });
          }
          
          return fetchAndCache(event.request);
        })
    );
  }
});

// 辅助函数：获取并缓存响应
function fetchAndCache(request) {
  return fetch(request)
    .then(response => {
      // Store in cache if it's a successful response and not a game iframe URL
      if (response.ok && !request.url.includes('play.famobi.com')) {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(request, responseToCache);
          });
      }
      return response;
    })
    .catch(() => {
      // For navigation requests, return the offline page as fallback
      if (request.mode === 'navigate') {
        return caches.match('index.html');
      }
      // Otherwise return nothing
      return new Response('Network error', {
        status: 408,
        headers: { 'Content-Type': 'text/plain' }
      });
    });
}

// Sync event for background syncing capabilities
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-game-data') {
    event.waitUntil(syncGameData());
  }
});

// Helper function for syncing game data
async function syncGameData() {
  // This would contain logic to sync any game progress or user preferences
  console.log('Background sync for game data executed');
}

// Handle push notifications
self.addEventListener('push', (event) => {
  const title = 'CloudGame';
  const options = {
    body: event.data?.text() || 'New games are available!',
    icon: 'images/game-icon.svg',
    badge: 'images/favicon.svg'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('./')
  );
}); 
// Service Worker for CloudGame PWA
const CACHE_NAME = 'cloudgame-cache-v3';
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'manifest.json',
  'images/favicon.svg',
  'images/game-icon.svg',
  'images/apple-touch-icon.svg',
  'images/favicon.ico',
  // HTML versions
  'games/action.html',
  'games/puzzle.html',
  'games/sports.html',
  'games/shooter.html',
  'games/anime.html',
  'games/racing.html',
  'games/fighting.html',
  'games/new.html',
  'games/popular.html',
  // Clean URL versions
  'games/action',
  'games/puzzle',
  'games/sports',
  'games/shooter',
  'games/anime',
  'games/racing',
  'games/fighting',
  'games/new',
  'games/popular'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[ServiceWorker] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  const currentCaches = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return cacheNames.filter(cacheName => !currentCaches.includes(cacheName));
    }).then(cachesToDelete => {
      return Promise.all(cachesToDelete.map(cacheToDelete => {
        console.log('[ServiceWorker] Deleting old cache:', cacheToDelete);
        return caches.delete(cacheToDelete);
      }));
    }).then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  console.log('[ServiceWorker] Fetch', event.request.url);
  
  // Handle navigation requests differently
  if (event.request.mode === 'navigate') {
    event.respondWith(
      handleNavigationRequest(event.request)
    );
    return;
  }
  
  // Handle regular asset requests
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('[ServiceWorker] Return cached response for:', event.request.url);
          return cachedResponse;
        }
        
        return fetchAndCache(event.request);
      })
  );
});

// Handle navigation requests (HTML pages)
function handleNavigationRequest(request) {
  const url = new URL(request.url);
  
  // Special handling for game category paths without .html
  const isGameCategoryPath = /\/games\/[a-zA-Z0-9-_]+$/.test(url.pathname) && 
                           !url.pathname.endsWith('.html') && 
                           !url.pathname.endsWith('/');
                           
  console.log('[ServiceWorker] Is game category path:', isGameCategoryPath, url.pathname);
  
  if (isGameCategoryPath) {
    // Try with .html extension
    const htmlRequest = new Request(url.origin + url.pathname + '.html');
    
    console.log('[ServiceWorker] Trying with HTML extension:', htmlRequest.url);
    
    return caches.match(htmlRequest)
      .then(cachedHtmlResponse => {
        if (cachedHtmlResponse) {
          console.log('[ServiceWorker] Found cached HTML response');
          return cachedHtmlResponse;
        }
        
        // If not in cache, try fetching with .html
        return fetch(htmlRequest)
          .then(response => {
            if (response.ok) {
              console.log('[ServiceWorker] Network response for HTML version ok');
              // Cache the response for future
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(htmlRequest, responseToCache));
                
              return response;
            }
            
            // If HTML version fails, try original request
            console.log('[ServiceWorker] HTML version failed, trying original request');
            return fetchAndCache(request);
          })
          .catch(error => {
            console.error('[ServiceWorker] Fetch error:', error);
            return fetchAndCache(request);
          });
      });
  }
  
  // For normal navigation requests
  return caches.match(request)
    .then(cachedResponse => {
      if (cachedResponse) {
        console.log('[ServiceWorker] Return cached navigation response');
        return cachedResponse;
      }
      
      // Next try index.html for directory paths
      if (url.pathname.endsWith('/')) {
        const indexRequest = new Request(url.origin + url.pathname + 'index.html');
        return caches.match(indexRequest)
          .then(cachedIndexResponse => {
            if (cachedIndexResponse) {
              return cachedIndexResponse;
            }
            return fetchAndCache(request);
          });
      }
      
      return fetchAndCache(request);
    });
}

// Helper function to fetch and cache
function fetchAndCache(request) {
  return fetch(request)
    .then(response => {
      console.log('[ServiceWorker] Fetched from network:', request.url, response.status);
      // Store in cache if it's a successful response and not a game iframe URL
      if (response.ok && !request.url.includes('play.famobi.com')) {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            console.log('[ServiceWorker] Caching new resource:', request.url);
            cache.put(request, responseToCache);
          });
      }
      return response;
    })
    .catch(error => {
      console.error('[ServiceWorker] Fetch failed:', error);
      // For navigation requests, return the offline page as fallback
      if (request.mode === 'navigate') {
        return caches.match('index.html');
      }
      // Otherwise return error response
      return new Response('Network error: Unable to fetch ' + request.url, {
        status: 408,
        headers: { 'Content-Type': 'text/plain' }
      });
    });
}

// Sync event for background syncing capabilities
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Sync event:', event.tag);
  if (event.tag === 'sync-game-data') {
    event.waitUntil(syncGameData());
  }
});

// Helper function for syncing game data
async function syncGameData() {
  // This would contain logic to sync any game progress or user preferences
  console.log('[ServiceWorker] Background sync for game data executed');
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received:', event);
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
  console.log('[ServiceWorker] Notification click');
  event.notification.close();
  event.waitUntil(
    clients.openWindow('./')
  );
}); 
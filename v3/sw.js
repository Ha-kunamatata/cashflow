// ════════════════════════════════════════════════
// sw.js — Cash Flow PWA Service Worker
// ════════════════════════════════════════════════
const CACHE = 'cashflow-v5';

const APP_SHELL = [
  './',
  './css/style.css?v=5',
  './js/app.js',
  './js/render.js',
  './js/ai.js',
  './js/ui.js',
  './js/utils.js',
  './js/state.js',
  './js/config.js',
  './js/forecast.js',
  './js/assets.js',
  './js/budget.js',
  './js/streak.js',
  './manifest.json',
];

// Install: cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// Activate: delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first for API/Firebase, cache-first for app shell
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network for: Firebase, Gemini API, Yahoo Finance, Google APIs, CORS proxies
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gemini') ||
    url.hostname.includes('yahoo.com') ||
    url.hostname.includes('allorigins') ||
    url.hostname.includes('corsproxy') ||
    url.hostname.includes('codetabs') ||
    url.hostname.includes('fonts.g') ||
    e.request.method !== 'GET'
  ) {
    return; // let browser handle normally
  }

  // Cache-first for same-origin app shell assets
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => caches.match('./'));
      })
    );
  }
});

// ════════════════════════════════════════════════
// sw.js — Cash Flow PWA Service Worker (Vite build)
// ════════════════════════════════════════════════
// Vite가 매 빌드마다 hashed 파일명을 생성하므로 precache 리스트는 사용하지 않고
// 런타임 캐싱만 합니다. HTML은 항상 네트워크 우선, 나머지는 stale-while-revalidate.
const CACHE = 'cashflow-runtime-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 외부 API는 SW가 건드리지 않음
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('gemini') ||
    url.hostname.includes('yahoo.com') ||
    url.hostname.includes('allorigins') ||
    url.hostname.includes('corsproxy') ||
    url.hostname.includes('codetabs') ||
    url.hostname.includes('fonts.g') ||
    e.request.method !== 'GET'
  ) return;

  if (url.origin !== self.location.origin) return;

  // HTML: 네트워크 우선 → 실패 시 캐시 (최신 HTML 보장)
  const isDoc = e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html');
  if (isDoc) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match('/')))
    );
    return;
  }

  // 정적 에셋: stale-while-revalidate (캐시 즉시 반환 + 백그라운드 갱신)
  e.respondWith(
    caches.open(CACHE).then(c =>
      c.match(e.request).then(cached => {
        const fetched = fetch(e.request).then(res => {
          if (res.ok) c.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fetched;
      })
    )
  );
});

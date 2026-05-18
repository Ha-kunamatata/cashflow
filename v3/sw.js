// ════════════════════════════════════════════════
// sw.js — Cash Flow PWA Service Worker
// 버전을 바꾸면 새 캐시 생성 → 구 캐시 삭제 → 페이지 자동 리로드
// ════════════════════════════════════════════════
const CACHE = 'cashflow-v12';

const APP_SHELL = [
  './css/style.css?v=10',
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

// Install: 정적 에셋 캐시. index.html은 캐시 안 함 → 항상 최신 HTML 로드
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting()) // 대기 없이 즉시 활성화
  );
});

// Activate: 이전 버전 캐시 삭제 후 모든 클라이언트 제어권 획득
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // 열려있는 모든 탭/창 즉시 제어
  );
});

// Fetch 전략:
// - index.html: 항상 네트워크 우선 (최신 HTML 보장), 실패 시 캐시 폴백
// - 정적 에셋(JS/CSS): 캐시 우선, 없으면 네트워크 후 캐시 저장
// - 외부 API(Firebase/Gemini/Yahoo 등): 서비스워커 개입 없음
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 외부 API는 건드리지 않음
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
  ) return;

  if (url.origin !== self.location.origin) return;

  // index.html(./): 네트워크 우선 → 실패 시 캐시
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
        .catch(() => caches.match(e.request).then(c => c || caches.match('./')))
    );
    return;
  }

  // 정적 에셋: 캐시 우선
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      });
    })
  );
});

// ════════════════════════════════════════════════════════
// utils.js — 공통 유틸 함수
// ════════════════════════════════════════════════════════

// ── UID 생성 ───────────────────────────────────────────
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── 오늘 날짜 ──────────────────────────────────────────
export function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── 날짜 키 변환 ───────────────────────────────────────
export function dateKey(date) {
  if (!date) return '';
  return new Date(date).toISOString().slice(0, 10);
}

// ── 과거/오늘 여부 ────────────────────────────────────
export function isPastOrToday(dk) {
  if (!dk) return false;
  return dk <= today();
}

// ── 리플 효과 초기화 ──────────────────────────────────
export function initRipple() {
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.btn');
    if (!btn) return;

    const ripple = document.createElement('span');
    ripple.className = 'ripple';

    const rect = btn.getBoundingClientRect();
    ripple.style.left = e.clientX - rect.left + 'px';
    ripple.style.top = e.clientY - rect.top + 'px';

    btn.appendChild(ripple);

    setTimeout(() => ripple.remove(), 500);
  });
}

// ── 배지 표시 ─────────────────────────────────────────
export function showBadge(text) {
  const badge = document.getElementById('sync-badge');
  if (!badge) return;

  badge.textContent = text;
  badge.style.display = 'block';

  setTimeout(() => {
    badge.style.display = 'none';
  }, 2000);
}

// ── 시트 열기 ─────────────────────────────────────────
export function openSheet(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'block';
}

// ── 시트 닫기 ─────────────────────────────────────────
export function closeSheet(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// ── 시트 외부 클릭 닫기 ───────────────────────────────
export function closeSheetOutside(e, id) {
  if (e.target.id === id) {
    closeSheet(id);
  }
}

// ── 로딩 표시 ─────────────────────────────────────────
export function showLoading(text = '로딩 중...') {
  const overlay = document.getElementById('loading-overlay');
  const txt = document.getElementById('loading-text');

  if (overlay) overlay.style.display = 'flex';
  if (txt) txt.textContent = text;
}

// ── 로딩 숨김 ─────────────────────────────────────────
export function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

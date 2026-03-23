// ════════════════════════════════════════════════════════
// utils.js — 공통 유틸 함수
// ════════════════════════════════════════════════════════

// ── 기본 날짜/문자열 유틸 ──────────────────────────────
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function p2(n) {
  return String(n).padStart(2, '0');
}

export function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function yyyymm(date) {
  const d = new Date(date);
  return Number(`${d.getFullYear()}${p2(d.getMonth() + 1)}`);
}

export function isPastOrToday(dk) {
  return dk <= dateKey(today());
}

// ── 금액 포맷 ──────────────────────────────────────────
export function fmtFull(v) {
  const num = Number(v || 0);
  return `${num.toLocaleString('ko-KR')}원`;
}

export function fmtShort(v) {
  const num = Number(v || 0);
  return `${num.toLocaleString('ko-KR')}원`;
}

export function fmtSigned(v) {
  const num = Number(v || 0);
  const sign = num >= 0 ? '+' : '-';
  return `${sign}${Math.abs(num).toLocaleString('ko-KR')}원`;
}

export function fmtDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`;
}

// ── 숫자 애니메이션 ───────────────────────────────────
export function animateNumber(el, target, formatter = (v) => String(v), duration = 300) {
  if (!el) return;

  const startText = (el.dataset.value ?? '0').replace(/,/g, '');
  const start = Number(startText) || 0;
  const end = Number(target) || 0;

  if (start === end) {
    el.textContent = formatter(end);
    el.dataset.value = String(end);
    return;
  }

  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * eased);

    el.textContent = formatter(current);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = formatter(end);
      el.dataset.value = String(end);
    }
  }

  requestAnimationFrame(tick);
}

// ── 리플 효과 ─────────────────────────────────────────
export function initRipple() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;

    const container = btn.querySelector('.ripple-container') || btn;
    container.appendChild(ripple);

    setTimeout(() => ripple.remove(), 500);
  });
}

// ── 배지 ──────────────────────────────────────────────
let badgeTimer = null;

export function showBadge(text) {
  const badge = document.getElementById('sync-badge');
  if (!badge) return;

  badge.textContent = text;
  badge.style.display = 'block';

  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(() => {
    badge.style.display = 'none';
  }, 2200);
}

// ── 시트/오버레이 ─────────────────────────────────────
export function openSheet(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

export function closeSheet(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'none';

  const stillOpen = [...document.querySelectorAll('.sheet-overlay, .form-overlay')]
    .some((node) => node.style.display !== 'none');

  if (!stillOpen) {
    document.body.style.overflow = '';
  }
}

export function closeSheetOutside(e, id) {
  if (e.target?.id === id) {
    closeSheet(id);
  }
}

// ── 로딩 ──────────────────────────────────────────────
export function showLoading(text = '처리 중...') {
  const overlay = document.getElementById('loading-overlay');
  const label = document.getElementById('loading-text');

  if (label) label.textContent = text;
  if (overlay) overlay.style.display = 'flex';
}

export function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

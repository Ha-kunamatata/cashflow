// ════════════════════════════════════════════════════════
// utils.ts — 공통 유틸 함수
// ════════════════════════════════════════════════════════

// ── HTML 이스케이프 ────────────────────────────────────
export function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── 기본 날짜/문자열 유틸 ──────────────────────────────
export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function today(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(date: Date | string | number, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function p2(n: number | string): string {
  return String(n).padStart(2, '0');
}

export function dateKey(date: Date | string | number): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function yyyymm(date: Date | string | number): number {
  const d = new Date(date);
  return Number(`${d.getFullYear()}${p2(d.getMonth() + 1)}`);
}

export function isPastOrToday(dk: string): boolean {
  return dk <= dateKey(today());
}

// ── 금액 포맷 ──────────────────────────────────────────
export function fmtFull(v: number | string | null | undefined): string {
  const num = Number(v || 0);
  return `${num.toLocaleString('ko-KR')}원`;
}

function _compact(abs: number): string {
  if (abs >= 100_000_000) {
    const v = abs / 100_000_000;
    return `${parseFloat(v.toFixed(1)).toLocaleString('ko-KR')}억`;
  }
  if (abs >= 10_000) {
    const v = abs / 10_000;
    return `${parseFloat(v.toFixed(1)).toLocaleString('ko-KR')}만`;
  }
  return abs.toLocaleString('ko-KR');
}

export function fmtShort(v: number | string | null | undefined): string {
  const num = Number(v || 0);
  const sign = num < 0 ? '-' : '';
  return `${sign}${_compact(Math.abs(num))}원`;
}

export function fmtSigned(v: number | string | null | undefined): string {
  const num = Number(v || 0);
  const sign = num >= 0 ? '+' : '-';
  return `${sign}${_compact(Math.abs(num))}원`;
}

export function fmtDate(date: Date | string | number): string {
  const d = new Date(date);
  return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`;
}

// ── 숫자 애니메이션 ───────────────────────────────────
export function animateNumber(
  el: HTMLElement | null,
  target: number,
  formatter: (v: number) => string = (v) => String(v),
  duration = 300,
): void {
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

  function tick(now: number) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * eased);

    el!.textContent = formatter(current);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el!.textContent = formatter(end);
      el!.dataset.value = String(end);
    }
  }

  requestAnimationFrame(tick);
}

// ── 리플 효과 ─────────────────────────────────────────
export function initRipple(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest('.btn') as HTMLElement | null;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;

    const container = (btn.querySelector('.ripple-container') as HTMLElement | null) || btn;
    container.appendChild(ripple);

    setTimeout(() => ripple.remove(), 500);
  });
}

// ── 배지 ──────────────────────────────────────────────
let badgeTimer: ReturnType<typeof setTimeout> | null = null;

export function showBadge(text: string): void {
  const badge = document.getElementById('sync-badge');
  if (!badge) return;

  badge.textContent = text;
  badge.style.display = 'block';

  if (badgeTimer) clearTimeout(badgeTimer);
  badgeTimer = setTimeout(() => {
    badge.style.display = 'none';
  }, 2200);
}

// ── 시트/오버레이 ─────────────────────────────────────
export function openSheet(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  document.body.style.overflow = 'hidden';
}

export function closeSheet(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');

  const stillOpen =
    [...document.querySelectorAll('.sheet-overlay')].some((node) =>
      node.classList.contains('show'),
    ) || (document.getElementById('form-overlay') as HTMLElement | null)?.style.display === 'flex';

  if (!stillOpen) {
    document.body.style.overflow = '';
  }
}

export function closeSheetOutside(e: Event, id: string): void {
  const target = e.target as HTMLElement | null;
  if (target?.id === id) {
    closeSheet(id);
  }
}

// ── 로딩 ──────────────────────────────────────────────
export function showLoading(text = '처리 중...'): void {
  const overlay = document.getElementById('loading-overlay');
  const label = document.getElementById('loading-text');

  if (label) label.textContent = text;
  if (overlay) overlay.style.display = 'flex';
}

export function hideLoading(): void {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

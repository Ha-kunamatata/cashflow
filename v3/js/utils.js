// ════════════════════════════════════════════════════════
// utils.js — 공통 유틸리티 함수
// ════════════════════════════════════════════════════════

export function uid() {
return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function today() { return new Date(); }

export function addDays(d, n) {
const r = new Date(d);
r.setDate(r.getDate() + n);
return r;
}

export function p2(n) { return String(n).padStart(2, ‘0’); }

export function dateKey(d) {
return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function yyyymm(d) {
return d.getFullYear() * 100 + (d.getMonth() + 1);
}

export function fmtFull(n) {
return Math.abs(Number(n || 0)).toLocaleString(‘ko-KR’) + ‘원’;
}

export function fmtShort(n) {
const value = Number(n || 0);
if (value === 0) return ‘0원’;
const abs  = Math.abs(value);
const sign = value < 0 ? ‘-’ : ‘’;
if (abs >= 100000000) return sign + (abs / 100000000).toFixed(1) + ‘억’;
if (abs >= 10000)     return sign + (abs / 10000).toFixed(1) + ‘만’;
return sign + abs.toLocaleString(‘ko-KR’) + ‘원’;
}

export function fmtSigned(n) {
const value = Number(n || 0);
if (value === 0) return ‘0원’;
const sign = value > 0 ? ‘+’ : ‘-’;
return sign + Math.abs(value).toLocaleString(‘ko-KR’) + ‘원’;
}

export function isPastOrToday(dateStr) {
return dateStr <= dateKey(today());
}

/** 숫자 카운팅 애니메이션 */
export function animateNumber(el, nextValue, formatter = v => v.toLocaleString(‘ko-KR’)) {
if (!el) return;
const raw        = Number(nextValue || 0);
const startValue = Number(el.dataset.value || ‘0’);
const duration   = 520;
const startTime  = performance.now();

function frame(now) {
const progress = Math.min((now - startTime) / duration, 1);
const eased    = 1 - Math.pow(1 - progress, 3);
const current  = Math.round(startValue + (raw - startValue) * eased);
el.textContent = formatter(current);
if (progress < 1) {
requestAnimationFrame(frame);
} else {
el.dataset.value = String(raw);
}
}
requestAnimationFrame(frame);
}

/** 리플 효과 등록 (document 레벨) */
export function initRipple() {
document.addEventListener(‘click’, e => {
const btn = e.target.closest(’.btn’);
if (!btn) return;
const rc = btn.querySelector(’.ripple-container’);
if (!rc) return;
const r    = document.createElement(‘div’);
r.className = ‘ripple’;
const rect = btn.getBoundingClientRect();
const size = Math.max(rect.width, rect.height) * 1.5;
r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
rc.appendChild(r);
setTimeout(() => r.remove(), 600);
});
}

let _badgeTimer = null;
export function showBadge(msg) {
const b = document.getElementById(‘sync-badge’);
if (!b) return;
b.textContent = msg;
b.classList.add(‘visible’);
clearTimeout(_badgeTimer);
_badgeTimer = setTimeout(() => b.classList.remove(‘visible’), 2500);
}

export function showLoading(text = ‘처리 중…’) {
const el = document.getElementById(‘loading-text’);
if (el) el.textContent = text;
document.getElementById(‘loading-overlay’)?.classList.add(‘show’);
}

export function hideLoading() {
document.getElementById(‘loading-overlay’)?.classList.remove(‘show’);
}

export function openSheet(id) {
document.getElementById(id)?.classList.add(‘show’);
document.body.style.overflow = ‘hidden’;
}

export function closeSheet(id) {
document.getElementById(id)?.classList.remove(‘show’);
document.body.style.overflow = ‘’;
}

export function closeSheetOutside(e, id) {
if (e.target.id === id) closeSheet(id);
}

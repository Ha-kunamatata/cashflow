// ════════════════════════════════════════════════════════
// render.js — 화면 렌더링
// ════════════════════════════════════════════════════════
import { DAYS_KR, CAT_COLORS, LEDGER_CAT_COLORS, LEDGER_CATEGORIES, LEDGER_INCOME_CATEGORIES } from './config';
import { ASSET_TYPES, ASSET_PURPOSES, PURPOSE_COLORS, getTotalAssets, getUsableMoney, getAssetsByPurpose, getHouseLevel, HOUSE_LEVELS } from './assets';
import { getMonthBudget, getMonthActual } from './budget';
import { computeStreak, BADGE_DEFS, RARITY_CONFIG } from './streak';
import {
  today,
  dateKey,
  yyyymm,
  p2,
  fmtFull,
  fmtShort,
  fmtSigned,
  animateNumber,
  escapeHtml,
} from './utils';
import { state, DEFAULT_CARDS } from './state';
import { buildForecast, getCards, simulateWishPurchase } from './forecast';
import { hasGeminiKey, renderMarkdown, getWeeklyCoachingInsight } from './ai';

let _chartPeriod = 30;
let _forecastFilter = 'all';
let _entryFilter = '전체';
let _annualReviewYear = null;
let _annualReviewListenerReady = false;
let _simCategory = null;
let _simCurrentAvg = 0;
const _celebratedGoals = new Set();

export let currentLedgerYear = today().getFullYear();
export let currentLedgerMonth = today().getMonth();

// 마지막으로 보던 가계부 월 복원
try {
  const saved = JSON.parse(localStorage.getItem('cashflow_ledger_ym') || 'null');
  if (saved && typeof saved.y === 'number' && typeof saved.m === 'number') {
    currentLedgerYear = saved.y;
    currentLedgerMonth = saved.m;
  }
} catch (_) {}

let _selectedLedgerDate = null;
let _ledgerSubTab   = 'calendar'; // 'calendar' | 'stats'
let _ledgerStatsTab = 'monthly';  // 'monthly' | 'annual'

export function setSelectedLedgerDate(dk) {
  _selectedLedgerDate = dk;
}

// ── 가계부 헬퍼 ──────────────────────────────────────
function getLedgerDay(dk) {
  const items   = state.ledgerData?.[dk] || [];
  const expense = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
  const income  = items.filter(i => i.type === 'income' ).reduce((s, i) => s + i.amount, 0);
  return { expense, income, items };
}

function getLedgerMonth(year, month) {
  const prefix   = `${year}-${p2(month + 1)}`;
  let expense = 0, income = 0;
  const catTotals = {};
  const dayMap    = {};

  for (const [dk, items] of Object.entries(state.ledgerData || {})) {
    if (!dk.startsWith(prefix)) continue;
    for (const item of items) {
      if (item.type === 'expense') {
        expense += item.amount;
        catTotals[item.category] = (catTotals[item.category] || 0) + item.amount;
        const day = parseInt(dk.split('-')[2], 10);
        dayMap[day] = (dayMap[day] || 0) + item.amount;
      } else {
        income += item.amount;
      }
    }
  }
  return { expense, income, net: income - expense, catTotals, dayMap };
}

function getLedgerYear(year) {
  let expense = 0, income = 0;
  const monthMap = {}; // {month: {expense, income}}
  for (const [dk, items] of Object.entries(state.ledgerData || {})) {
    if (!dk.startsWith(String(year))) continue;
    const m = parseInt(dk.split('-')[1], 10);
    if (!monthMap[m]) monthMap[m] = { expense: 0, income: 0 };
    for (const item of items) {
      if (item.type === 'expense') { expense += item.amount; monthMap[m].expense += item.amount; }
      else                         { income  += item.amount; monthMap[m].income  += item.amount; }
    }
  }
  return { expense, income, net: income - expense, monthMap };
}

export function setLedgerSubTab(tab) {
  _ledgerSubTab = tab;
  document.querySelectorAll('#page-ledger .ledger-sub-tab').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === tab)
  );
  const cal      = document.getElementById('ledger-view-calendar');
  const stats    = document.getElementById('ledger-view-stats');
  const budget   = document.getElementById('ledger-view-budget');
  const forecast = document.getElementById('ledger-view-forecast');
  if (cal)      cal.style.display      = tab === 'calendar' ? '' : 'none';
  if (stats)    stats.style.display    = tab === 'stats'    ? '' : 'none';
  if (budget)   budget.style.display   = tab === 'budget'   ? '' : 'none';
  if (forecast) forecast.style.display = tab === 'forecast' ? '' : 'none';
  if (tab === 'stats')    renderLedgerStats();
  if (tab === 'budget')   renderBudget();
  if (tab === 'forecast') renderLedgerForecast();
}

export function setLedgerStatsTab(tab) {
  _ledgerStatsTab = tab;
  document.querySelectorAll('.ledger-stats-tab').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === tab)
  );
  renderLedgerStats();
}

// ════════════════════════════════════════════════════════
// 전체 렌더
// ════════════════════════════════════════════════════════
export function renderAll() {
  renderHome();
  renderEntries();
  renderSettingsStats();

  const activePage = document.querySelector('.page.active');
  if (activePage?.id === 'page-forecast') renderForecast();
  if (activePage?.id === 'page-ledger') renderLedger();
  if (activePage?.id === 'page-report') renderReport();
  if (activePage?.id === 'page-goals') renderGoals();
  if (activePage?.id === 'page-assets') renderAssets();
  if (activePage?.id === 'page-wishlist') renderWishlist();
  if (activePage?.id === 'page-finance') renderFinance();
}

export function renderSettingsStats() {
  const el = document.getElementById('settings-stats');
  if (!el) return;

  const totalEntries = state.entries.length;
  const mIncome = state.entries
    .filter((e) => e.type === 'income' && e.repeat === '매월')
    .reduce((s, e) => s + e.amount, 0);
  const mExpense = state.entries
    .filter((e) => e.type === 'expense' && e.repeat === '매월')
    .reduce((s, e) => s + e.amount, 0);
  const activeHalbu = state.entries.filter(
    (e) =>
      e.type === 'expense' &&
      e.category === '할부' &&
      e.repeat === '매월' &&
      (!e.endMonth || parseInt(e.endMonth, 10) >= yyyymm(today())),
  ).length;
  const checkDaysTotal = Object.keys(state.ledgerData || {}).filter(dk => (state.ledgerData[dk] || []).length > 0).length;

  el.innerHTML = `
    <div class="stat-item">
      <div class="stat-label">등록 항목</div>
      <div class="stat-value">${totalEntries}<span style="font-size:11px;color:var(--text3)">개</span></div>
    </div>
    <div class="stat-item">
      <div class="stat-label">월 수입</div>
      <div class="stat-value" style="color:var(--green2)">${fmtShort(mIncome)}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">월 지출</div>
      <div class="stat-value" style="color:var(--red2)">${fmtShort(mExpense)}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">활성 할부</div>
      <div class="stat-value">${activeHalbu}<span style="font-size:11px;color:var(--text3)">건</span></div>
    </div>
    <div class="stat-item">
      <div class="stat-label">가계부 기록</div>
      <div class="stat-value">${checkDaysTotal}<span style="font-size:11px;color:var(--text3)">일</span></div>
    </div>
    <div class="stat-item">
      <div class="stat-label">순현금흐름</div>
      <div class="stat-value" style="color:${mIncome >= mExpense ? 'var(--green2)' : 'var(--red2)'}">${fmtSigned(mIncome - mExpense)}</div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════
// 주간 요약 카드
// ════════════════════════════════════════════════════════
function _getWeekExpense(offsetWeeks) {
  const now = today();
  const dow = now.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (d > now) break;
    const dk = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    total += (state.ledgerData?.[dk] || [])
      .filter(it => it.type === 'expense')
      .reduce((s, it) => s + it.amount, 0);
  }
  return total;
}

export function renderWeeklyCard() {
  const el = document.getElementById('weekly-summary-card');
  if (!el) return;
  const thisWeek = _getWeekExpense(0);
  const lastWeek = _getWeekExpense(-1);
  const diff = thisWeek - lastWeek;
  const diffColor = diff <= 0 ? 'var(--green2)' : 'var(--red2)';
  const now = today();
  const dow = now.getDay();
  const daysIn = dow === 0 ? 7 : dow; // days elapsed this week (Mon=1...Sun=7)
  const budget = getMonthBudget(state.budgets || {}, now.getFullYear(), now.getMonth());
  const hasBudget = Object.keys(budget).length > 0;
  const actual = hasBudget ? getMonthActual(state.ledgerData, now.getFullYear(), now.getMonth()) : {};
  const budgetTotal = Object.values(budget).reduce((s, v) => s + v, 0);
  const actualTotal = Object.values(actual).reduce((s, v) => s + v, 0);
  const remaining = budgetTotal - actualTotal;

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="font-size:18px">📅</span>
      <div style="font-size:13px;font-weight:800;color:var(--text)">이번 주 지출 현황</div>
      <span style="font-size:10px;color:var(--text3);margin-left:auto">월요일 기준</span>
    </div>
    <div style="display:flex;gap:0;margin-bottom:${hasBudget ? '10px' : '0'}">
      <div style="flex:1;text-align:center;padding:10px 8px;background:var(--bg3);border-radius:12px 0 0 12px;border:1px solid var(--border)">
        <div style="font-size:10px;color:var(--text3);margin-bottom:3px">지난 주</div>
        <div style="font-size:15px;font-weight:800;font-family:var(--mono);color:var(--text2)">${fmtShort(lastWeek)}</div>
      </div>
      <div style="flex:1;text-align:center;padding:10px 8px;background:rgba(99,102,241,0.12);border-radius:0 12px 12px 0;border:1px solid rgba(99,102,241,0.3)">
        <div style="font-size:10px;color:var(--text3);margin-bottom:3px">이번 주 (${daysIn}일)</div>
        <div style="font-size:15px;font-weight:800;font-family:var(--mono);color:#a5b4fc">${fmtShort(thisWeek)}</div>
        <div style="font-size:10px;margin-top:2px;color:${diffColor}">${diff <= 0 ? '▼' : '▲'} ${fmtShort(Math.abs(diff))} 전주비</div>
      </div>
    </div>
    ${hasBudget ? `<div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;padding:8px 10px;background:var(--bg3);border-radius:10px;border:1px solid var(--border)">
      <span style="color:var(--text3)">이번달 예산 잔여</span>
      <span style="font-weight:800;font-family:var(--mono);color:${remaining >= 0 ? 'var(--green2)' : 'var(--red2)'}">${fmtSigned(remaining)}</span>
    </div>` : ''}`;
}

// ════════════════════════════════════════════════════════
// 스파크라인 (최근 14일 지출 패턴) — SVG 에리어 차트
// ════════════════════════════════════════════════════════
function _renderSparkline() {
  const el = document.getElementById('balance-sparkline');
  if (!el) return;
  const now = today();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dk = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const items = state.ledgerData?.[dk] || [];
    const exp = items.filter(it => it.type === 'expense').reduce((s, it) => s + it.amount, 0);
    const inc = items.filter(it => it.type === 'income').reduce((s, it) => s + it.amount, 0);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    days.push({ d, dk, exp, inc, isToday: i === 0, isWeekend, dow: dayNames[d.getDay()] });
  }

  const hasData = days.some(d => d.exp > 0 || d.inc > 0);
  if (!hasData) { el.innerHTML = ''; return; }

  // 라이트/다크 테마 분기
  const isLight = document.body.classList.contains('light-theme');
  const tLabel   = isLight ? 'rgba(30,58,138,0.55)'  : 'rgba(255,255,255,0.55)';
  const tDim     = isLight ? 'rgba(30,58,138,0.38)'  : 'rgba(255,255,255,0.38)';
  const tWeekend = isLight ? 'rgba(37,99,235,0.7)'   : 'rgba(96,165,250,0.65)';
  const tToday   = isLight ? 'rgba(99,102,241,1)'    : 'rgba(129,140,248,1)';
  const avgStroke= isLight ? 'rgba(30,58,138,0.18)'  : 'rgba(255,255,255,0.15)';
  const todayLine= isLight ? 'rgba(99,102,241,0.35)' : 'rgba(129,140,248,0.35)';
  const todayDot = isLight ? '#6366f1' : '#818cf8';
  const dotStroke= isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)';

  const maxVal = Math.max(...days.map(d => Math.max(d.exp, d.inc)), 1);
  const avgDaily = days.reduce((s, d) => s + d.exp, 0) / 14;
  const todayExp = days[13].exp;
  const todayInc = days[13].inc;

  const W = 560, H = 56, PT = 6, PB = 2;
  const chartH = H - PT - PB;
  const step = W / (days.length - 1);

  const pts = days.map((d, i) => ({
    x: i * step,
    y: PT + chartH - (d.exp / maxVal) * chartH,
  }));

  let linePath = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    linePath += ` C ${mx.toFixed(1)},${pts[i].y.toFixed(1)} ${mx.toFixed(1)},${pts[i + 1].y.toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`;
  }
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)},${H} L ${pts[0].x.toFixed(1)},${H} Z`;

  const avgY = PT + chartH - Math.min(1, avgDaily / maxVal) * chartH;
  const todayPt = pts[13];

  const areaOpacity = isLight ? '0.35' : '0.45';
  const areaOpacity2 = isLight ? '0.06' : '0.03';

  const incDots = days.map((d, i) => {
    if (d.inc <= 0) return '';
    const cy = PT + chartH - (d.inc / maxVal) * chartH;
    return `<circle cx="${(i * step).toFixed(1)}" cy="${cy.toFixed(1)}" r="3.5" fill="#34d399" opacity="0.9"/>`;
  }).join('');

  const svgHtml = `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">
      <defs>
        <linearGradient id="spkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f87171" stop-opacity="${areaOpacity}"/>
          <stop offset="100%" stop-color="#f87171" stop-opacity="${areaOpacity2}"/>
        </linearGradient>
        <linearGradient id="spkLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#fb923c"/>
          <stop offset="60%" stop-color="#f87171"/>
          <stop offset="100%" stop-color="${isLight ? '#6366f1' : '#818cf8'}"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#spkGrad)"/>
      ${avgDaily > 0 ? `<line x1="0" y1="${avgY.toFixed(1)}" x2="${W}" y2="${avgY.toFixed(1)}" stroke="${avgStroke}" stroke-width="1" stroke-dasharray="4 3"/>` : ''}
      <path d="${linePath}" fill="none" stroke="url(#spkLine)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${incDots}
      <line x1="${todayPt.x.toFixed(1)}" y1="0" x2="${todayPt.x.toFixed(1)}" y2="${H}" stroke="${todayLine}" stroke-width="1.5" stroke-dasharray="3 2"/>
      ${todayExp > 0 ? `<circle cx="${todayPt.x.toFixed(1)}" cy="${todayPt.y.toFixed(1)}" r="4.5" fill="${todayDot}" stroke="${dotStroke}" stroke-width="1.5"/>` : ''}
    </svg>`;

  const labelsHtml = days.map((d, i) => {
    if (i % 2 !== 0 && !d.isToday) return `<div style="flex:1"></div>`;
    const col = d.isToday ? tToday : d.isWeekend ? tWeekend : tDim;
    const fw = d.isToday ? '800' : '600';
    return `<div style="flex:1;text-align:center;font-size:8.5px;font-weight:${fw};color:${col}">${d.isToday ? '오늘' : d.dow}</div>`;
  }).join('');

  const todayColor = todayExp > 0 ? '#f87171' : todayInc > 0 ? '#34d399' : tDim;
  const todayStr = todayExp > 0 ? `-${fmtShort(todayExp)}` : todayInc > 0 ? `+${fmtShort(todayInc)}` : '없음';

  el.innerHTML = `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:9px;font-weight:700;color:${tLabel};letter-spacing:0.5px;text-transform:uppercase">14일 지출 패턴</span>
          ${avgDaily > 0 ? `<span style="font-size:9px;color:${tDim}">평균 ${fmtShort(avgDaily)}/일</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="display:flex;align-items:center;gap:3px">
            <span style="display:inline-block;width:10px;height:2.5px;background:linear-gradient(90deg,#fb923c,#f87171);border-radius:2px"></span>
            <span style="font-size:8.5px;color:${tLabel}">지출</span>
          </div>
          <div style="display:flex;align-items:center;gap:3px">
            <span style="display:inline-block;width:7px;height:7px;background:#34d399;border-radius:50%"></span>
            <span style="font-size:8.5px;color:${tLabel}">수입</span>
          </div>
          <span style="font-size:9.5px;font-weight:800;color:${todayColor}">오늘 ${todayStr}</span>
        </div>
      </div>
      ${svgHtml}
      <div style="display:flex;margin-top:4px">${labelsHtml}</div>
    </div>`;
}

// ════════════════════════════════════════════════════════
// 오늘의 소비 타임라인
// ════════════════════════════════════════════════════════
function _renderTodayTimeline() {
  const el = document.getElementById('today-timeline');
  if (!el) return;
  const dk = dateKey(today());
  const items = (state.ledgerData?.[dk] || []).filter(i => i.type === 'expense');
  if (!items.length) {
    el.innerHTML = `<div style="text-align:center;padding:14px 0 8px;color:var(--text3);font-size:12px">오늘 지출 기록이 없어요 ✨</div>`;
    return;
  }
  const totalExp = items.reduce((s, i) => s + i.amount, 0);
  el.innerHTML = `
    <div class="card" style="padding:12px 14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:14px">🕐</span>
        <div style="font-size:12px;font-weight:800;color:var(--text)">오늘의 지출</div>
        <span style="font-size:11px;font-weight:700;font-family:var(--mono);color:var(--red2);margin-left:auto">-${fmtShort(totalExp)}</span>
      </div>
      ${items.slice(-4).reverse().map(i => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--border)">
          <span style="font-size:11px;width:16px;text-align:center">💸</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(i.memo || i.category || '-')}</div>
            <div style="font-size:10px;color:var(--text3)">${escapeHtml(i.category)}</div>
          </div>
          <div style="font-size:12px;font-weight:700;font-family:var(--mono);color:var(--red2);flex-shrink:0">-${fmtShort(i.amount)}</div>
        </div>`).join('')}
    </div>`;
}

// ════════════════════════════════════════════════════════
// 홈 — 이달 카테고리별 지출 분석 (home-cat-ring)
// ════════════════════════════════════════════════════════
function _renderHomeCatBreakdown() {
  const el = document.getElementById('home-cat-ring');
  if (!el) return;
  const now = today();
  const ym = `${now.getFullYear()}-${p2(now.getMonth() + 1)}`;
  const ledger = state.ledgerData || {};

  const catMap = {};
  for (const [dk, items] of Object.entries(ledger)) {
    if (!dk.startsWith(ym)) continue;
    for (const item of items) {
      if (item.type !== 'expense') continue;
      catMap[item.category] = (catMap[item.category] || 0) + item.amount;
    }
  }

  const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    el.innerHTML = `<div style="text-align:center;padding:14px 0 8px;color:var(--text3);font-size:12px">이번 달 가계부 지출 기록이 없어요</div>`;
    return;
  }

  const total = entries.reduce((s, [, v]) => s + v, 0);
  const top = entries.slice(0, 5);
  const COLORS = ['#818cf8','#34d399','#fb923c','#f472b6','#60a5fa'];
  const others = entries.slice(5).reduce((s, [, v]) => s + v, 0);

  el.innerHTML = `
    <div class="card" style="padding:12px 14px;margin-top:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:14px">📊</span>
        <div style="font-size:12px;font-weight:800;color:var(--text)">이달 카테고리별 지출</div>
        <span style="font-size:11px;font-weight:700;font-family:var(--mono);color:var(--text3);margin-left:auto">${fmtShort(total)}</span>
      </div>
      ${top.map(([cat, amt], i) => {
        const pct = Math.round((amt / total) * 100);
        return `
          <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:8px;height:8px;border-radius:2px;background:${COLORS[i]};flex-shrink:0"></div>
                <span style="font-size:11px;color:var(--text2);font-weight:600">${escapeHtml(cat)}</span>
              </div>
              <span style="font-size:10px;font-family:var(--mono);color:var(--text3)">${fmtShort(amt)} <span style="opacity:.7">${pct}%</span></span>
            </div>
            <div style="height:5px;background:var(--bg4);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${COLORS[i]};border-radius:3px;transition:width 0.6s ease"></div>
            </div>
          </div>`;
      }).join('')}
      ${others > 0 ? `<div style="font-size:10px;color:var(--text3);text-align:right;margin-top:2px">+ ${entries.length - 5}개 더 · ${fmtShort(others)}</div>` : ''}
    </div>`;
}

// ════════════════════════════════════════════════════════
// 홈
// ════════════════════════════════════════════════════════
export function renderHome() {
  const balEl = document.getElementById('balance-display');
  if (!balEl) return;

  animateNumber(balEl, state.balance, (v) => Math.abs(v) >= 10_000_000 ? fmtShort(v) : fmtFull(v));
  balEl.className = 'balance-amount' + (state.balance < state.dangerLine ? ' danger' : '');

  const tb = document.getElementById('topbar-balance');
  const balHidden = localStorage.getItem('balanceHidden') === '1';
  if (tb) {
    if (balHidden) {
      tb.textContent = '●●●';
    } else {
      animateNumber(tb, state.balance, (v) => fmtShort(v));
    }
    tb.className = 'topbar-balance-amount' + (state.balance < state.dangerLine ? ' danger' : '');
  }

  // 잔고 숨김 상태 적용
  if (typeof window._applyBalanceVisibility === 'function') {
    window._applyBalanceVisibility();
  }

  const todayYm = yyyymm(today());

  const monthlyIncome = state.entries
    .filter((e) => e.type === 'income' && e.repeat === '매월')
    .reduce((sum, e) => sum + e.amount, 0);

  const monthlyExpense = state.entries
    .filter((e) => e.type === 'expense' && e.repeat === '매월')
    .reduce((sum, e) => sum + e.amount, 0);

  const monthlyHalbu = state.entries
    .filter(
      (e) =>
        e.type === 'expense' &&
        e.category === '할부' &&
        e.repeat === '매월' &&
        (!e.endMonth || parseInt(e.endMonth, 10) >= todayYm)
    )
    .reduce((sum, e) => sum + e.amount, 0);

  const si = document.getElementById('sum-income');
  if (si) si.textContent = fmtShort(monthlyIncome);

  const se = document.getElementById('sum-expense');
  if (se) se.textContent = fmtShort(monthlyExpense);

  const sh = document.getElementById('sum-halbu');
  if (sh) sh.textContent = fmtShort(monthlyHalbu);

  const monthPrefix = `${today().getFullYear()}-${p2(today().getMonth() + 1)}`;
  const { expense: checkTotal } = getLedgerMonth(today().getFullYear(), today().getMonth());
  const prevMonthDate = new Date(today().getFullYear(), today().getMonth() - 1, 1);
  const { expense: prevCheckTotal } = getLedgerMonth(prevMonthDate.getFullYear(), prevMonthDate.getMonth());

  const sc = document.getElementById('sum-checkcard');
  if (sc) {
    let trendHtml = '';
    if (prevCheckTotal > 0 && checkTotal > 0) {
      const diff = checkTotal - prevCheckTotal;
      const pct = Math.round(Math.abs(diff) / prevCheckTotal * 100);
      if (pct >= 5) {
        trendHtml = diff < 0
          ? ` <span class="trend-arrow trend-down">▼${pct}%</span>`
          : ` <span class="trend-arrow trend-up">▲${pct}%</span>`;
      }
    }
    sc.innerHTML = fmtShort(checkTotal) + trendHtml;
  }

  const net = monthlyIncome - monthlyExpense;
  const netEl = document.getElementById('sum-net');
  if (netEl) {
    netEl.textContent = fmtSigned(net);
    netEl.className = 'summary-item-value ' + (net >= 0 ? 'green' : 'red');
  }

  const insightEl = document.getElementById('balance-insight');
  if (insightEl) {
    insightEl.textContent =
      state.balance < state.dangerLine
        ? '주의가 필요해요. 잔고가 위험 기준선 아래입니다.'
        : net > 0
          ? '좋아요. 월 순현금이 플러스 흐름을 유지하고 있어요.'
          : '고정 지출 비중이 높아요. 지출 구조를 점검해보세요.';
  }

  // ── 이번달 가계부 통계 (잔고 카드 내 3분할) ──────────────
  const heroStatsEl = document.getElementById('hero-month-stats');
  if (heroStatsEl) {
    const { expense: mExp, income: mInc } = getLedgerMonth(today().getFullYear(), today().getMonth());
    const savRate = mInc > 0 ? Math.max(0, Math.round((1 - mExp / mInc) * 100)) : (mExp === 0 ? 0 : -1);
    const savColor = savRate >= 20 ? 'var(--green2)' : savRate >= 0 ? '#fbbf24' : 'var(--red2)';
    heroStatsEl.innerHTML = `
      <div class="hero-stats-row">
        <div class="hero-stat-item">
          <div class="hero-stat-lbl">이번달 수입</div>
          <div class="hero-stat-val" style="color:var(--green2)">+${mInc > 0 ? mInc.toLocaleString('ko-KR') : '0'}</div>
        </div>
        <div class="hero-stat-sep"></div>
        <div class="hero-stat-item">
          <div class="hero-stat-lbl">이번달 지출</div>
          <div class="hero-stat-val" style="color:var(--red2)">-${mExp > 0 ? mExp.toLocaleString('ko-KR') : '0'}</div>
        </div>
        <div class="hero-stat-sep"></div>
        <div class="hero-stat-item">
          <div class="hero-stat-lbl">저축률</div>
          <div class="hero-stat-val" style="color:${savColor}">${savRate >= 0 ? savRate + '%' : '-'}</div>
        </div>
      </div>`;
  }

  // ── 정보 칩 (월급 D-Day, 할부 종료 임박, 예산 여유) ──────
  const chipsEl = document.getElementById('home-chips');
  if (chipsEl) {
    const salaryEntry = state.entries.find(
      (e) => e.type === 'income' && e.category === '월급' && e.repeat === '매월' && e.day,
    );
    let chips = '';
    if (salaryEntry) {
      const t = today();
      let next = new Date(t.getFullYear(), t.getMonth(), salaryEntry.day);
      if (next <= t) next = new Date(t.getFullYear(), t.getMonth() + 1, salaryEntry.day);
      const diff = Math.round((next - t) / 86400000);
      chips += `<span class="info-chip ${diff === 0 ? 'success' : ''}" data-chip="salary" style="cursor:pointer">💰 ${diff === 0 ? '오늘 월급날!' : `월급까지 D-${diff}`}</span>`;
    }
    const nextYm = yyyymm(new Date(today().getFullYear(), today().getMonth() + 1, 1));
    const endingHalbu = state.entries.filter(
      (e) =>
        e.type === 'expense' &&
        e.category === '할부' &&
        e.endMonth &&
        (parseInt(e.endMonth, 10) === todayYm || parseInt(e.endMonth, 10) === nextYm),
    );
    if (endingHalbu.length > 0) {
      chips += `<span class="info-chip success" data-chip="halbu" style="cursor:pointer">✅ 할부 ${endingHalbu.length}건 종료 임박</span>`;
    }
    if (monthlyIncome > 0) {
      const remaining = monthlyIncome - monthlyExpense - checkTotal;
      chips += `<span class="info-chip ${remaining < 0 ? 'warning' : ''}" data-chip="space" style="cursor:pointer">📊 여유 ${remaining >= 0 ? fmtShort(remaining) : '-' + fmtShort(-remaining)}</span>`;
    }
    chipsEl.innerHTML = chips;
    chipsEl.style.display = chips ? 'flex' : 'none';
  }

  // ── 요약카드 서브라벨 ──────────────────────────────────
  const incomeCount = state.entries.filter((e) => e.type === 'income' && e.repeat === '매월').length;
  const siSub = document.getElementById('sum-income-sub');
  if (siSub) siSub.textContent = `${incomeCount}개 항목`;

  const expPct = monthlyIncome > 0 ? Math.round((monthlyExpense / monthlyIncome) * 100) : 0;
  const seSub = document.getElementById('sum-expense-sub');
  if (seSub) seSub.textContent = `수입의 ${expPct}%`;

  const halbuCount = state.entries.filter(
    (e) =>
      e.type === 'expense' &&
      e.category === '할부' &&
      e.repeat === '매월' &&
      (!e.endMonth || parseInt(e.endMonth, 10) >= todayYm),
  ).length;
  const shSub = document.getElementById('sum-halbu-sub');
  if (shSub) shSub.textContent = `${halbuCount}건 진행중`;

  const netSub = document.getElementById('sum-net-sub');
  if (netSub) netSub.textContent = net >= 0 ? '✓ 흑자 유지' : '⚠ 지출 초과';

  const checkDays = Object.keys(state.ledgerData || {}).filter(dk => dk.startsWith(monthPrefix) && (state.ledgerData[dk] || []).length > 0).length;
  const scSub = document.getElementById('sum-checkcard-sub');
  if (scSub) scSub.textContent = `${checkDays}일 기록`;

  // 오늘 지출 chip 추가
  const todayKey  = dateKey(today());
  const { expense: todayExp, income: todayInc } = getLedgerDay(todayKey);
  if (todayExp > 0 || todayInc > 0) {
    const todayChip = `<span class="info-chip" data-chip="today" style="cursor:pointer">💸 오늘 ${todayExp > 0 ? fmtShort(todayExp) + ' 지출' : '무지출'}${todayInc > 0 ? (todayExp > 0 ? ' / ' : '') + fmtShort(todayInc) + ' 수입' : ''}</span>`;
    if (chipsEl) chipsEl.innerHTML = todayChip + (chipsEl.innerHTML || '');
  }

  const fillEl = document.getElementById('checkcard-budget-fill');
  if (fillEl && monthlyIncome > 0) {
    const spendable = Math.max(monthlyIncome - monthlyExpense, 1);
    const pct = Math.min(100, Math.round((checkTotal / spendable) * 100));
    fillEl.style.width = `${pct}%`;
    fillEl.style.background = pct >= 100 ? 'var(--red2)' : pct >= 80 ? 'var(--orange)' : 'var(--green2)';
  }

  _renderSparkline();
  _renderTodayTimeline();
  _renderHomeCatBreakdown();
  renderHomeBudgetBars();
  renderHomeForecastWidget();
  renderWeeklyCard();
  _renderHomeInsights();
  _renderMonthlyRecap();
  _renderAnomalyCard();
  _renderBillRemind();

  // ── 재정 건강 점수 미니 카드 (SVG 링 + 카운트업) ─────
  const miniScoreEl = document.getElementById('health-score-mini');
  if (miniScoreEl) {
    const cf = _calcMonthCF(today());
    const hs = _calcHealthScore(cf);
    const r = 20, cx = 26, cy = 26;
    const circ = 2 * Math.PI * r;
    const dash = (hs.score / 100) * circ;
    miniScoreEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px">
        <div style="position:relative;flex-shrink:0;width:52px;height:52px">
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4"/>
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${hs.color}" stroke-width="4"
              stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
              stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
              style="transition:stroke-dasharray 0.8s ease"/>
          </svg>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;line-height:1">
            <div id="health-score-num" style="font-size:15px;font-weight:900;color:${hs.color};font-family:var(--mono)">0</div>
          </div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:5px">
            <span style="font-size:15px;font-weight:800;color:${hs.color}">${hs.grade}등급</span>
            <span style="font-size:12px;color:var(--text2)">${hs.label}</span>
            <span style="font-size:10px;color:var(--text3);margin-left:auto">분석 탭 →</span>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <span style="font-size:10px;color:var(--text3)">저축률 <span style="color:${hs.savingsRate >= 20 ? 'var(--green2)' : hs.savingsRate >= 0 ? 'var(--yellow)' : 'var(--red2)'};font-weight:700">${hs.savingsRate}%</span></span>
            <span style="font-size:10px;color:var(--text3)">스트릭 <span style="color:${hs.streak >= 7 ? 'var(--green2)' : hs.streak >= 3 ? 'var(--yellow)' : 'var(--text2)'};font-weight:700">${hs.streak}일</span></span>
            <span style="font-size:10px;color:var(--text3)">${hs.budgetCompliance !== null ? `예산준수 <span style="color:${hs.budgetCompliance >= 80 ? 'var(--green2)' : hs.budgetCompliance >= 50 ? 'var(--yellow)' : 'var(--red2)'};font-weight:700">${hs.budgetCompliance}%</span>` : `할부비중 <span style="font-weight:700">${hs.halbuPct}%</span>`}</span>
          </div>
        </div>
      </div>`;
    // 카운트업 애니메이션
    const numEl = document.getElementById('health-score-num');
    if (numEl) animateNumber(numEl, hs.score, v => Math.round(v).toString());
  }

  // ── 하우스 레벨 & 스트릭 ───────────────────────────────
  renderHouseLevel();
  renderStreak();

  const fc = buildForecast(365);
  const firstDanger = fc.find((f) => f.balance < state.dangerLine);

  const warningEl = document.getElementById('balance-warning');
  if (warningEl) {
    warningEl.style.display = firstDanger ? 'flex' : 'none';
    const warningText = document.getElementById('balance-warning-text');
    if (warningText && firstDanger) {
      warningText.textContent = `${firstDanger.date.getMonth() + 1}/${firstDanger.date.getDate()} 이후 잔고 위험 예상`;
    }
  }

  const dangerDays = fc.filter(
    (f) => f.balance < state.dangerLine && (f.income > 0 || f.expense > 0)
  );

  const alertEl = document.getElementById('alert-banner');
  if (alertEl) {
    if (dangerDays.length > 0) {
      alertEl.style.display = 'block';
      const list = dangerDays
        .slice(0, 3)
        .map((d) => `${d.date.getMonth() + 1}/${d.date.getDate()}(${fmtShort(d.balance)})`)
        .join(', ');

      alertEl.innerHTML = `🚨 앞으로 365일 중 <strong>${dangerDays.length}번</strong> 잔고 부족 예상 — ${list}${dangerDays.length > 3 ? ` 외 ${dangerDays.length - 3}건` : ''}`;
    } else {
      alertEl.style.display = 'none';
    }
  }

  // ── 최근 거래 (홈 탭) ──────────────────────────────────
  const recentEl = document.getElementById('home-recent-tx');
  if (recentEl && state.ledgerData) {
    const RECENT_ICONS = {
      '식비':'🍽️','카페':'☕','교통':'🚇','쇼핑':'🛍️','엔터':'🎬','병원':'🏥',
      '편의점':'🏪','배달':'📦','술':'🍺','미용':'✂️','운동':'💪','통신':'📱',
      '주거':'🏠','교육':'📚','여행':'✈️','문화':'🎭','구독':'📺',
    };
    const allItems = [];
    for (const [dk, items] of Object.entries(state.ledgerData)) {
      for (const item of items) {
        allItems.push({ ...item, _dk: dk });
      }
    }
    allItems.sort((a, b) => b._dk.localeCompare(a._dk));
    const recent = allItems.slice(0, 5);
    if (!recent.length) {
      recentEl.style.display = 'none';
    } else {
      recentEl.style.display = '';
      const rows = recent.map((item, i) => {
        const icon = RECENT_ICONS[item.category] || (item.type === 'income' ? '💰' : '💳');
        const label = item.memo || item.category || '기타';
        const dateStr = item._dk.slice(5).replace('-', '/');
        const quickData = JSON.stringify({ type: item.type, category: item.category, amount: item.amount, memo: item.memo || '' });
        return `<div class="recent-tx-row stagger-item" style="${i > 0 ? 'border-top:1px solid var(--border);' : ''}--stagger-idx:${i}">
          <span class="recent-tx-icon">${icon}</span>
          <div class="recent-tx-info">
            <div class="recent-tx-name">${escapeHtml(label)}</div>
            <div class="recent-tx-meta">${dateStr} · ${escapeHtml(item.category || '')}</div>
          </div>
          <div class="recent-tx-amount ${item.type === 'income' ? 'green' : 'red'}">${item.type === 'income' ? '+' : '-'}${fmtShort(item.amount)}</div>
          <button class="btn-quick-add" data-item='${quickData.replace(/'/g, "&#39;")}' title="오늘 똑같이 추가" style="flex-shrink:0;margin-left:8px;width:28px;height:28px;border-radius:8px;border:1px solid rgba(96,165,250,0.25);background:rgba(59,130,246,0.10);color:#60a5fa;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">+</button>
        </div>`;
      }).join('');
      recentEl.innerHTML = `
        <div class="home-section-hdr" style="cursor:pointer" data-action="ledger">최근 지출 <span style="color:var(--text3);font-size:10px;font-weight:400">가계부 →</span></div>
        <div class="card" style="padding:0;overflow:hidden">${rows}</div>`;
    }
  }

  const upcoming = fc.slice(0, 30).filter((f) => f.income > 0 || f.expense > 0);
  const ul = document.getElementById('upcoming-list');
  if (!ul) return;

  if (!upcoming.length) {
    ul.innerHTML = '<div class="empty-state">앞 30일 이벤트 없음</div>';
    return;
  }

  ul.innerHTML = upcoming
    .map((f, i) => {
      const isDanger = f.balance < state.dangerLine;
      const dow = f.date.getDay();
      const dayColor =
        dow === 0
          ? 'color:var(--red2)'
          : dow === 6
            ? 'color:var(--accent2)'
            : 'color:var(--text3)';

      return `
        <div class="event-row stagger-item" data-forecast-idx="${i}" style="--stagger-idx:${Math.min(i,8)}">
          <div class="event-left">
            <span class="event-date">${f.date.getMonth() + 1}/${p2(f.date.getDate())}</span>
            <span class="event-day" style="${dayColor}">${DAYS_KR[dow]}</span>
            <div class="event-tags">
              ${f.events
                .slice(0, 2)
                .map((ev) => `<span class="event-tag">${escapeHtml(ev.name)}</span>`)
                .join('')}
              ${f.events.length > 2 ? `<span class="event-tag">+${f.events.length - 2}</span>` : ''}
            </div>
          </div>
          <div class="event-right">
            ${f.income > 0 ? `<div class="event-delta money-strong" style="color:var(--green2)">${fmtSigned(f.income)}</div>` : ''}
            ${f.expense > 0 ? `<div class="event-delta money-strong" style="color:var(--red2)">${fmtSigned(-f.expense)}</div>` : ''}
            <div class="event-bal" style="color:${isDanger ? 'var(--orange)' : 'var(--text3)'}">→ ${fmtShort(f.balance)}</div>
          </div>
        </div>
      `;
    })
    .join('');
}

// ════════════════════════════════════════════════════════
// 예측
// ════════════════════════════════════════════════════════
export function setChartPeriod(days, btn) {
  _chartPeriod = days;
  document.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  renderForecast();
}

export function setForecastFilter(filter, btn) {
  _forecastFilter = filter;
  document
    .querySelectorAll('#page-forecast .filter-tab')
    .forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  renderForecastTable();
}

export function renderForecast() {
  renderForecastInsights();
  renderForecastChart();
  renderMonthlyChart();
  renderForecastTable();
}

function renderForecastInsights() {
  const card = document.getElementById('forecast-insights-card');
  const contentEl = document.getElementById('forecast-insights-content');
  if (!card || !contentEl) return;

  const fc = buildForecast(365);
  const dangerDays = fc.filter((f) => f.balance < state.dangerLine && (f.income > 0 || f.expense > 0));
  const topExpense = fc.filter((f) => f.expense > 0).sort((a, b) => b.expense - a.expense)[0];

  if (dangerDays.length === 0 && !topExpense) {
    card.style.display = 'none';
    return;
  }

  card.style.display = '';
  let html = '';

  if (dangerDays.length > 0) {
    html += `<div style="margin-bottom:${topExpense ? '12px' : '0'}">
      <div style="font-size:10px;color:var(--text3);font-weight:700;letter-spacing:0.8px;margin-bottom:6px">⚠️ 위험 예상일 (${dangerDays.length}건)</div>`;
    html += dangerDays
      .slice(0, 5)
      .map(
        (f) =>
          `<div class="danger-day-row">
            <span class="danger-day-date">${f.date.getMonth() + 1}/${f.date.getDate()}</span>
            <span class="danger-day-balance">${fmtShort(f.balance)}</span>
          </div>`,
      )
      .join('');
    if (dangerDays.length > 5)
      html += `<div style="font-size:11px;color:var(--text3);padding-top:5px">외 ${dangerDays.length - 5}건 더</div>`;
    html += '</div>';
  }

  if (topExpense) {
    const names = topExpense.events
      .slice(0, 2)
      .map((e) => escapeHtml(e.name))
      .join(', ');
    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--border)">
      <div>
        <div style="font-size:10px;color:var(--text3);font-weight:700;letter-spacing:0.8px">💸 최대 지출일</div>
        <div style="font-size:12px;color:var(--text);margin-top:2px">${topExpense.date.getMonth() + 1}/${topExpense.date.getDate()} · ${names}</div>
      </div>
      <span style="font-family:var(--mono);font-size:14px;font-weight:800;color:var(--red2)">-${fmtShort(topExpense.expense)}</span>
    </div>`;
  }

  contentEl.innerHTML = html;
}

export function renderForecastChart() {
  const el = document.getElementById('forecast-chart');
  if (!el) return;
  const fc = buildForecast(_chartPeriod);
  if (!fc.length) { el.innerHTML = ''; return; }

  const vals = fc.map((f) => f.balance);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, state.dangerLine);
  const range = max - min || 1;

  const W = 560, H = 168;
  const pT = 14, pR = 14, pB = 36, pL = 52;
  const cW = W - pL - pR, cH = H - pT - pB;

  el.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const px = (i) => pL + (i / Math.max(fc.length - 1, 1)) * cW;
  const py = (v) => pT + cH - ((v - min) / range) * cH;

  const coords = fc.map((f, i) => [px(i), py(f.balance)]);

  function smoothPath(points) {
    if (points.length < 2) return `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
    let d = `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  const linePath = smoothPath(coords);
  const bottomY = (pT + cH).toFixed(1);
  const areaPath = `${linePath} L ${(pL + cW).toFixed(1)},${bottomY} L ${pL.toFixed(1)},${bottomY} Z`;

  let gridHtml = '';
  const tickCount = 4;
  for (let t = 0; t <= tickCount; t++) {
    const v = min + (range / tickCount) * t;
    const y = py(v).toFixed(1);
    gridHtml += `
      <line x1="${pL}" y1="${y}" x2="${W - pR}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
      <text x="${pL - 6}" y="${(parseFloat(y) + 3.5).toFixed(1)}" fill="var(--text3)" font-size="9" text-anchor="end" font-family="monospace">${fmtShort(v)}</text>`;
  }

  const dangerY = py(state.dangerLine);
  const zeroY = py(0);
  let dangerHtml = '';
  if (state.dangerLine > min && state.dangerLine <= max) {
    dangerHtml = `
      <rect x="${pL}" y="${dangerY.toFixed(1)}" width="${cW}" height="${Math.max(0, zeroY - dangerY).toFixed(1)}" fill="rgba(249,115,22,0.06)"/>
      <line x1="${pL}" y1="${dangerY.toFixed(1)}" x2="${W - pR}" y2="${dangerY.toFixed(1)}" stroke="#f97316" stroke-width="1.2" stroke-dasharray="4 3"/>
      <text x="${pL + 4}" y="${(dangerY - 4).toFixed(1)}" fill="#f97316" font-size="8.5" font-family="monospace">위험</text>`;
  }

  const step = _chartPeriod <= 30 ? 7 : _chartPeriod <= 90 ? 14 : 30;
  let dateLabels = '';
  fc.forEach((f, i) => {
    if (i % step !== 0 && i !== fc.length - 1) return;
    dateLabels += `<text x="${px(i).toFixed(1)}" y="${H - 4}" fill="var(--text3)" font-size="9" text-anchor="middle" font-family="monospace">${f.date.getMonth() + 1}/${f.date.getDate()}</text>`;
  });

  let dots = '';
  fc.forEach((f, i) => {
    if (!f.income && !f.expense) return;
    const fill = f.balance < state.dangerLine ? '#ef4444' : f.income > 0 ? '#10b981' : '#f87171';
    dots += `<circle cx="${px(i).toFixed(1)}" cy="${py(f.balance).toFixed(1)}" r="2.5" fill="${fill}" opacity="0.9"/>`;
  });

  el.innerHTML = `
    <defs>
      <linearGradient id="fcLineGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#3b82f6"/>
        <stop offset="100%" stop-color="#818cf8"/>
      </linearGradient>
      <linearGradient id="fcAreaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.01"/>
      </linearGradient>
      <clipPath id="fcClip">
        <rect x="${pL}" y="${pT}" width="${cW}" height="${cH}"/>
      </clipPath>
    </defs>
    ${gridHtml}
    ${dangerHtml}
    <path d="${areaPath}" fill="url(#fcAreaGrad)" clip-path="url(#fcClip)"/>
    <path d="${linePath}" fill="none" stroke="url(#fcLineGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#fcClip)"/>
    ${dots}
    ${dateLabels}`;
}

export function renderMonthlyChart() {
  const now = today();
  const months = [];

  for (let i = -2; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = yyyymm(d);
    const ymStr = String(ym);

    const income = state.entries
      .filter(
        (e) =>
          e.type === 'income' &&
          e.repeat === '매월' &&
          (!e.endMonth || parseInt(e.endMonth, 10) >= ym)
      )
      .reduce((sum, e) => sum + e.amount, 0);

    const expense = state.entries
      .filter(
        (e) =>
          e.type === 'expense' &&
          e.repeat === '매월' &&
          (!e.endMonth || parseInt(e.endMonth, 10) >= ym)
      )
      .reduce((sum, e) => sum + e.amount, 0);

    const cd = state.cardData[ymStr] || {};

    months.push({
      label: `${d.getMonth() + 1}월`,
      income,
      expense: expense + (cd.hyundai || 0) + (cd.kookmin || 0),
    });
  }

  const maxVal = Math.max(...months.map((m) => Math.max(m.income, m.expense)), 1);
  const el = document.getElementById('monthly-chart');
  if (!el) return;

  el.innerHTML = `
    <div class="monthly-chart-bar">
      ${months
        .map(
          (m) => `
            <div>
              <div style="font-size:9px;color:var(--text3);margin-bottom:4px;font-weight:600">${m.label}</div>
              <div class="bar-row">
                <span class="bar-label" style="color:var(--green2)">수입</span>
                <div class="bar-track">
                  <div class="bar-fill income" style="width:${((m.income / maxVal) * 100).toFixed(1)}%"></div>
                </div>
                <span class="bar-value" style="color:var(--green2)">${fmtShort(m.income)}</span>
              </div>
              <div class="bar-row">
                <span class="bar-label" style="color:var(--red2)">지출</span>
                <div class="bar-track">
                  <div class="bar-fill expense" style="width:${((m.expense / maxVal) * 100).toFixed(1)}%"></div>
                </div>
                <span class="bar-value" style="color:var(--red2)">${fmtShort(m.expense)}</span>
              </div>
            </div>
          `
        )
        .join('<div style="height:8px"></div>')}
    </div>
  `;
}

export function renderForecastTable() {
  const fc = buildForecast(365);
  let html = '';
  let lastMonth = -1;
  let lastYear = -1;

  for (const f of fc) {
    if (_forecastFilter === 'event' && f.income === 0 && f.expense === 0) continue;
    if (_forecastFilter === 'danger' && f.balance >= state.dangerLine) continue;

    const m = f.date.getMonth() + 1;
    const y = f.date.getFullYear();
    if (m !== lastMonth || y !== lastYear) {
      html += `<tr class="month-header"><td colspan="6">${y}년 ${m}월</td></tr>`;
      lastMonth = m;
      lastYear = y;
    }

    const isDanger = f.balance < state.dangerLine;
    const dow = f.date.getDay();
    const dayClass = 'col-day' + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '');
    const isToday = dateKey(f.date) === dateKey(today());

    html += `
      <tr class="${isDanger ? 'danger' : f.income > 0 ? 'income-row' : ''}">
        <td class="col-date" style="${isToday ? 'font-weight:700;color:var(--accent2)' : ''}">${m}/${p2(f.date.getDate())}</td>
        <td class="${dayClass}">${DAYS_KR[dow]}</td>
        <td class="col-in">${f.income > 0 ? fmtShort(f.income) : '-'}</td>
        <td class="col-out">${f.expense > 0 ? fmtShort(f.expense) : '-'}</td>
        <td class="col-bal${isDanger ? ' danger' : ''}">${fmtShort(f.balance)}</td>
        <td class="col-status">${isDanger ? '⚠️' : f.income && f.expense ? '💰💳' : f.income ? '💰' : f.expense ? '💳' : '-'}</td>
      </tr>
    `;
  }

  const el = document.getElementById('forecast-tbody');
  if (el) el.innerHTML = html;
}

// ════════════════════════════════════════════════════════
// 수입/지출 목록
// ════════════════════════════════════════════════════════
export function setEntryFilter(filter, btn) {
  _entryFilter = filter;
  document
    .querySelectorAll('#page-entries .filter-tab')
    .forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  renderEntries();
}

export function renderSubscriptionRadar() {
  const el = document.getElementById('subscription-radar');
  if (!el) return;
  const SUB_CATS = new Set(['구독', '인터넷·통신', '보험']);
  const subs = state.entries.filter(e =>
    e.type === 'expense' && e.repeat === '매월' && SUB_CATS.has(e.category)
  );
  if (!subs.length) { el.innerHTML = ''; return; }
  const total = subs.reduce((s, e) => s + e.amount, 0);
  el.innerHTML = `
    <div class="card" style="border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.06)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:16px">📡</span>
        <div>
          <div style="font-size:13px;font-weight:800;color:var(--text)">구독/정기결제 레이더</div>
          <div style="font-size:10px;color:var(--text3);margin-top:1px">혹시 안 쓰는 구독 있지 않나요?</div>
        </div>
        <div style="margin-left:auto;text-align:right">
          <div style="font-size:11px;color:var(--text3)">월 합계</div>
          <div style="font-size:15px;font-weight:900;font-family:var(--mono);color:var(--yellow)">${fmtShort(total)}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${subs.map(e => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg3);border-radius:10px">
            <span style="font-size:14px">${e.category === '구독' ? '📺' : e.category === '인터넷·통신' ? '📱' : '🛡️'}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:700;color:var(--text)">${escapeHtml(e.name)}</div>
              <div style="font-size:10px;color:var(--text3)">${escapeHtml(e.category)} · 매월 ${e.day || '-'}일</div>
            </div>
            <div style="font-size:13px;font-weight:800;font-family:var(--mono);color:var(--red2)">-${fmtShort(e.amount)}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

export function renderEntries() {
  renderSubscriptionRadar();
  const container = document.getElementById('entries-list');
  if (!container) return;

  // ── 수입지출 요약 헤더 ─────────────────────────────────
  const summaryBar = document.getElementById('entries-summary-bar');
  if (summaryBar) {
    const mIncome = state.entries
      .filter((e) => e.type === 'income' && e.repeat === '매월')
      .reduce((s, e) => s + e.amount, 0);
    const mExpense = state.entries
      .filter((e) => e.type === 'expense' && e.repeat === '매월')
      .reduce((s, e) => s + e.amount, 0);
    const netFlow = mIncome - mExpense;
    summaryBar.innerHTML = `
      <div class="entries-summary-item">
        <div class="entries-summary-label">총 항목</div>
        <div class="entries-summary-value">${state.entries.length}<span style="font-size:10px;color:var(--text3)">개</span></div>
      </div>
      <div class="entries-summary-item">
        <div class="entries-summary-label">월 수입</div>
        <div class="entries-summary-value" style="color:var(--green2)">${fmtShort(mIncome)}</div>
      </div>
      <div class="entries-summary-item">
        <div class="entries-summary-label">월 지출</div>
        <div class="entries-summary-value" style="color:var(--red2)">${fmtShort(mExpense)}</div>
      </div>
      <div class="entries-summary-item">
        <div class="entries-summary-label">순현금흐름</div>
        <div class="entries-summary-value" style="color:${netFlow >= 0 ? 'var(--green2)' : 'var(--red2)'}">${fmtSigned(netFlow)}</div>
      </div>
    `;
    summaryBar.style.display = 'flex';
  }

  let entries = [...state.entries];

  if (_entryFilter === '수입') {
    entries = entries.filter((e) => e.type === 'income');
  } else if (_entryFilter === '지출') {
    entries = entries.filter((e) => e.type === 'expense' && e.category !== '할부');
  } else if (_entryFilter === '할부') {
    entries = entries.filter((e) => e.category === '할부');
  }

  if (!entries.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-illu">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
        </svg>
      </div>
      <div class="empty-state-title">고정 항목 없음</div>
      <div class="empty-state-desc">월급·구독·보험 등 매달 반복되는<br>수입/지출을 여기에 등록하세요</div>
    </div>`;
    return;
  }

  const todayYm = yyyymm(today());

  entries.sort(
    (a, b) =>
      (a.type === 'income' ? 0 : a.category === '할부' ? 2 : 1) -
        (b.type === 'income' ? 0 : b.category === '할부' ? 2 : 1) ||
      (a.day || 0) - (b.day || 0)
  );

  let html = '';
  let lastGroup = '';

  for (const e of entries) {
    const group = e.type === 'income' ? '▲ 수입' : e.category === '할부' ? '💳 할부' : '▼ 지출';

    if (group !== lastGroup) {
      html += `<div class="entry-group-label">${group}</div>`;
      lastGroup = group;
    }

    const isEnded = e.endMonth && parseInt(e.endMonth, 10) < todayYm;
    const cardInfo = e.card ? getCards().find(c => c.id === e.card || c.name === e.card) : null;
    const amtClass = e.type === 'income' ? 'income' : e.category === '할부' ? 'halbu-h' : 'expense';
    const cardBadge = cardInfo
      ? `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:6px;font-size:9px;font-weight:800;background:${cardInfo.color}22;color:${cardInfo.color};border:1px solid ${cardInfo.color}44;vertical-align:middle">💳 ${escapeHtml(cardInfo.name)} ${cardInfo.payDay}일</span>`
      : (e.card ? `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:6px;font-size:9px;font-weight:800;background:rgba(100,116,139,0.15);color:var(--text3);vertical-align:middle">💳 ${escapeHtml(e.card)}</span>` : '');

    const endMonthStr = escapeHtml(String(e.endMonth || ''));
    const endMonthLabel = endMonthStr.length === 6
      ? `~${endMonthStr.slice(0, 4)}/${endMonthStr.slice(4)}`
      : `~${endMonthStr}`;
    const endBadge = e.endMonth
      ? `<span class="badge ${isEnded ? 'ended' : 'halbu'}">${isEnded ? '종료' : endMonthLabel}</span>`
      : '';

    const repeatInfo = e.repeat === '매월' ? `매월 ${e.day}일` : e.repeat === '1회성' ? escapeHtml(e.date) : '격주';

    html += `
      <div class="entry-item" style="${isEnded ? 'opacity:0.45' : ''}">
        <div class="entry-left">
          <div class="entry-dot" style="background:${CAT_COLORS[e.category] || '#64748b'};color:${CAT_COLORS[e.category] || '#64748b'}"></div>
          <div class="entry-info">
            <div class="entry-name">${escapeHtml(e.name)}</div>
            <div class="entry-meta">${escapeHtml(e.category)} · ${repeatInfo} ${cardBadge} ${endBadge}</div>
          </div>
        </div>
        <div class="entry-right">
          <span class="entry-amount ${amtClass}">${e.type === 'income' ? '+' : '-'}${fmtShort(e.amount)}</span>
          <button class="icon-btn edit" data-id="${e.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/>
            </svg>
          </button>
          <button class="icon-btn del" data-id="${e.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// ════════════════════════════════════════════════════════
// 카드 탭
// ════════════════════════════════════════════════════════
export function renderCards() {
  renderCardDefs();
  renderCardMonths();
}

/** 카드 정의 목록 렌더 */
export function renderCardDefs() {
  const el = document.getElementById('card-defs-list');
  if (!el) return;
  const cards = getCards();
  if (!cards.length) {
    el.innerHTML = '<div class="empty-state" style="padding:10px 0">등록된 카드 없음</div>';
    return;
  }
  el.innerHTML = cards.map(card => `
    <div class="card-def-row" data-card-id="${escapeHtml(card.id)}">
      <div class="card-def-dot" style="background:${escapeHtml(card.color)}"></div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${escapeHtml(card.name)}</div>
        <div style="font-size:11px;color:var(--text3)">매월 ${card.payDay}일 결제</div>
      </div>
      <button class="icon-btn edit card-def-edit-btn" data-id="${escapeHtml(card.id)}" title="수정">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
      </button>
      <button class="icon-btn delete card-def-del-btn" data-id="${escapeHtml(card.id)}" title="삭제">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
    </div>
  `).join('');
}

export function renderCardMonths() {
  const t = today();
  const cards = getCards();
  let html = '';

  for (let i = -1; i <= 12; i++) {
    const d = new Date(t.getFullYear(), t.getMonth() + i, 1);
    const ym = String(yyyymm(d));
    const ymDash = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
    const m = d.getMonth() + 1;
    const cd = state.cardData[ym] || {};
    const isCurrent = d.getFullYear() === t.getFullYear() && m === t.getMonth() + 1;

    // 고정항목 합산
    const fixedByCard = {};
    for (const card of cards) {
      const fixedSum = (state.entries || [])
        .filter(e => e.type === 'expense' && e.card === card.id &&
          (!e.endMonth || yyyymm(d) <= parseInt(e.endMonth, 10)))
        .reduce((s, e) => s + Number(e.amount || 0), 0);
      fixedByCard[card.id] = fixedSum;
    }

    // 가계부에서 카드별 사용액 집계
    const ledgerByCard = {};
    for (const card of cards) {
      let ledgerSum = 0;
      for (const [dk, items] of Object.entries(state.ledgerData || {})) {
        if (!dk.startsWith(ymDash)) continue;
        for (const item of items) {
          if (item.type === 'expense' && item.cardId === card.id) {
            ledgerSum += item.amount;
          }
        }
      }
      ledgerByCard[card.id] = ledgerSum;
    }

    const totalVariable = cards.reduce((s, c) => s + Number(cd[c.id] || 0), 0);
    const totalFixed = Object.values(fixedByCard).reduce((a, b) => a + b, 0);
    const totalLedger = Object.values(ledgerByCard).reduce((a, b) => a + b, 0);
    const grandTotal = totalVariable + totalFixed + totalLedger;

    const cardInputs = cards.map(card => {
      const varAmt = cd[card.id] || 0;
      const fixedAmt = fixedByCard[card.id] || 0;
      const ledgerAmt = ledgerByCard[card.id] || 0;
      const totalCard = fixedAmt + varAmt + ledgerAmt;
      return `
        <div style="margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
            <div style="width:8px;height:8px;border-radius:50%;background:${escapeHtml(card.color)};flex-shrink:0"></div>
            <div style="font-size:12px;font-weight:700;color:var(--text2)">${escapeHtml(card.name)} <span style="font-weight:400;color:var(--text3)">(${card.payDay}일)</span></div>
            ${totalCard > 0 ? `<span style="margin-left:auto;font-size:12px;font-weight:900;font-family:var(--mono);color:var(--text)">-${fmtShort(totalCard)}</span>` : ''}
          </div>
          ${fixedAmt > 0 ? `<div style="font-size:10px;color:var(--text3);margin-bottom:3px;padding-left:14px">고정 자동합산: <span style="color:var(--accent2);font-weight:700">${fmtShort(fixedAmt)}</span></div>` : ''}
          ${ledgerAmt > 0 ? `<div style="font-size:10px;color:var(--green2);margin-bottom:3px;padding-left:14px;font-weight:700">📒 가계부 기록: ${fmtShort(ledgerAmt)}</div>` : ''}
          <div style="font-size:10px;color:var(--text3);margin-bottom:3px;padding-left:14px">추가 입력 (식비·쇼핑 등)</div>
          <input class="card-num-input" type="number" value="${varAmt || ''}" placeholder="0" inputmode="numeric"
            data-ym="${ym}" data-card="${escapeHtml(card.id)}"
            style="border-color:${escapeHtml(card.color)};border-width:1.5px">
        </div>
      `;
    }).join('');

    html += `
      <div class="card-month-item ${isCurrent ? 'current' : ''}">
        <div class="card-month-header">
          <span class="card-month-label">${d.getFullYear()}년 ${m}월 ${isCurrent ? '<span style="font-size:10px;color:var(--accent2)">(이번달)</span>' : ''}</span>
          <span class="card-month-total">${grandTotal > 0 ? '-' + fmtShort(grandTotal) : '-'}</span>
        </div>
        <div class="card-inputs" style="flex-direction:column">
          ${cardInputs}
        </div>
      </div>
    `;
  }

  const el = document.getElementById('card-months-list');
  if (el) el.innerHTML = html;
}

// ════════════════════════════════════════════════════════
// 가계부 탭
// ════════════════════════════════════════════════════════
export function renderLedger() {
  if (_ledgerSubTab === 'stats') {
    renderLedgerStats();
  } else if (_ledgerSubTab === 'forecast') {
    renderLedgerForecast();
  } else {
    renderLedgerCalendar();
  }
  // 탭 전환 시 fade-in
  const activeView = document.querySelector('#page-ledger [id^="ledger-view-"]:not([style*="display:none"]):not([style*="display: none"])');
  if (activeView) {
    activeView.classList.remove('tab-fade-in');
    void activeView.offsetWidth; // reflow trigger
    activeView.classList.add('tab-fade-in');
  }
}

// ── 가계부 내 예측 뷰 ──────────────────────────────────
let _lfPeriod = 30;
let _lfNavMonth = 0; // 0 = current, +1 = next, etc.

export function setLedgerForecastPeriod(days, btn) {
  _lfPeriod = days;
  document.querySelectorAll('[data-lf-period]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderLedgerForecast();
}

export function shiftLedgerForecastMonth(delta) {
  _lfNavMonth = Math.max(-12, Math.min(24, _lfNavMonth + delta));
  renderLedgerForecast();
}

export function renderLedgerForecast() {
  const fc = buildForecast(365);
  const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

  // ── 예측 요약 카드 ─────────────────────────────────────
  const summaryEl = document.getElementById('ledger-forecast-summary');
  if (summaryEl) {
    const t = today();
    const months = [0, 1].map(offset => {
      const d = new Date(t.getFullYear(), t.getMonth() + offset, 1);
      const ymNum = d.getFullYear() * 100 + (d.getMonth() + 1);
      const monthFc = fc.filter(f => f.ym === ymNum);
      const totalInc = monthFc.reduce((s, f) => s + f.income, 0);
      const totalExp = monthFc.reduce((s, f) => s + f.expense, 0);
      const net = totalInc - totalExp;
      const dangerDays = monthFc.filter(f => f.balance < (state.dangerLine || 0)).length;
      const savRate = totalInc > 0 ? Math.max(0, Math.round((1 - totalExp / totalInc) * 100)) : 0;
      return { label: `${d.getMonth() + 1}월`, totalInc, totalExp, net, dangerDays, savRate };
    });

    const allDangerDays = fc.filter(f => f.balance < (state.dangerLine || 0));
    const firstDanger = allDangerDays[0];
    const dangerCount = allDangerDays.length;
    const minDangerBal = dangerCount > 0 ? Math.min(...allDangerDays.map(f => f.balance)) : 0;

    // 30일 내 큰 지출 TOP 3
    const bigEvents = [];
    fc.slice(0, 30).forEach(f => {
      f.events.filter(e => e.type === 'expense' && e.amt >= 50_000).forEach(e => {
        bigEvents.push({ date: `${f.date.getMonth()+1}/${f.date.getDate()}`, name: e.name, amt: e.amt });
      });
    });
    bigEvents.sort((a, b) => b.amt - a.amt);
    const top3 = bigEvents.slice(0, 3);

    summaryEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        ${months.map(m => `
          <div style="background:linear-gradient(135deg,rgba(59,130,246,0.10),rgba(139,92,246,0.07));border:1px solid rgba(96,165,250,0.18);border-radius:16px;padding:14px">
            <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:0.5px;margin-bottom:8px">${m.label} 예상</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="font-size:10px;color:var(--text3)">수입</span>
              <span style="font-size:12px;font-weight:700;color:var(--green2);font-family:var(--mono)">+${fmtShort(m.totalInc)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:10px;color:var(--text3)">지출</span>
              <span style="font-size:12px;font-weight:700;color:var(--red2);font-family:var(--mono)">-${fmtShort(m.totalExp)}</span>
            </div>
            <div style="height:1px;background:rgba(255,255,255,0.07);margin:5px 0"></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-size:10px;color:var(--text3)">순액</span>
              <span style="font-size:17px;font-weight:900;font-family:var(--mono);color:${m.net >= 0 ? 'var(--green2)' : 'var(--red2)'}">${m.net >= 0 ? '+' : ''}${fmtShort(m.net)}</span>
            </div>
            <div style="display:flex;gap:5px;flex-wrap:wrap">
              <span style="font-size:9px;padding:2px 7px;border-radius:6px;background:rgba(99,102,241,0.12);color:#a78bfa;font-weight:700">${m.savRate}% 저축</span>
              ${m.dangerDays > 0
                ? `<span style="font-size:9px;padding:2px 7px;border-radius:6px;background:rgba(249,115,22,0.13);color:var(--orange);font-weight:700">⚠️ ${m.dangerDays}일 위험</span>`
                : `<span style="font-size:9px;padding:2px 7px;border-radius:6px;background:rgba(16,185,129,0.10);color:var(--green2);font-weight:700">✅ 안전</span>`}
            </div>
          </div>`).join('')}
      </div>

      ${firstDanger ? `
        <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.22);border-radius:14px;padding:13px 14px;margin-bottom:12px;display:flex;align-items:center;gap:12px">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700;color:var(--red2);margin-bottom:4px">🚨 잔고 위험 구간 예측</div>
            <div style="font-size:11px;color:var(--text2)">최초 위험일 <strong style="color:var(--orange)">${firstDanger.date.getMonth()+1}/${firstDanger.date.getDate()}일</strong></div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">최저 예상 잔고: <span style="font-family:var(--mono);color:var(--red2)">${fmtShort(minDangerBal)}</span></div>
          </div>
          <div style="text-align:center;flex-shrink:0;padding:8px 14px;background:rgba(239,68,68,0.10);border-radius:12px">
            <div style="font-size:30px;font-weight:900;font-family:var(--mono);color:var(--red2);line-height:1">${dangerCount}</div>
            <div style="font-size:9px;color:var(--text3);margin-top:2px">위험일</div>
          </div>
        </div>` : `
        <div style="background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.16);border-radius:14px;padding:13px 14px;margin-bottom:12px;display:flex;align-items:center;gap:12px">
          <div style="width:42px;height:42px;border-radius:50%;background:rgba(16,185,129,0.14);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">✅</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--green2)">365일 전 구간 안전</div>
            <div style="font-size:11px;color:var(--text3);margin-top:3px">앞으로 1년간 잔고 위험 구간 없음</div>
          </div>
        </div>`}

      ${top3.length ? `
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:14px;padding:12px 14px;margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:0.5px;margin-bottom:10px">📌 30일 내 예정 지출 TOP</div>
          ${top3.map((e, i) => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;${i < top3.length-1 ? 'border-bottom:1px solid rgba(255,255,255,0.04)' : ''}">
              <div style="width:22px;height:22px;border-radius:50%;background:rgba(239,68,68,0.10);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:var(--red2);flex-shrink:0">${i+1}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(e.name)}</div>
                <div style="font-size:10px;color:var(--text3)">${e.date}</div>
              </div>
              <div style="font-size:14px;font-weight:900;color:var(--red2);font-family:var(--mono);flex-shrink:0">-${fmtShort(e.amt)}</div>
            </div>`).join('')}
        </div>` : ''}
    `;
  }

  // ── 차트 (Catmull-Rom 베지어 곡선) ─────────────────────
  const chartEl = document.getElementById('ledger-forecast-chart');
  if (chartEl) {
    const slice = fc.slice(0, _lfPeriod);
    const vals = slice.map(f => f.balance);
    const minVal = Math.min(...vals, 0);
    const maxVal = Math.max(...vals, state.dangerLine || 0);
    const range = maxVal - minVal || 1;
    const W = 560, H = 160, PL = 54, PR = 10, PT = 14, PB = 6;
    const cW = W - PL - PR, cH = H - PT - PB;
    const px = i => PL + (i / Math.max(slice.length - 1, 1)) * cW;
    const py = v => PT + cH - ((v - minVal) / range) * cH;

    // Y축 눈금
    const yMid = (minVal + maxVal) / 2;
    const yGrid = [maxVal, yMid, minVal].map(v => `
      <line x1="${PL}" y1="${py(v).toFixed(1)}" x2="${W-PR}" y2="${py(v).toFixed(1)}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
      <text x="${PL-5}" y="${(py(v)+4).toFixed(1)}" fill="rgba(148,163,184,0.5)" font-size="8" text-anchor="end" font-family="monospace">${fmtShort(v)}</text>`).join('');

    // Catmull-Rom → 베지어
    const pts = slice.map((f, i) => [px(i), py(f.balance)]);
    let pathD = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[Math.max(0, i-2)], p1 = pts[i-1], p2 = pts[i], p3 = pts[Math.min(pts.length-1, i+1)];
      const cp1x = p1[0] + (p2[0]-p0[0])/6, cp1y = p1[1] + (p2[1]-p0[1])/6;
      const cp2x = p2[0] - (p3[0]-p1[0])/6, cp2y = p2[1] - (p3[1]-p1[1])/6;
      pathD += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    const areaD = pathD + ` L${pts[pts.length-1][0].toFixed(1)},${(PT+cH).toFixed(1)} L${PL},${(PT+cH).toFixed(1)} Z`;

    // 이벤트 점
    let dots = '';
    slice.forEach((f, i) => {
      if (!f.income && !f.expense) return;
      const fill = f.balance < (state.dangerLine||0) ? '#ef4444' : f.income > 0 ? '#10b981' : '#f87171';
      dots += `<circle cx="${px(i).toFixed(1)}" cy="${py(f.balance).toFixed(1)}" r="2.8" fill="${fill}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>`;
    });

    // 위험선
    const dangerY = py(state.dangerLine || 0);
    const dangerZone = (state.dangerLine || 0) > minVal ? `
      <rect x="${PL}" y="${dangerY.toFixed(1)}" width="${cW}" height="${Math.max(0, py(minVal)-dangerY).toFixed(1)}" fill="rgba(239,68,68,0.05)"/>
      <line x1="${PL}" y1="${dangerY.toFixed(1)}" x2="${W-PR}" y2="${dangerY.toFixed(1)}" stroke="#f97316" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.65"/>` : '';

    chartEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    chartEl.innerHTML = `
      <defs>
        <linearGradient id="fcFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.26"/>
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.01"/>
        </linearGradient>
        <linearGradient id="fcLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#a78bfa"/>
        </linearGradient>
        <clipPath id="fcClip"><rect x="${PL}" y="${PT}" width="${cW}" height="${cH+1}"/></clipPath>
      </defs>
      ${yGrid}
      ${dangerZone}
      <g clip-path="url(#fcClip)">
        <path d="${areaD}" fill="url(#fcFill)"/>
        <path d="${pathD}" fill="none" stroke="url(#fcLine)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
      </g>`;
  }

  // ── 테이블 ──────────────────────────────────────────────
  const t = today();
  const targetDate = new Date(t.getFullYear(), t.getMonth() + _lfNavMonth, 1);
  const navBtn = document.getElementById('btn-lf-month-nav');
  if (navBtn) navBtn.textContent = `${targetDate.getFullYear()}년 ${targetDate.getMonth() + 1}월`;

  const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  const endDate   = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
  const filtered  = fc.filter(f => f.date >= startDate && f.date <= endDate && (f.income > 0 || f.expense > 0));
  const tbody = document.getElementById('ledger-forecast-tbody');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:16px">해당 월에 예정 이벤트 없음</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(f => {
    const isDanger = f.balance < (state.dangerLine || 0);
    const dow = f.date.getDay();
    const names = f.events.slice(0, 2).map(e => escapeHtml(e.name)).join(', ');
    return `<tr style="${isDanger ? 'background:rgba(239,68,68,0.06)' : ''}">
      <td class="col-date">${f.date.getMonth()+1}/${p2(f.date.getDate())}</td>
      <td class="col-day${dow===0?' sun':dow===6?' sat':''}">${DAYS_KR[dow]}</td>
      <td class="col-in">${f.income > 0 ? '+'+fmtShort(f.income) : ''}</td>
      <td class="col-out">${f.expense > 0 ? '-'+fmtShort(f.expense) : ''}</td>
      <td class="col-bal${isDanger?' danger':''}">${fmtShort(f.balance)}</td>
      <td style="font-size:10px;color:var(--text3);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${names}${isDanger?' ⚠️':''}</td>
    </tr>`;
  }).join('');
}

function renderLedgerCalendar() {
  const y = currentLedgerYear;
  const m = currentLedgerMonth;

  const firstDay  = new Date(y, m, 1);
  const lastDay   = new Date(y, m + 1, 0);
  const startWd   = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const ml = document.getElementById('btn-ledger-month-label');
  if (ml) ml.textContent = `${y}년 ${m + 1}월`;

  const { expense: monthExp, income: monthInc, dayMap } = getLedgerMonth(y, m);
  const spendDays = Object.keys(dayMap).length;

  // 요약 상단 수치
  const te = document.getElementById('ledger-total-spend');
  if (te) te.textContent = fmtShort(monthExp);
  const ti = document.getElementById('ledger-total-income');
  if (ti) ti.textContent = fmtShort(monthInc);
  const tn = document.getElementById('ledger-total-net');
  if (tn) {
    const net = monthInc - monthExp;
    tn.textContent = fmtSigned(net);
    tn.style.color = net >= 0 ? 'var(--green2)' : 'var(--red2)';
  }
  const ae = document.getElementById('ledger-avg-spend');
  if (ae) ae.textContent = spendDays > 0 ? fmtShort(Math.round(monthExp / spendDays)) : '-';

  // 달력 그리드
  const maxDay = Math.max(...Object.values(dayMap), 1);
  let html = '';
  for (let i = 0; i < startWd; i++) {
    html += '<div class="ledger-day empty"></div>';
  }
  for (let day = 1; day <= totalDays; day++) {
    const d   = new Date(y, m, day);
    const dk  = dateKey(d);
    const dow = d.getDay();
    const isToday    = dk === dateKey(today());
    const isSelected = dk === _selectedLedgerDate;
    const numClass   = 'ledger-day-num' + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '');

    const { expense: dayExp, income: dayInc } = getLedgerDay(dk);
    // 히트맵: 지출 많을수록 배경 진하게
    const heatPct = maxDay > 0 ? dayExp / maxDay : 0;
    const heatLevel = heatPct > 0.8 ? 4 : heatPct > 0.5 ? 3 : heatPct > 0.25 ? 2 : heatPct > 0 ? 1 : 0;

    // 고정 항목 표시 (매월 반복 항목)
    const fixedForDay = (state.entries || []).filter(e =>
      e.repeat === '매월' && e.day === day &&
      (!e.endMonth || parseInt(e.endMonth) >= yyyymm(new Date(y, m, 1)))
    );
    const fixedHtml = fixedForDay.slice(0, 2).map(e => {
      const sign = e.type === 'income' ? '+' : '-';
      const amt = (e.amount || 0).toLocaleString('ko-KR');
      const cls = e.type === 'income' ? 'ledger-day-fixed-inc' : 'ledger-day-fixed-exp';
      return `<div class="ledger-day-fixed ${cls}"><span class="ldf-pin">고</span>${sign}${amt}</div>`;
    }).join('');

    const itemCount = (state.ledgerData?.[dk] || []).length;
    html += `
      <div class="ledger-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${heatLevel > 0 ? 'heat-' + heatLevel : ''}" data-dk="${dk}">
        <div class="ledger-day-top">
          <div class="${numClass}">${day}</div>
          ${itemCount > 0 ? `<div class="ledger-day-dot-count">${itemCount}</div>` : ''}
        </div>
        <div class="ledger-day-amounts">
          ${dayExp > 0 ? `<div class="ledger-day-expense">-${dayExp.toLocaleString('ko-KR')}</div>` : ''}
          ${dayInc > 0 ? `<div class="ledger-day-income">+${dayInc.toLocaleString('ko-KR')}</div>` : ''}
          ${fixedHtml}
        </div>
      </div>
    `;
  }

  const grid = document.getElementById('ledger-calendar-grid');
  if (grid) grid.innerHTML = html;
}

export function renderLedgerStats() {
  // 통계 뷰의 월/연 레이블도 동기화
  const statsLbl = document.getElementById('ledger-month-label-stats');
  if (statsLbl) {
    statsLbl.textContent = _ledgerStatsTab === 'annual'
      ? `${currentLedgerYear}년`
      : `${currentLedgerYear}년 ${currentLedgerMonth + 1}월`;
  }
  if (_ledgerStatsTab === 'monthly') {
    _renderMonthlyStats();
  } else {
    _renderAnnualStats();
  }
}

function _renderMonthlyStats() {
  const y = currentLedgerYear;
  const m = currentLedgerMonth;
  const { expense, income, net, catTotals, dayMap } = getLedgerMonth(y, m);

  const now = today();
  const isCurrentMonth = (y === now.getFullYear() && m === now.getMonth());
  const totalDays = new Date(y, m + 1, 0).getDate();
  const elapsedDays = isCurrentMonth ? now.getDate() : totalDays;
  const remainingDays = totalDays - elapsedDays;
  const dailyAvg = elapsedDays > 0 ? Math.round(expense / elapsedDays) : 0;
  const projected = dailyAvg * totalDays;
  const savRate = income > 0 ? Math.max(0, Math.round(((income - expense) / income) * 100)) : 0;

  let prevM = m - 1, prevY = y;
  if (prevM < 0) { prevM = 11; prevY--; }
  const { expense: prevExp, income: prevInc } = getLedgerMonth(prevY, prevM);
  const expPct = prevExp > 0 ? Math.round(((expense - prevExp) / prevExp) * 100) : null;
  const incPct = prevInc > 0 ? Math.round(((income - prevInc) / prevInc) * 100) : null;

  const TAG_EMOJI = { '충동': '💸', '계획': '📋', '필수': '✅', '외식': '🍽️', '선물': '🎁' };
  const tagTotals = {}, tagCounts = {};
  const pfx = `${y}-${p2(m + 1)}`;
  // 요일별 지출 패턴 (0=일, 1=월, ... 6=토)
  const dowTotals = [0, 0, 0, 0, 0, 0, 0];
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const [dk, items] of Object.entries(state.ledgerData || {})) {
    if (!dk.startsWith(pfx)) continue;
    const dow = new Date(dk).getDay();
    for (const item of items) {
      if (item.type === 'expense') {
        dowTotals[dow] += item.amount;
        dowCounts[dow]++;
      }
      if (item.type === 'expense' && item.tag) {
        tagTotals[item.tag] = (tagTotals[item.tag] || 0) + item.amount;
        tagCounts[item.tag] = (tagCounts[item.tag] || 0) + 1;
      }
    }
  }
  const tagEntries = Object.entries(tagTotals).sort((a, b) => b[1] - a[1]);

  // 요일별 바 차트 (월~일 순)
  const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
  const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun
  const maxDow = Math.max(...dowTotals, 1);
  const dowBarsHtml = DOW_ORDER.map(di => {
    const amt = dowTotals[di];
    const isWeekend = di === 0 || di === 6;
    const isMax = amt > 0 && amt === Math.max(...DOW_ORDER.map(d => dowTotals[d]));
    const h = Math.round((amt / maxDow) * 50);
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1">
      <div style="font-size:9px;color:${isMax ? 'var(--red2)' : 'var(--text3)'};font-weight:${isMax ? 700 : 400}">${amt > 0 ? fmtShort(amt) : ''}</div>
      <div style="width:100%;background:var(--bg3);border-radius:5px;height:50px;display:flex;align-items:flex-end;overflow:hidden">
        <div style="width:100%;height:${h}px;background:${isMax ? 'rgba(248,113,113,0.75)' : isWeekend ? 'rgba(139,92,246,0.45)' : 'rgba(96,165,250,0.5)'};border-radius:5px 5px 0 0;transition:height 0.4s ease"></div>
      </div>
      <div style="font-size:9px;color:${isWeekend ? '#a78bfa' : 'var(--text3)'};font-weight:${isWeekend ? 600 : 400}">${DOW_LABELS[di]}</div>
    </div>`;
  }).join('');

  const el = document.getElementById('ledger-stats-content');
  if (!el) return;

  // 카테고리 도넛 (140px, 저축률 표시)
  const cats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const total = expense || 1;
  const R = 56, CX = 70, CY = 70;
  let donutSvg = '', donutLegend = '';
  if (cats.length > 0) {
    let angle = -Math.PI / 2;
    cats.forEach(([cat, amt]) => {
      const pct = amt / total;
      const a = pct * 2 * Math.PI;
      const x1 = CX + R * Math.cos(angle), y1 = CY + R * Math.sin(angle);
      const x2 = CX + R * Math.cos(angle + a), y2 = CY + R * Math.sin(angle + a);
      const large = a > Math.PI ? 1 : 0;
      const col = LEDGER_CAT_COLORS[cat] || '#64748b';
      donutSvg += `<path d="M${CX},${CY} L${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${col}" opacity="0.88"/>`;
      angle += a;
    });
    donutSvg += `<circle cx="${CX}" cy="${CY}" r="34" fill="var(--bg2)"/>`;
    donutSvg += `<text x="${CX}" y="${CY - 4}" fill="var(--text)" font-size="13" text-anchor="middle" font-family="monospace" font-weight="900">${savRate}%</text>`;
    donutSvg += `<text x="${CX}" y="${CY + 12}" fill="var(--text3)" font-size="9" text-anchor="middle">저축률</text>`;
  }

  cats.slice(0, 7).forEach(([cat, amt], ci) => {
    const col = LEDGER_CAT_COLORS[cat] || '#64748b';
    const pct = Math.round((amt / total) * 100);
    donutLegend += `
      <div class="lstat-cat-row stagger-item" style="--stagger-idx:${ci}">
        <span class="lstat-cat-dot" style="background:${col}"></span>
        <span class="lstat-cat-name">${cat}</span>
        <div class="lstat-cat-bar"><div style="width:${pct}%;background:${col};height:100%;border-radius:4px;opacity:.85"></div></div>
        <span class="lstat-cat-amt">${fmtShort(amt)}</span>
      </div>`;
  });

  // 주별 지출 패턴
  const weeks = [0, 0, 0, 0];
  for (const [day, amt] of Object.entries(dayMap)) {
    const wk = Math.min(3, Math.floor((parseInt(day, 10) - 1) / 7));
    weeks[wk] += amt;
  }
  const maxWeek = Math.max(...weeks, 1);
  const weekLabels = ['1주', '2주', '3주', '4주'];
  const weekBars = weeks.map((amt, i) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
      <div style="font-size:9px;color:${amt === Math.max(...weeks) && amt > 0 ? 'var(--red2)' : 'var(--text3)'};font-weight:700">${amt > 0 ? fmtShort(amt) : '-'}</div>
      <div style="width:100%;background:var(--bg3);border-radius:6px;height:60px;display:flex;align-items:flex-end">
        <div style="width:100%;height:${((amt / maxWeek) * 100).toFixed(0)}%;background:${amt === Math.max(...weeks) && amt > 0 ? 'rgba(248,113,113,0.7)' : 'rgba(96,165,250,0.5)'};border-radius:6px;transition:height 0.4s ease"></div>
      </div>
      <div style="font-size:9px;color:var(--text3)">${weekLabels[i]}</div>
    </div>`).join('');

  // 전월 비교 헬퍼
  const momRow = (label, cur, prev, pct, isExpense) => {
    const arrow = pct === null ? '' : (pct > 0 ? '▲' : '▼');
    const arrowColor = isExpense
      ? (pct > 0 ? 'var(--red2)' : 'var(--green2)')
      : (pct > 0 ? 'var(--green2)' : 'var(--red2)');
    const pctStr = pct !== null
      ? `<span style="font-size:11px;color:${arrowColor};font-weight:700">${arrow} ${Math.abs(pct)}%</span>` : '';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
      <span style="font-size:12px;color:var(--text2)">${label}</span>
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:700;font-family:var(--mono);color:${isExpense ? 'var(--red2)' : 'var(--green2)'}">${fmtShort(cur)}</div>
        <div style="display:flex;gap:6px;justify-content:flex-end;align-items:center">
          <span style="font-size:10px;color:var(--text3)">전월 ${fmtShort(prev)}</span>
          ${pctStr}
        </div>
      </div>
    </div>`;
  };

  el.innerHTML = `
    ${isCurrentMonth && elapsedDays > 0 ? `
    <div style="background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08));border:1px solid rgba(129,140,248,0.2);border-radius:16px;padding:14px;margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;color:#a78bfa;letter-spacing:0.5px;margin-bottom:8px">⚡ 이번 달 소비 속도</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div>
          <div style="font-size:9px;color:var(--text3);margin-bottom:2px">경과</div>
          <div style="font-size:16px;font-weight:900;color:var(--text);font-family:var(--mono)">${elapsedDays}<span style="font-size:10px;color:var(--text3)">일</span></div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);margin-bottom:2px">일 평균</div>
          <div style="font-size:16px;font-weight:900;color:var(--red2);font-family:var(--mono)">${fmtShort(dailyAvg)}</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--text3);margin-bottom:2px">월말 예상</div>
          <div style="font-size:16px;font-weight:900;color:${prevExp > 0 && projected > prevExp ? 'var(--orange)' : 'var(--text)'};font-family:var(--mono)">${fmtShort(projected)}</div>
        </div>
      </div>
      ${remainingDays > 0 ? `<div style="margin-top:8px;font-size:10px;color:var(--text3)">남은 ${remainingDays}일 · 일 ${fmtShort(dailyAvg)} 페이스</div>` : ''}
    </div>` : ''}

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">${y}년 ${m + 1}월 요약</div>
      ${expense === 0 && income === 0 ? '<div class="empty-state" style="padding:20px 0">기록 없음</div>' : `
        <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px">
          <svg width="140" height="140" viewBox="0 0 140 140" style="flex-shrink:0">${donutSvg}</svg>
          <div style="flex:1;min-width:140px">
            <div style="margin-bottom:10px">
              <div style="font-size:9px;color:var(--text3);margin-bottom:2px">이번 달 지출</div>
              <div style="font-size:22px;font-weight:900;color:var(--red2);font-family:var(--mono)">${fmtShort(expense)}</div>
            </div>
            <div style="margin-bottom:10px">
              <div style="font-size:9px;color:var(--text3);margin-bottom:2px">이번 달 수입</div>
              <div style="font-size:18px;font-weight:800;color:var(--green2);font-family:var(--mono)">${fmtShort(income)}</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <span style="font-size:10px;padding:3px 9px;border-radius:8px;font-weight:700;background:${savRate >= 20 ? 'rgba(52,211,153,0.15)' : savRate >= 10 ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)'};color:${savRate >= 20 ? 'var(--green2)' : savRate >= 10 ? 'var(--orange)' : 'var(--red2)'}">저축률 ${savRate}%</span>
              <span style="font-size:10px;padding:3px 9px;border-radius:8px;font-weight:700;background:rgba(99,102,241,0.12);color:#a78bfa">순 ${fmtSigned(net)}</span>
            </div>
          </div>
        </div>
        ${donutLegend}`}
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">📅 주별 지출 패턴</div>
      <div style="display:flex;gap:8px;align-items:flex-end;padding:4px 0">${weekBars}</div>
    </div>

    ${dowTotals.some(v => v > 0) ? `
    <div class="card" style="margin-bottom:12px">
      <div class="card-title">🗓️ 요일별 지출 패턴
        <span style="font-size:10px;color:var(--text3);font-weight:400;margin-left:4px">주말 보라색</span>
      </div>
      <div style="display:flex;gap:6px;align-items:flex-end;padding:4px 0">${dowBarsHtml}</div>
    </div>` : ''}

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">📊 전월 대비</div>
      ${momRow('지출', expense, prevExp, expPct, true)}
      ${momRow('수입', income, prevInc, incPct, false)}
    </div>

    ${tagEntries.length > 0 ? `
    <div class="card" style="margin-bottom:12px">
      <div class="card-title">🏷️ 소비 유형별</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${tagEntries.map(([tag, amt]) => {
          const pct = expense > 0 ? Math.round((amt / expense) * 100) : 0;
          const cnt = tagCounts[tag];
          return `<div class="lstat-cat-row">
            <span class="lstat-cat-name">${TAG_EMOJI[tag] || ''}${tag}</span>
            <div class="lstat-cat-bar"><div style="width:${pct}%;background:#6366f1;height:100%;border-radius:4px;opacity:.85"></div></div>
            <span class="lstat-cat-amt" style="min-width:80px;text-align:right">${cnt}건 · ${fmtShort(amt)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    ${(() => {
      const cards = state.cards || [];
      if (!cards.length) return '';
      const cardTotals = {}; // cardId → { total, count }
      let cashTotal = 0, cashCount = 0;
      for (const [dk, items] of Object.entries(state.ledgerData || {})) {
        if (!dk.startsWith(pfx)) continue;
        for (const item of items) {
          if (item.type !== 'expense') continue;
          if (item.cardId) {
            if (!cardTotals[item.cardId]) cardTotals[item.cardId] = { total: 0, count: 0 };
            cardTotals[item.cardId].total += item.amount;
            cardTotals[item.cardId].count++;
          } else {
            cashTotal += item.amount;
            cashCount++;
          }
        }
      }
      const hasAny = Object.keys(cardTotals).length > 0 || cashTotal > 0;
      if (!hasAny) return '';
      const rows = cards
        .filter(c => cardTotals[c.id])
        .map(c => {
          const { total, count } = cardTotals[c.id];
          const pct = expense > 0 ? Math.round((total / expense) * 100) : 0;
          return `<div class="lstat-cat-row">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.color || '#6366f1'};flex-shrink:0"></span>
            <span class="lstat-cat-name" style="margin-left:4px">💳 ${escapeHtml(c.name)}</span>
            <div class="lstat-cat-bar"><div style="width:${pct}%;background:${c.color || '#6366f1'};height:100%;border-radius:4px;opacity:.8"></div></div>
            <span class="lstat-cat-amt">${count}건 · ${fmtShort(total)}</span>
          </div>`;
        }).join('');
      const cashRow = cashTotal > 0 ? `<div class="lstat-cat-row">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#64748b;flex-shrink:0"></span>
        <span class="lstat-cat-name" style="margin-left:4px">💵 현금/기타</span>
        <div class="lstat-cat-bar"><div style="width:${expense > 0 ? Math.round((cashTotal / expense) * 100) : 0}%;background:#64748b;height:100%;border-radius:4px;opacity:.6"></div></div>
        <span class="lstat-cat-amt">${cashCount}건 · ${fmtShort(cashTotal)}</span>
      </div>` : '';
      return `<div class="card" style="margin-bottom:12px">
        <div class="card-title">💳 카드별 지출</div>
        <div style="display:flex;flex-direction:column;gap:8px">${rows}${cashRow}</div>
      </div>`;
    })()}
  `;
}

function _renderAnnualStats() {
  const y = currentLedgerYear;
  const { expense: yearExp, income: yearInc, net: yearNet, monthMap } = getLedgerYear(y);
  const { expense: prevYearExp, income: prevYearInc } = getLedgerYear(y - 1);

  const yearSavRate = yearInc > 0 ? Math.max(0, Math.round(((yearInc - yearExp) / yearInc) * 100)) : 0;
  const expYoY = prevYearExp > 0 ? Math.round(((yearExp - prevYearExp) / prevYearExp) * 100) : null;
  const incYoY = prevYearInc > 0 ? Math.round(((yearInc - prevYearInc) / prevYearInc) * 100) : null;

  const el = document.getElementById('ledger-stats-content');
  if (!el) return;

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = monthMap[i + 1] || { expense: 0, income: 0 };
    const savRate = d.income > 0 ? Math.max(0, Math.round(((d.income - d.expense) / d.income) * 100)) : 0;
    return { label: `${i + 1}월`, expense: d.expense, income: d.income, savRate };
  });
  const maxVal = Math.max(...months.flatMap(d => [d.expense, d.income]), 1);

  // SVG dual-bar chart with savings rate polyline
  const W = 560, H = 140, PL = 8, PR = 8, PT = 10, PB = 24;
  const chartW = W - PL - PR, chartH = H - PT - PB;
  const barW = Math.floor(chartW / 12);
  const halfW = Math.floor(barW * 0.35);

  let svgBars = '', xLabels = '', savRateLine = '';
  const savRatePts = [];
  months.forEach((mo, i) => {
    const x = PL + i * barW + barW / 2;
    const incH = Math.round((mo.income / maxVal) * chartH);
    const expH = Math.round((mo.expense / maxVal) * chartH);
    const incY = PT + chartH - incH;
    const expY = PT + chartH - expH;
    if (mo.income > 0 || mo.expense > 0) {
      svgBars += `<rect x="${(x - halfW * 2 - 1).toFixed(0)}" y="${incY}" width="${halfW}" height="${incH}" rx="2" fill="rgba(52,211,153,0.7)"/>`;
      svgBars += `<rect x="${(x - 1).toFixed(0)}" y="${expY}" width="${halfW}" height="${expH}" rx="2" fill="rgba(248,113,113,0.7)"/>`;
      if (mo.income > 0) savRatePts.push([x, PT + chartH - Math.round((mo.savRate / 100) * chartH)]);
    }
    xLabels += `<text x="${x}" y="${H - 4}" fill="var(--text3)" font-size="8" text-anchor="middle">${mo.label}</text>`;
  });
  if (savRatePts.length >= 2) {
    const pts = savRatePts.map(([x, y2]) => `${x.toFixed(0)},${y2.toFixed(0)}`).join(' ');
    savRateLine = `<polyline points="${pts}" fill="none" stroke="#a78bfa" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.7"/>`;
    savRatePts.forEach(([x, y2]) => {
      savRateLine += `<circle cx="${x.toFixed(0)}" cy="${y2.toFixed(0)}" r="2.5" fill="#a78bfa" opacity="0.8"/>`;
    });
  }

  const expMonths = months.filter(d => d.expense > 0).sort((a, b) => b.expense - a.expense);
  const bestLabel  = expMonths.length > 0 ? expMonths[expMonths.length - 1].label : '-';
  const worstLabel = expMonths.length > 0 ? expMonths[0].label : '-';

  const yoyRow = (label, val, pct, isExpense) => {
    const base = `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
      <span style="font-size:12px;color:var(--text2)">${label}</span>
      <div style="text-align:right">
        <span style="font-size:13px;font-weight:700;font-family:var(--mono)">${fmtShort(val)}</span>`;
    if (pct === null) return base + `</div></div>`;
    const arrow = pct > 0 ? '▲' : '▼';
    const color = isExpense ? (pct > 0 ? 'var(--red2)' : 'var(--green2)') : (pct > 0 ? 'var(--green2)' : 'var(--red2)');
    return base + `<span style="margin-left:8px;font-size:11px;font-weight:700;color:${color}">${arrow} ${Math.abs(pct)}%</span></div></div>`;
  };

  el.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:1px;margin-bottom:10px">${y}년 연간 요약</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="background:rgba(52,211,153,0.08);border-radius:10px;padding:10px">
          <div style="font-size:9px;color:var(--text3);margin-bottom:2px">연간 수입</div>
          <div style="font-size:18px;font-weight:900;color:var(--green2);font-family:var(--mono)">${fmtShort(yearInc)}</div>
        </div>
        <div style="background:rgba(248,113,113,0.08);border-radius:10px;padding:10px">
          <div style="font-size:9px;color:var(--text3);margin-bottom:2px">연간 지출</div>
          <div style="font-size:18px;font-weight:900;color:var(--red2);font-family:var(--mono)">${fmtShort(yearExp)}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span style="font-size:11px;padding:3px 10px;border-radius:8px;font-weight:700;background:${yearSavRate >= 20 ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)'};color:${yearSavRate >= 20 ? 'var(--green2)' : 'var(--orange)'}">연 저축률 ${yearSavRate}%</span>
        <span class="info-chip success">📉 최소: ${bestLabel}</span>
        <span class="info-chip warning">📈 최대: ${worstLabel}</span>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">월별 수입 / 지출 <span style="float:right;font-size:9px;color:#a78bfa">-- 저축률 추이</span></div>
      <div style="overflow-x:auto">
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="min-width:${W}px;display:block">
          <line x1="${PL}" y1="${PT + chartH}" x2="${W - PR}" y2="${PT + chartH}" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
          ${svgBars}
          ${savRateLine}
          ${xLabels}
        </svg>
      </div>
      <div style="display:flex;gap:12px;margin-top:6px;font-size:9px;color:var(--text3)">
        <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:8px;background:rgba(52,211,153,0.7);border-radius:2px;display:inline-block"></span>수입</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:8px;background:rgba(248,113,113,0.7);border-radius:2px;display:inline-block"></span>지출</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:16px;height:2px;background:#a78bfa;display:inline-block"></span>저축률</span>
      </div>
    </div>

    ${expYoY !== null || incYoY !== null ? `
    <div class="card" style="margin-bottom:12px">
      <div class="card-title">📅 전년 대비 (${y - 1}→${y}년)</div>
      ${yoyRow('연간 수입', yearInc, incYoY, false)}
      ${yoyRow('연간 지출', yearExp, expYoY, true)}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0">
        <span style="font-size:12px;color:var(--text2)">연간 순액</span>
        <span style="font-size:14px;font-weight:900;font-family:var(--mono);color:${yearNet >= 0 ? 'var(--green2)' : 'var(--red2)'}">${fmtSigned(yearNet)}</span>
      </div>
    </div>` : ''}

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">📅 ${y}년 지출 히트맵</div>
      <div id="ledger-heatmap" style="overflow-x:auto;padding-bottom:4px"></div>
    </div>
  `;

  _renderHeatmap(y);
}

export function changeLedgerMonth(diff) {
  currentLedgerMonth += diff;

  if (currentLedgerMonth < 0)  { currentLedgerMonth = 11; currentLedgerYear--; }
  if (currentLedgerMonth > 11) { currentLedgerMonth = 0;  currentLedgerYear++; }

  localStorage.setItem('cashflow_ledger_ym', JSON.stringify({ y: currentLedgerYear, m: currentLedgerMonth }));
  _selectedLedgerDate = null;

  renderLedger();

  // 통계 탭 연도도 같이 이동
  if (_ledgerSubTab === 'stats') renderLedgerStats();
}

// ════════════════════════════════════════════════════════
// 리포트 탭 (고퀄리티 전면 개편)
// ════════════════════════════════════════════════════════

// 카테고리 컬러 팔레트 (확장)
const REPORT_CAT_COLORS = {
  '월급': '#34d399', '부수입': '#6ee7b7', '이자': '#a7f3d0',
  '카드': '#f87171', '할부': '#fb923c', '공과금': '#facc15',
  '보험': '#c084fc', '식비': '#60a5fa', '교통': '#38bdf8',
  '통신': '#a78bfa', '구독': '#f472b6', '기타지출': '#94a3b8',
  '주거': '#fbbf24', '의료': '#4ade80', '문화': '#e879f9',
  '교육': '#22d3ee', '생활': '#fb923c', '저축': '#34d399',
};

function _calcHealthScore(cf) {
  const { income, expense } = cf;
  const now = today();

  // 저축률 (0~25)
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
  const savPts = savingsRate >= 20 ? 25 : savingsRate >= 10 ? 18 : savingsRate >= 0 ? 10 : 0;

  // 지출비율 (0~20)
  const expenseRatio = income > 0 ? Math.round((expense / income) * 100) : 100;
  const expPts = expenseRatio <= 70 ? 20 : expenseRatio <= 85 ? 12 : expenseRatio <= 100 ? 5 : 0;

  // 할부비중 (0~15)
  const halbuAmt = state.entries
    .filter(e => e.type === 'expense' && e.repeat === '매월' && e.category === '할부')
    .reduce((s, e) => s + e.amount, 0);
  const halbuPct = expense > 0 ? Math.round((halbuAmt / expense) * 100) : 0;
  const halbuPts = halbuPct <= 10 ? 15 : halbuPct <= 25 ? 9 : halbuPct <= 40 ? 4 : 0;

  // 활성 할부 수 (0~10)
  const activeHalbu = state.entries.filter(
    e => e.category === '할부' && e.repeat === '매월' && (!e.endMonth || parseInt(e.endMonth, 10) >= yyyymm(now))
  ).length;
  const halbuCntPts = activeHalbu <= 2 ? 10 : activeHalbu <= 5 ? 6 : 2;

  // 연속 기록 스트릭 (0~15)
  const { count: streak } = computeStreak(state.ledgerData);
  const streakPts = streak >= 14 ? 15 : streak >= 7 ? 10 : streak >= 3 ? 5 : 0;

  // 예산 준수율 (0~15) — 예산 미설정 시 중립 8점
  const budget = getMonthBudget(state.budgets || {}, now.getFullYear(), now.getMonth());
  const budgetCats = Object.keys(budget);
  let budgetPts = 8;
  let budgetCompliance = null; // null = 예산 없음
  if (budgetCats.length > 0) {
    const actual = getMonthActual(state.ledgerData, now.getFullYear(), now.getMonth());
    const overCount = budgetCats.filter(cat => (actual[cat] || 0) > budget[cat]).length;
    const ratio = overCount / budgetCats.length;
    budgetPts = ratio === 0 ? 15 : ratio <= 0.2 ? 10 : ratio <= 0.5 ? 5 : 0;
    budgetCompliance = Math.round((1 - ratio) * 100);
  }

  const score = Math.max(0, Math.min(100, savPts + expPts + halbuPts + halbuCntPts + streakPts + budgetPts));
  const grade = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : score >= 30 ? 'D' : 'F';
  const color = score >= 70 ? 'var(--green2)' : score >= 45 ? 'var(--yellow)' : 'var(--red2)';
  const label = score >= 70 ? '우수' : score >= 45 ? '양호' : '주의';
  return { score, grade, color, label, savingsRate, expenseRatio, halbuPct, streak, budgetCompliance };
}

function _calcMonthCF(d) {
  const ym = yyyymm(d);
  const ymStr = String(ym);
  const income = state.entries
    .filter((e) => e.type === 'income' && e.repeat === '매월')
    .reduce((s, e) => s + e.amount, 0);
  const fixedExp = state.entries
    .filter((e) => e.type === 'expense' && e.repeat === '매월' && (!e.endMonth || parseInt(e.endMonth, 10) >= ym))
    .reduce((s, e) => s + e.amount, 0);
  const cd = state.cardData[ymStr] || {};
  const ledger = getLedgerMonth(d.getFullYear(), d.getMonth());
  const expense = fixedExp + (cd.hyundai || 0) + (cd.kookmin || 0) + ledger.expense;
  return { income, expense, net: income - expense, ym };
}

function _buildDonutSvg(cats, total, R = 52, CX = 60, CY = 60) {
  if (!cats.length || total === 0) return '';
  let paths = '', angle = -Math.PI / 2;
  cats.forEach(([cat, amt]) => {
    const pct = amt / total;
    const a = pct * 2 * Math.PI;
    const x1 = CX + R * Math.cos(angle), y1 = CY + R * Math.sin(angle);
    const x2 = CX + R * Math.cos(angle + a), y2 = CY + R * Math.sin(angle + a);
    const large = a > Math.PI ? 1 : 0;
    const col = REPORT_CAT_COLORS[cat] || '#64748b';
    paths += `<path d="M${CX},${CY} L${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${col}" opacity="0.88"/>`;
    angle += a;
  });
  paths += `<circle cx="${CX}" cy="${CY}" r="${Math.round(R * 0.48)}" fill="var(--bg2)"/>`;
  return paths;
}

// ════════════════════════════════════════════════════════
// 만약에 시뮬레이터
// ════════════════════════════════════════════════════════
export function renderSimulator() {
  const chipsEl = document.getElementById('sim-cat-chips');
  if (!chipsEl) return;

  // 최근 3개월 카테고리별 지출 평균 계산
  const now = today();
  const catTotals = {}, catMonths = {};
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
    for (const [dk, items] of Object.entries(state.ledgerData || {})) {
      if (!dk.startsWith(prefix)) continue;
      for (const item of items) {
        if (item.type !== 'expense') continue;
        catTotals[item.category] = (catTotals[item.category] || 0) + item.amount;
        catMonths[item.category] = new Set([...(catMonths[item.category] || []), prefix]);
      }
    }
  }
  const cats = Object.entries(catTotals)
    .map(([cat, total]) => ({ cat, avg: Math.round(total / (catMonths[cat]?.size || 1)) }))
    .filter(c => c.avg > 0)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 8);

  if (!cats.length) {
    chipsEl.innerHTML = '<div style="font-size:12px;color:var(--text3)">가계부 데이터가 쌓이면 시뮬레이터를 사용할 수 있어요</div>';
    return;
  }

  chipsEl.innerHTML = cats.map(c =>
    `<button class="ledger-tag-btn${_simCategory === c.cat ? ' active' : ''}" data-sim-cat="${escapeHtml(c.cat)}">${escapeHtml(c.cat)} <span style="font-size:9px;opacity:.7">${fmtShort(c.avg)}</span></button>`
  ).join('');

  updateSimResult();
}

export function setSimCategory(cat) {
  const now = today();
  let total = 0, months = 0;
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
    let monthTotal = 0;
    for (const [dk, items] of Object.entries(state.ledgerData || {})) {
      if (!dk.startsWith(prefix)) continue;
      for (const item of items) {
        if (item.type === 'expense' && item.category === cat) monthTotal += item.amount;
      }
    }
    if (monthTotal > 0) { total += monthTotal; months++; }
  }
  _simCategory = cat;
  _simCurrentAvg = months > 0 ? Math.round(total / months) : 0;

  document.querySelectorAll('#sim-cat-chips .ledger-tag-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.simCat === cat)
  );

  const wrap = document.getElementById('sim-slider-wrap');
  const slider = document.getElementById('sim-slider');
  const maxEl = document.getElementById('sim-slider-max');
  if (wrap) wrap.style.display = _simCurrentAvg > 0 ? '' : 'none';
  if (slider) { slider.max = _simCurrentAvg; slider.value = Math.round(_simCurrentAvg * 0.6); }
  if (maxEl) maxEl.textContent = fmtShort(_simCurrentAvg) + ' (현재)';

  updateSimResult();
}

export function updateSimResult() {
  const resultEl = document.getElementById('sim-result');
  if (!resultEl) return;
  if (!_simCategory || !_simCurrentAvg) {
    resultEl.innerHTML = '';
    return;
  }
  const slider = document.getElementById('sim-slider');
  const target = slider ? Number(slider.value) : 0;
  const monthlySaving = _simCurrentAvg - target;

  const valEl = document.getElementById('sim-slider-val');
  if (valEl) valEl.textContent = fmtShort(target);

  if (monthlySaving <= 0) {
    resultEl.innerHTML = `<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px">현재보다 지출을 줄여야 절약 효과가 계산돼요</div>`;
    return;
  }

  resultEl.innerHTML = `
    <div style="padding:10px 12px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:12px;margin-top:4px">
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px">${escapeHtml(_simCategory)} 지출을 ${fmtShort(_simCurrentAvg)} → ${fmtShort(target)}으로 줄이면</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center">
        ${[1, 3, 6, 12].map(m => `
          <div style="padding:8px 4px;background:var(--bg3);border-radius:10px">
            <div style="font-size:9px;color:var(--text3)">${m}개월</div>
            <div style="font-size:13px;font-weight:800;font-family:var(--mono);color:var(--green2)">+${fmtShort(monthlySaving * m)}</div>
          </div>`).join('')}
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:8px;text-align:center">월 절약액 <span style="color:var(--green2);font-weight:700">${fmtShort(monthlySaving)}</span></div>
    </div>`;
}

// ════════════════════════════════════════════════════════
// 연간 히트맵 (GitHub contribution style)
// ════════════════════════════════════════════════════════
function _renderHeatmap(year) {
  const el = document.getElementById('ledger-heatmap');
  if (!el) return;

  // 해당 연도의 모든 일별 지출 수집
  const dayExp = {};
  const yearPfx = `${year}-`;
  for (const [dk, items] of Object.entries(state.ledgerData || {})) {
    if (!dk.startsWith(yearPfx)) continue;
    const exp = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
    if (exp > 0) dayExp[dk] = exp;
  }

  const maxExp = Math.max(...Object.values(dayExp), 1);
  const jan1 = new Date(year, 0, 1);
  const startDow = jan1.getDay(); // 0=일
  const totalDays = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;

  const cellSize = 13, gap = 2;
  const cols = Math.ceil((totalDays + startDow) / 7);
  const W = cols * (cellSize + gap);
  const H = 7 * (cellSize + gap);

  let cells = '';
  const monthLabels = [];
  let lastMonth = -1;

  for (let i = 0; i < totalDays + startDow; i++) {
    const col = Math.floor(i / 7);
    const row = i % 7;
    if (i < startDow) continue; // 첫 주 빈칸
    const dayIdx = i - startDow;
    const d = new Date(year, 0, dayIdx + 1);
    const dk = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const exp = dayExp[dk] || 0;
    const intensity = exp > 0 ? Math.min(1, exp / maxExp) : 0;

    // 월 레이블
    if (d.getMonth() !== lastMonth && row === 0) {
      lastMonth = d.getMonth();
      monthLabels.push({ col, label: `${d.getMonth() + 1}월` });
    }

    const col4 = intensity === 0 ? 'var(--bg4)' :
      intensity < 0.33 ? '#1e4620' : intensity < 0.66 ? '#296b30' : '#2ea043';
    const x = col * (cellSize + gap);
    const y = row * (cellSize + gap);
    cells += `<rect x="${x}" y="${y + 14}" width="${cellSize}" height="${cellSize}" rx="2" fill="${col4}" opacity="${exp > 0 ? '0.92' : '0.4'}"><title>${dk}: ${exp > 0 ? fmtShort(exp) : '기록 없음'}</title></rect>`;
  }

  const labels = monthLabels.map(({ col, label }) =>
    `<text x="${col * (cellSize + gap)}" y="11" fill="var(--text3)" font-size="9" font-family="monospace">${label}</text>`
  ).join('');

  el.innerHTML = `<svg width="${W}" height="${H + 14}" viewBox="0 0 ${W} ${H + 14}" style="overflow:visible">${labels}${cells}</svg>`;
}

// ════════════════════════════════════════════════════════
// 카테고리별 6개월 트렌드 차트
// ════════════════════════════════════════════════════════
let _trendSelectedCats = [];

export function setTrendCategory(cat) {
  if (_trendSelectedCats.includes(cat)) {
    _trendSelectedCats = _trendSelectedCats.filter(c => c !== cat);
  } else if (_trendSelectedCats.length < 4) {
    _trendSelectedCats.push(cat);
  }
  document.querySelectorAll('#report-cat-trend-chips .ledger-tag-btn').forEach(b =>
    b.classList.toggle('active', _trendSelectedCats.includes(b.dataset.cat))
  );
  _renderTrendChart();
}

function _renderCategoryTrend() {
  const chipsEl = document.getElementById('report-cat-trend-chips');
  const chartEl = document.getElementById('report-cat-trend-chart');
  if (!chipsEl || !chartEl) return;

  const now = today();
  const months = [];
  const allCatTotals = {};

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
    const catMonth = {};
    for (const [dk, items] of Object.entries(state.ledgerData || {})) {
      if (!dk.startsWith(prefix)) continue;
      for (const item of items) {
        if (item.type !== 'expense') continue;
        catMonth[item.category] = (catMonth[item.category] || 0) + item.amount;
        allCatTotals[item.category] = (allCatTotals[item.category] || 0) + item.amount;
      }
    }
    months.push({ label: `${d.getMonth() + 1}월`, cats: catMonth });
  }

  // 상위 6개 카테고리 (6개월 합산 기준)
  const topCats = Object.entries(allCatTotals)
    .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([cat]) => cat);

  if (!topCats.length) {
    chipsEl.innerHTML = '<div style="font-size:12px;color:var(--text3)">데이터 없음</div>';
    chartEl.innerHTML = '';
    return;
  }

  if (_trendSelectedCats.length === 0) _trendSelectedCats = topCats.slice(0, 2);

  chipsEl.innerHTML = topCats.map(cat =>
    `<button class="ledger-tag-btn${_trendSelectedCats.includes(cat) ? ' active' : ''}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
  ).join('');

  window._trendMonths = months;
  _renderTrendChart();
}

function _renderTrendChart() {
  const chartEl = document.getElementById('report-cat-trend-chart');
  if (!chartEl) return;
  const months = window._trendMonths;
  if (!months?.length || !_trendSelectedCats.length) {
    chartEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:10px 0">카테고리를 선택하세요</div>';
    return;
  }

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];
  const W = 320, H = 80, PAD = { t: 10, b: 24, l: 40, r: 10 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const N = months.length;
  const stepX = innerW / (N - 1);

  const allVals = _trendSelectedCats.flatMap(cat => months.map(m => m.cats[cat] || 0));
  const maxVal = Math.max(...allVals, 1);

  let paths = '', dots = '', labels = '';

  labels = months.map((m, i) =>
    `<text x="${PAD.l + i * stepX}" y="${H}" fill="var(--text3)" font-size="8" text-anchor="middle" font-family="monospace">${m.label}</text>`
  ).join('');

  _trendSelectedCats.forEach((cat, ci) => {
    const col = COLORS[ci % COLORS.length];
    const pts = months.map((m, i) => {
      const v = m.cats[cat] || 0;
      const x = PAD.l + i * stepX;
      const y = PAD.t + innerH - (v / maxVal) * innerH;
      return { x, y, v };
    });
    paths += `<polyline points="${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>`;
    dots += pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${col}"><title>${cat}: ${fmtShort(p.v)}</title></circle>`).join('');
  });

  // 범례
  const legend = _trendSelectedCats.map((cat, ci) =>
    `<div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text2)"><div style="width:10px;height:3px;background:${COLORS[ci % COLORS.length]};border-radius:2px"></div>${escapeHtml(cat)}</div>`
  ).join('');

  chartEl.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="overflow:visible">${labels}${paths}${dots}</svg>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">${legend}</div>`;
}

// ════════════════════════════════════════════════════════
// 소비 성향 분석
// ════════════════════════════════════════════════════════
function _renderPersonality() {
  const el = document.getElementById('report-personality');
  if (!el) return;

  const now = today();
  const tagTotals = {}, tagCounts = {};
  // 최근 3개월 태그 집계
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
    for (const [dk, items] of Object.entries(state.ledgerData || {})) {
      if (!dk.startsWith(prefix)) continue;
      for (const item of items) {
        if (item.type === 'expense' && item.tag) {
          tagTotals[item.tag] = (tagTotals[item.tag] || 0) + item.amount;
          tagCounts[item.tag] = (tagCounts[item.tag] || 0) + 1;
        }
      }
    }
  }

  const entries = Object.entries(tagTotals).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (!entries.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3);text-align:center;padding:16px 0">소비 유형 태그를 가계부에 기록하면<br>성향 분석을 확인할 수 있어요</div>`;
    return;
  }

  const TAG_CONFIG = {
    '충동': { emoji: '💸', label: '충동형', desc: '즉흥적 구매가 많아요. 구매 전 24시간 고민하는 습관을 만들어보세요.', color: '#ef4444' },
    '계획': { emoji: '📋', label: '계획형', desc: '지출을 잘 계획하는 타입이에요. 이 습관을 유지하세요!', color: '#3b82f6' },
    '필수': { emoji: '✅', label: '알뜰형', desc: '필수 지출 위주로 소비하는 알뜰한 타입이에요.', color: '#10b981' },
    '외식': { emoji: '🍽️', label: '미식형', desc: '외식을 즐기는 타입이에요. 홈쿡 챌린지를 시도해보세요!', color: '#f97316' },
    '선물': { emoji: '🎁', label: '베풂형', desc: '주변 사람을 챙기는 따뜻한 소비 습관을 가졌어요.', color: '#a78bfa' },
  };

  const top = entries[0];
  const cfg = TAG_CONFIG[top[0]] || { emoji: '🤔', label: '분석형', desc: '다양한 소비 패턴을 보여요.', color: '#6366f1' };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#a78bfa'];
  const bars = entries.map(([tag, amt], i) => {
    const pct = Math.round((amt / total) * 100);
    const cnt = tagCounts[tag];
    const tcfg = TAG_CONFIG[tag];
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
      <span style="font-size:14px;width:20px">${tcfg?.emoji || '▸'}</span>
      <span style="font-size:11px;color:var(--text2);min-width:36px">${escapeHtml(tag)}</span>
      <div style="flex:1;height:6px;background:rgba(255,255,255,0.07);border-radius:6px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${COLORS[i % COLORS.length]};border-radius:6px;opacity:.85;transition:width 0.5s ease"></div>
      </div>
      <span style="font-size:10px;color:var(--text3);min-width:60px;text-align:right">${cnt}건 · ${pct}%</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;padding:14px;border-radius:14px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);margin-bottom:14px">
      <div style="font-size:32px">${cfg.emoji}</div>
      <div>
        <div style="font-size:15px;font-weight:900;color:${cfg.color}">나는 <span>${cfg.label}</span></div>
        <div style="font-size:11px;color:var(--text2);margin-top:4px;line-height:1.6">${cfg.desc}</div>
      </div>
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px">최근 3개월 소비 유형 분포</div>
    ${bars}`;
}

// ════════════════════════════════════════════════════════
// AI 주간 소비 코칭 카드
// ════════════════════════════════════════════════════════
export async function renderWeeklyCoachingCard(force = false) {
  const el = document.getElementById('ai-coaching-content');
  if (!el) return;

  if (!hasGeminiKey()) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:4px 0">Gemini API 키를 설정하면 AI 소비 코칭을 받을 수 있어요. 설정 탭에서 키를 입력해주세요.</div>`;
    return;
  }

  const CACHE_KEY = 'cashflow_coaching_cache';
  const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  const TTL = 7 * 24 * 3600 * 1000;
  if (!force && cached && Date.now() - cached.ts < TTL) {
    el.innerHTML = `<div class="ai-coaching-body">${cached.html}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:8px">마지막 업데이트: ${new Date(cached.ts).toLocaleDateString('ko-KR')}</div>`;
    return;
  }

  el.innerHTML = `<div class="ai-skeleton-wrap"><div class="ai-skeleton" style="width:82%"></div><div class="ai-skeleton" style="width:66%"></div><div class="ai-skeleton" style="width:74%"></div></div>`;

  try {
    const insight = await getWeeklyCoachingInsight(state);
    const html = renderMarkdown(insight);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), html }));
    el.innerHTML = `<div class="ai-coaching-body">${html}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:8px">방금 업데이트됨</div>`;
  } catch (err) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3)">${escapeHtml(err.message || 'AI 분석 실패')}</div>`;
  }
}

export function renderReport() {
  const now = today();

  // ── 6개월 데이터 수집 ─────────────────────────────────
  const months = [];
  for (let i = -5; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const cf = _calcMonthCF(d);
    months.push({ label: `${d.getMonth() + 1}월`, ...cf, d });
  }
  const curMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];

  // ── 이달 요약 헤더 ────────────────────────────────────
  const headerEl = document.getElementById('report-header-card');
  if (headerEl) {
    const savingsRate = curMonth.income > 0
      ? Math.round(((curMonth.income - curMonth.expense) / curMonth.income) * 100)
      : 0;
    const srColor = savingsRate >= 20 ? '#22c55e' : savingsRate >= 0 ? '#facc15' : '#f87171';
    const netColor = curMonth.net >= 0 ? '#22c55e' : '#f87171';
    const vsInc = prevMonth.income > 0 ? Math.round(((curMonth.income - prevMonth.income) / prevMonth.income) * 100) : 0;
    const vsExp = prevMonth.expense > 0 ? Math.round(((curMonth.expense - prevMonth.expense) / prevMonth.expense) * 100) : 0;
    const trendBadge = (pct, inv = false) => {
      if (pct === 0) return '';
      const good = inv ? pct < 0 : pct > 0;
      const col = good ? '#22c55e' : '#f87171';
      const arrow = pct > 0 ? '▲' : '▼';
      return `<span style="font-size:10px;color:${col};font-weight:700;margin-left:4px">${arrow}${Math.abs(pct)}%</span>`;
    };
    headerEl.innerHTML = `
      <div class="report-hdr-title">${now.getFullYear()}년 ${now.getMonth() + 1}월</div>
      <div class="report-hdr-grid">
        <div class="report-hdr-cell">
          <div class="report-hdr-label">수입</div>
          <div class="report-hdr-val" style="color:#4ade80">${fmtShort(curMonth.income)}${trendBadge(vsInc)}</div>
        </div>
        <div class="report-hdr-cell">
          <div class="report-hdr-label">지출</div>
          <div class="report-hdr-val" style="color:#f87171">${fmtShort(curMonth.expense)}${trendBadge(vsExp, true)}</div>
        </div>
        <div class="report-hdr-cell">
          <div class="report-hdr-label">순현금</div>
          <div class="report-hdr-val" style="color:${netColor}">${fmtSigned(curMonth.net)}</div>
        </div>
        <div class="report-hdr-cell">
          <div class="report-hdr-label">저축률</div>
          <div class="report-hdr-val" style="color:${srColor}">${savingsRate}%</div>
        </div>
      </div>`;
  }

  // ── 6개월 현금 흐름 SVG 차트 ──────────────────────────
  // 설계: Y축 눈금(좌측)으로 scale 제공 → 바 위 텍스트 불필요 → 겹침 해결
  //       하단 이중 라벨: 월 이름 + 순현금(+/-) → 정보 손실 없음
  const netEl = document.getElementById('report-net-chart');
  if (netEl) {
    const isLight = document.body.classList.contains('light-theme');
    const maxAmt = Math.max(...months.flatMap(m => [m.income, m.expense]), 1);
    const W = 560, H = 186;
    const pT = 14, pR = 12, pB = 52, pL = 48; // 좌측 Y축 공간 48px
    const chartW = W - pL - pR;
    const chartH = H - pT - pB;
    const mW = chartW / months.length;
    const bW = Math.min(mW * 0.36, 28);
    const gap = 5;

    const gridCol  = isLight ? 'rgba(30,58,138,0.08)'  : 'rgba(255,255,255,0.07)';
    const axisCol  = isLight ? 'rgba(30,58,138,0.18)'  : 'rgba(255,255,255,0.15)';
    const labelCol = isLight ? 'rgba(30,58,138,0.50)'  : 'rgba(255,255,255,0.40)';
    const incCol   = isLight ? 'rgba(22,163,74,0.85)'  : 'rgba(74,222,128,0.85)';
    const expCol   = isLight ? 'rgba(220,38,38,0.85)'  : 'rgba(248,113,113,0.85)';
    const FONT     = 'Noto Sans KR,sans-serif';

    // ── Y축 라인 ─────────────────────────────────────────
    let grid = `<line x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT+chartH}" stroke="${axisCol}" stroke-width="1.5"/>`;

    // ── Y축 눈금 4개 + 가로 그리드 라인 ─────────────────
    const TICKS = 4;
    for (let t = 1; t <= TICKS; t++) {
      const val = maxAmt * (t / TICKS);
      const y   = (pT + chartH - chartH * (t / TICKS)).toFixed(1);
      // 그리드 라인
      grid += `<line x1="${pL}" y1="${y}" x2="${W - pR}" y2="${y}" stroke="${gridCol}" stroke-width="1" stroke-dasharray="3 4"/>`;
      // Y축 눈금 텍스트 (우측 정렬, 바와 겹치지 않음)
      grid += `<text x="${pL - 5}" y="${(parseFloat(y) + 3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="${labelCol}" font-family="${FONT}">${fmtShort(val)}</text>`;
    }

    // ── 바 + 하단 이중 라벨 ──────────────────────────────
    let bars = '', labels = '';
    months.forEach((m, i) => {
      const cx  = pL + (i + 0.5) * mW;
      const incH = m.income  > 0 ? Math.max((m.income  / maxAmt) * chartH, 3) : 0;
      const expH = m.expense > 0 ? Math.max((m.expense / maxAmt) * chartH, 3) : 0;
      const incX = (cx - gap / 2 - bW).toFixed(1);
      const expX = (cx + gap / 2).toFixed(1);
      const baseY = pT + chartH;

      // 수입 바
      if (incH > 0) bars += `<rect x="${incX}" y="${(baseY - incH).toFixed(1)}" width="${bW}" height="${incH.toFixed(1)}" rx="4" fill="${incCol}"/>`;
      // 지출 바
      if (expH > 0) bars += `<rect x="${expX}" y="${(baseY - expH).toFixed(1)}" width="${bW}" height="${expH.toFixed(1)}" rx="4" fill="${expCol}"/>`;

      // 하단 라벨 1: 월 이름
      const monthY = (baseY + 18).toFixed(1);
      labels += `<text x="${cx.toFixed(1)}" y="${monthY}" text-anchor="middle" font-size="10.5" fill="${labelCol}" font-family="${FONT}" font-weight="700">${m.label}</text>`;

      // 하단 라벨 2: 순현금 (+/-) — 월 이름 아래
      const net     = m.income - m.expense;
      const netSign = net >= 0 ? '+' : '';
      const netCol  = net >= 0
        ? (isLight ? 'rgba(22,163,74,0.9)' : 'rgba(74,222,128,0.9)')
        : (isLight ? 'rgba(220,38,38,0.9)' : 'rgba(248,113,113,0.9)');
      const netY = (baseY + 34).toFixed(1);
      labels += `<text x="${cx.toFixed(1)}" y="${netY}" text-anchor="middle" font-size="9" fill="${netCol}" font-family="${FONT}" font-weight="700">${netSign}${fmtShort(net)}</text>`;
    });

    // ── 범례 (우상단) ────────────────────────────────────
    const lx = W - pR;
    const legend = `
      <circle cx="${lx-76}" cy="12" r="4.5" fill="${incCol}"/>
      <text x="${lx-68}" y="16" font-size="10" fill="${labelCol}" font-family="${FONT}">수입</text>
      <circle cx="${lx-36}" cy="12" r="4.5" fill="${expCol}"/>
      <text x="${lx-28}" y="16" font-size="10" fill="${labelCol}" font-family="${FONT}">지출</text>`;

    netEl.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">${grid}${bars}${labels}${legend}</svg>`;
  }

  // ── 카테고리별 지출 도넛 (클릭 시 모달) ──────────────
  const catTotals = {};
  state.entries.filter((e) => e.type === 'expense' && e.repeat === '매월')
    .forEach((e) => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
  const total = Object.values(catTotals).reduce((s, v) => s + v, 0);
  const cats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  const donutEl = document.getElementById('report-cat-donut');
  if (donutEl) {
    if (total === 0) {
      donutEl.innerHTML = '<div class="empty-state" style="padding:16px 0">지출 항목 없음</div>';
    } else {
      const svgPaths = _buildDonutSvg(cats, total, 44, 52, 52);
      const legend = cats.slice(0, 5).map(([cat, amt]) => {
        const col = REPORT_CAT_COLORS[cat] || '#64748b';
        const pct = Math.round((amt / total) * 100);
        return `<div class="report-cat-legend-row">
          <span style="width:8px;height:8px;border-radius:50%;background:${col};display:inline-block;flex-shrink:0"></span>
          <span style="font-size:11px;color:var(--text2)">${escapeHtml(cat)}</span>
          <div style="flex:1;height:4px;background:rgba(255,255,255,.07);border-radius:4px;margin:0 6px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${col};border-radius:4px;opacity:.8"></div>
          </div>
          <span style="font-size:11px;font-family:var(--mono);font-weight:700;color:var(--text)">${pct}%</span>
        </div>`;
      }).join('');
      donutEl.innerHTML = `
        <svg width="104" height="104" viewBox="0 0 104 104" style="flex-shrink:0">${svgPaths}</svg>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">${legend}</div>`;
    }
  }

  // ── 카테고리 모달 렌더링 (나중에 클릭 시 사용) ────────
  window._reportCatData = { cats, total };

  // ── TOP 지출 항목 ────────────────────────────────────
  const topEl = document.getElementById('report-top-expenses');
  if (topEl) {
    const expEntries = state.entries
      .filter((e) => e.type === 'expense' && e.repeat === '매월')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    if (!expEntries.length) {
      topEl.innerHTML = '<div class="empty-state" style="padding:12px 0">항목 없음</div>';
    } else {
      const maxAmt2 = expEntries[0].amount;
      topEl.innerHTML = expEntries.map((e, i) => {
        const col = REPORT_CAT_COLORS[e.category] || '#64748b';
        const pct = Math.round((e.amount / maxAmt2) * 100);
        return `<div class="report-top-item">
          <span class="report-top-rank">${i + 1}</span>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-size:13px;font-weight:700;color:var(--text)">${escapeHtml(e.name)}</span>
              <span style="font-family:var(--mono);font-size:13px;font-weight:800;color:var(--red2)">-${fmtShort(e.amount)}</span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,.07);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${col};border-radius:4px;opacity:.8;transition:width 0.5s ease"></div>
            </div>
            <div style="font-size:10px;color:var(--text3);margin-top:3px">${escapeHtml(e.category)} · 매월 ${e.day || '-'}일</div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // ── 재정 건강 지수 ────────────────────────────────────
  const healthEl = document.getElementById('report-health-score');
  if (healthEl) {
    const hs = _calcHealthScore(curMonth);
    const { score, color: scoreColor, label: scoreLabel, savingsRate, expenseRatio, halbuPct } = hs;

    healthEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
        <div class="report-health-circle" style="border-color:${scoreColor}">
          <div style="font-size:22px;font-weight:900;color:${scoreColor};font-family:var(--mono)">${score}</div>
          <div style="font-size:9px;color:var(--text3)">/ 100</div>
        </div>
        <div>
          <div style="font-size:16px;font-weight:800;color:${scoreColor}">${hs.grade}등급 · ${scoreLabel}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:3px">재정 건강 지수 (6개 항목)</div>
        </div>
      </div>
      <div class="report-health-items">
        <div class="report-health-row">
          <span>저축률</span>
          <div class="report-health-bar-wrap"><div class="report-health-bar" style="width:${Math.min(100,Math.max(0,savingsRate))}%;background:${savingsRate >= 20 ? 'var(--green2)' : savingsRate >= 0 ? 'var(--yellow)' : 'var(--red2)'}"></div></div>
          <span style="font-family:var(--mono);font-weight:700;color:${savingsRate >= 0 ? 'var(--green2)' : 'var(--red2)'}">${savingsRate}%</span>
        </div>
        <div class="report-health-row">
          <span>지출비율</span>
          <div class="report-health-bar-wrap"><div class="report-health-bar" style="width:${Math.min(100,expenseRatio)}%;background:${expenseRatio <= 70 ? 'var(--green2)' : expenseRatio <= 85 ? 'var(--yellow)' : 'var(--red2)'}"></div></div>
          <span style="font-family:var(--mono);font-weight:700">${expenseRatio}%</span>
        </div>
        <div class="report-health-row">
          <span>할부비중</span>
          <div class="report-health-bar-wrap"><div class="report-health-bar" style="width:${halbuPct}%;background:${halbuPct <= 10 ? 'var(--green2)' : halbuPct <= 25 ? 'var(--yellow)' : 'var(--red2)'}"></div></div>
          <span style="font-family:var(--mono);font-weight:700">${halbuPct}%</span>
        </div>
        <div class="report-health-row">
          <span>기록 스트릭</span>
          <div class="report-health-bar-wrap"><div class="report-health-bar" style="width:${Math.min(100, hs.streak / 14 * 100)}%;background:${hs.streak >= 7 ? 'var(--green2)' : hs.streak >= 3 ? 'var(--yellow)' : 'var(--red2)'}"></div></div>
          <span style="font-family:var(--mono);font-weight:700;color:${hs.streak >= 7 ? 'var(--green2)' : hs.streak >= 3 ? 'var(--yellow)' : 'var(--text2)'}">${hs.streak}일</span>
        </div>
        <div class="report-health-row">
          <span>예산준수</span>
          <div class="report-health-bar-wrap"><div class="report-health-bar" style="width:${hs.budgetCompliance !== null ? hs.budgetCompliance : 50}%;background:${hs.budgetCompliance === null ? 'var(--text3)' : hs.budgetCompliance >= 80 ? 'var(--green2)' : hs.budgetCompliance >= 50 ? 'var(--yellow)' : 'var(--red2)'}"></div></div>
          <span style="font-family:var(--mono);font-weight:700">${hs.budgetCompliance !== null ? hs.budgetCompliance + '%' : '-'}</span>
        </div>
      </div>`;
  }

  // ── 전월 비교 ────────────────────────────────────────
  const momEl = document.getElementById('report-mom-compare');
  if (momEl) {
    const expDelta = curMonth.expense - prevMonth.expense;
    const inDelta  = curMonth.income  - prevMonth.income;
    const netDelta = curMonth.net     - prevMonth.net;
    momEl.innerHTML = `
      <div class="report-mom-grid">
        <div class="report-mom-item">
          <div class="report-mom-label">수입</div>
          <div class="report-mom-value" style="color:var(--green2)">${fmtShort(curMonth.income)}</div>
          <div class="report-mom-delta" style="color:${inDelta >= 0 ? 'var(--green2)' : 'var(--red2)'}">
            ${inDelta >= 0 ? '▲' : '▼'} ${fmtShort(Math.abs(inDelta))} 전월비
          </div>
        </div>
        <div class="report-mom-item">
          <div class="report-mom-label">지출</div>
          <div class="report-mom-value" style="color:var(--red2)">${fmtShort(curMonth.expense)}</div>
          <div class="report-mom-delta" style="color:${expDelta <= 0 ? 'var(--green2)' : 'var(--red2)'}">
            ${expDelta > 0 ? '▲' : '▼'} ${fmtShort(Math.abs(expDelta))} 전월비
          </div>
        </div>
        <div class="report-mom-item">
          <div class="report-mom-label">순현금</div>
          <div class="report-mom-value" style="color:${curMonth.net >= 0 ? 'var(--green2)' : 'var(--red2)'}">${fmtSigned(curMonth.net)}</div>
          <div class="report-mom-delta" style="color:${netDelta >= 0 ? 'var(--green2)' : 'var(--red2)'}">
            ${netDelta >= 0 ? '▲' : '▼'} ${fmtShort(Math.abs(netDelta))} 전월비
          </div>
        </div>
      </div>`;
  }

  renderSimulator();
  renderWeeklyCoachingCard();
  _renderCategoryTrend();
  _renderPersonality();
  renderAnnualReview();
}

export function renderAnnualReview() {
  const yearNavEl = document.getElementById('annual-review-year-nav');
  const contentEl = document.getElementById('annual-review-content');
  if (!contentEl) return;

  const now = today();
  if (_annualReviewYear === null) _annualReviewYear = now.getFullYear();

  if (yearNavEl && !_annualReviewListenerReady) {
    yearNavEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-annual-year]');
      if (btn) {
        _annualReviewYear = parseInt(btn.dataset.annualYear, 10);
        renderAnnualReview();
      }
    });
    _annualReviewListenerReady = true;
  }

  if (yearNavEl) {
    const prevY = now.getFullYear() - 1;
    const curY = now.getFullYear();
    yearNavEl.innerHTML = [prevY, curY].map(y => `
      <button class="filter-tab ${_annualReviewYear === y ? 'active' : ''}" data-annual-year="${y}">${y}년</button>
    `).join('');
  }

  const yearPrefix = `${_annualReviewYear}-`;
  let totalIncome = 0, totalExpense = 0;
  const monthData = {};
  const catTotals = {};
  let recordDays = 0;

  for (const [dk, items] of Object.entries(state.ledgerData || {})) {
    if (!dk.startsWith(yearPrefix)) continue;
    const mm = dk.slice(5, 7);
    if (!monthData[mm]) monthData[mm] = { income: 0, expense: 0 };
    let hasEntry = false;
    for (const item of items) {
      if (item.type === 'expense') {
        totalExpense += item.amount;
        monthData[mm].expense += item.amount;
        catTotals[item.category] = (catTotals[item.category] || 0) + item.amount;
      } else {
        totalIncome += item.amount;
        monthData[mm].income += item.amount;
      }
      hasEntry = true;
    }
    if (hasEntry) recordDays++;
  }

  if (!totalIncome && !totalExpense) {
    contentEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-title">${_annualReviewYear}년 데이터 없음</div><div class="empty-state-desc">가계부에 지출/수입을 기록하면 연간 리뷰가 표시됩니다</div></div>`;
    return;
  }

  const totalSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;

  const months = Object.entries(monthData);
  const bestMonth = months.length ? months.reduce((b, [m, d]) => {
    const net = d.income - d.expense;
    return (!b || net > b.net) ? { m, net } : b;
  }, null) : null;
  const worstMonth = months.length ? months.reduce((w, [m, d]) => {
    const net = d.income - d.expense;
    return (!w || net < w.net) ? { m, net } : w;
  }, null) : null;
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  const netColor = totalSavings >= 0 ? 'var(--green2)' : 'var(--red2)';
  const srColor = savingsRate >= 20 ? 'var(--green2)' : savingsRate >= 0 ? 'var(--yellow)' : 'var(--red2)';

  contentEl.innerHTML = `
    <div class="annual-review-cards">
      <div class="annual-review-stat-card">
        <div class="ar-stat-icon">💰</div>
        <div class="ar-stat-label">총 수입</div>
        <div class="ar-stat-value" style="color:var(--green2)">${fmtShort(totalIncome)}</div>
      </div>
      <div class="annual-review-stat-card">
        <div class="ar-stat-icon">💸</div>
        <div class="ar-stat-label">총 지출</div>
        <div class="ar-stat-value" style="color:var(--red2)">${fmtShort(totalExpense)}</div>
      </div>
      <div class="annual-review-stat-card">
        <div class="ar-stat-icon">📈</div>
        <div class="ar-stat-label">총 저축</div>
        <div class="ar-stat-value" style="color:${netColor}">${fmtSigned(totalSavings)}</div>
      </div>
      <div class="annual-review-stat-card">
        <div class="ar-stat-icon">🎯</div>
        <div class="ar-stat-label">저축률</div>
        <div class="ar-stat-value" style="color:${srColor}">${savingsRate}%</div>
      </div>
    </div>
    <div class="annual-review-highlights">
      ${topCat ? `<div class="ar-highlight-row"><span class="ar-hl-icon">🏆</span><div><div class="ar-hl-title">최다 지출 카테고리</div><div class="ar-hl-val">${escapeHtml(topCat[0])} <span style="color:var(--red2)">${fmtShort(topCat[1])}</span></div></div></div>` : ''}
      ${bestMonth ? `<div class="ar-highlight-row"><span class="ar-hl-icon">⭐</span><div><div class="ar-hl-title">최고 절약한 달</div><div class="ar-hl-val">${parseInt(bestMonth.m, 10)}월 <span style="color:var(--green2)">${fmtSigned(bestMonth.net)}</span></div></div></div>` : ''}
      ${worstMonth && worstMonth.m !== bestMonth?.m ? `<div class="ar-highlight-row"><span class="ar-hl-icon">😅</span><div><div class="ar-hl-title">지출이 많았던 달</div><div class="ar-hl-val">${parseInt(worstMonth.m, 10)}월 <span style="color:var(--red2)">${fmtSigned(worstMonth.net)}</span></div></div></div>` : ''}
      <div class="ar-highlight-row"><span class="ar-hl-icon">📝</span><div><div class="ar-hl-title">가계부 기록한 날</div><div class="ar-hl-val">${recordDays}일</div></div></div>
    </div>`;
}

export function renderReportCatModal() {
  const { cats, total } = window._reportCatData || { cats: [], total: 0 };
  const el = document.getElementById('report-cat-modal-content');
  if (!el || !cats.length) return;

  const svgPaths = _buildDonutSvg(cats, total, 68, 80, 80);
  const rows = cats.map(([cat, amt], i) => {
    const col = REPORT_CAT_COLORS[cat] || '#64748b';
    const pct = Math.round((amt / total) * 100);
    return `<div class="report-modal-cat-row" style="animation-delay:${i * 40}ms">
      <span style="width:10px;height:10px;border-radius:50%;background:${col};flex-shrink:0;margin-top:3px"></span>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:14px;font-weight:700">${escapeHtml(cat)}</span>
          <span style="font-family:var(--mono);font-size:14px;font-weight:800;color:var(--red2)">-${fmtShort(amt)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:5px">
          <div style="flex:1;height:6px;background:rgba(255,255,255,.07);border-radius:6px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${col};border-radius:6px;opacity:.85"></div>
          </div>
          <span style="font-size:11px;color:var(--text3);min-width:30px;text-align:right">${pct}%</span>
        </div>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;padding:16px 0 8px">
      <svg width="160" height="160" viewBox="0 0 160 160">${svgPaths}
        <text x="80" y="76" fill="var(--text)" font-size="11" text-anchor="middle" font-family="monospace" font-weight="700">총 지출</text>
        <text x="80" y="91" fill="var(--accent2)" font-size="13" text-anchor="middle" font-family="monospace" font-weight="900">${fmtShort(total)}</text>
      </svg>
    </div>
    <div style="padding:0 4px 16px;display:flex;flex-direction:column;gap:10px">${rows}</div>`;
}

// ════════════════════════════════════════════════════════
// 목표 탭
// ════════════════════════════════════════════════════════
function _goalRing(pct, color, size) {
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  const cx = size / 2, cy = size / 2;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="5"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="5"
        stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
        stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
        style="transition:stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)"/>
    </svg>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
      <span style="font-size:11px;font-weight:900;color:${color};font-family:var(--mono);line-height:1">${pct}%</span>
    </div>`;
}

export function renderGoals() {
  const container = document.getElementById('goals-list');
  if (!container) return;

  const goals = state.goals || [];
  if (!goals.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-illu">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
        </svg>
      </div>
      <div class="empty-state-title">목표가 없습니다</div>
      <div class="empty-state-desc">저축 목표를 설정하면 달성률과<br>예상 완료일을 자동으로 계산해드려요</div>
    </div>`;
    return;
  }

  const now = today();
  const nowYm = yyyymm(now);

  // 전체 진행 상황 요약
  const totalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
  const totalTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
  const completedCount = goals.filter(g => (g.savedAmount || 0) >= (g.targetAmount || 1)).length;

  const summaryHtml = `
    <div class="card" style="margin-bottom:12px;background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08));border-color:rgba(99,102,241,0.2)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div>
          <div style="font-size:11px;color:var(--text3);font-weight:700;letter-spacing:0.5px;margin-bottom:3px">전체 목표 달성률</div>
          <div style="font-family:var(--mono);font-size:26px;font-weight:900;color:var(--accent2)">${overallPct}%</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--text3);margin-bottom:3px">${goals.length}개 목표 중 ${completedCount}개 달성</div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${fmtShort(totalSaved)} / ${fmtShort(totalTarget)}</div>
        </div>
      </div>
      <div class="goal-progress-track" style="height:8px">
        <div class="goal-progress-fill" style="width:${overallPct}%;background:linear-gradient(90deg,var(--accent2),#8b5cf6)"></div>
      </div>
    </div>`;

  const goalCards = goals.map((g, goalIndex) => {
    const saved = g.savedAmount || 0;
    const target = g.targetAmount || 1;
    const pct = Math.min(100, Math.round((saved / target) * 100));
    const remaining = Math.max(0, target - saved);

    let monthsLeft = 0;
    let monthlyRequired = 0;
    let daysLeft = 0;
    let urgency = '';
    if (g.targetDate) {
      const ty = parseInt(g.targetDate.slice(0, 4), 10);
      const tm = parseInt(g.targetDate.slice(4), 10) - 1;
      monthsLeft = Math.max(0, (ty - now.getFullYear()) * 12 + (tm - now.getMonth()));
      monthlyRequired = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
      daysLeft = Math.max(0, Math.round((new Date(ty, tm + 1, 0) - now) / 86400000));
      if (monthsLeft <= 1 && pct < 100) urgency = 'urgent';
      else if (monthsLeft <= 3 && pct < 100) urgency = 'warning';
    }
    const barColor = pct >= 100 ? 'var(--green2)' : urgency === 'urgent' ? 'var(--red2)' : urgency === 'warning' ? 'var(--orange)' : pct >= 60 ? 'var(--accent2)' : '#60a5fa';
    if (pct >= 100 && !_celebratedGoals.has(g.id)) {
      _celebratedGoals.add(g.id);
      setTimeout(() => window.launchConfetti?.(), 400);
    }

    // 실제 저축 속도 (최근 3개월 가계부 기준)
    const now3 = today();
    let actualMonthlySavings = 0;
    let validMonths3 = 0;
    for (let mi = 1; mi <= 3; mi++) {
      let mm = now3.getMonth() - mi;
      let yy = now3.getFullYear();
      if (mm < 0) { mm += 12; yy--; }
      const ml = getLedgerMonth(yy, mm);
      if (ml.income > 0 || ml.expense > 0) {
        actualMonthlySavings += (ml.income - ml.expense);
        validMonths3++;
      }
    }
    if (validMonths3 > 0) actualMonthlySavings = Math.round(actualMonthlySavings / validMonths3);
    const monthsToFinish = actualMonthlySavings > 0 ? Math.ceil(remaining / actualMonthlySavings) : null;
    const paceOk = monthsToFinish !== null && monthsLeft > 0 && actualMonthlySavings >= monthlyRequired;
    const paceHtml = pct < 100 && validMonths3 > 0 ? (() => {
      if (!g.targetDate && monthsToFinish !== null && monthsToFinish > 0)
        return `<div style="font-size:11px;padding:7px 10px;border-radius:10px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);margin-bottom:8px">
          💡 현재 속도(${fmtShort(actualMonthlySavings)}/월)라면 약 <strong>${monthsToFinish}개월</strong> 후 달성</div>`;
      if (g.targetDate && monthsLeft > 0)
        return `<div style="font-size:11px;padding:7px 10px;border-radius:10px;background:${paceOk ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'};border:1px solid ${paceOk ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'};margin-bottom:8px">
          ${paceOk ? '✅' : '⚠️'} 현재 속도 ${fmtShort(actualMonthlySavings)}/월 ${paceOk ? '— 기한 내 달성 가능' : `— ${fmtShort(monthlyRequired - actualMonthlySavings)}/월 부족`}</div>`;
      return '';
    })() : '';

    return `
      <div class="goal-card stagger-item ${urgency ? 'goal-card-' + urgency : ''}" data-goal-id="${g.id}" style="cursor:default;--stagger-idx:${goalIndex}">
        <div class="goal-card-top">
          <div class="goal-emoji">${escapeHtml(g.emoji || '🎯')}</div>
          <div class="goal-info">
            <div class="goal-name">${escapeHtml(g.name)}</div>
            ${g.targetDate ? `
              <div style="display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap">
                <div class="goal-date">${g.targetDate.slice(0, 4)}년 ${parseInt(g.targetDate.slice(4), 10)}월 목표</div>
                ${monthsLeft > 0 ? `<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:${urgency === 'urgent' ? 'rgba(239,68,68,0.15)' : urgency === 'warning' ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.07)'};color:${urgency === 'urgent' ? 'var(--red2)' : urgency === 'warning' ? 'var(--orange)' : 'var(--text3)'}">D-${daysLeft}</span>` : ''}
              </div>` : ''}
          </div>
          <div style="display:flex;gap:6px;margin-left:auto;align-items:flex-start">
            <button class="icon-btn edit goal-edit-btn" data-id="${g.id}" title="수정">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button class="icon-btn del goal-del-btn" data-id="${g.id}" title="삭제">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>
          </div>
        </div>

        <!-- 원형 링 + 저축 현황 -->
        <div style="display:flex;align-items:center;gap:16px;margin:12px 0 10px">
          <div style="position:relative;width:64px;height:64px;flex-shrink:0">
            ${_goalRing(pct, barColor, 64)}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;color:var(--text3);font-weight:700;letter-spacing:0.5px;margin-bottom:4px">저축 현황</div>
            <div style="display:flex;align-items:baseline;gap:5px;flex-wrap:wrap">
              <span style="font-family:var(--mono);font-size:20px;font-weight:900;color:var(--accent2)">${fmtFull(saved)}</span>
              <span style="font-size:11px;color:var(--text3)">/ ${fmtShort(target)}</span>
            </div>
            ${pct < 100 ? `<div style="font-size:11px;color:var(--text3);margin-top:3px">${fmtShort(remaining)} 남음</div>` : '<div style="font-size:12px;font-weight:700;color:var(--green2);margin-top:3px">🎉 달성 완료!</div>'}
          </div>
        </div>

        <!-- 월 필요 저축액 & 상태 -->
        ${pct < 100 && monthsLeft > 0 ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div style="padding:8px 10px;border-radius:10px;background:var(--bg3);border:1px solid var(--border)">
            <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:3px">월 필요 저축액</div>
            <div style="font-family:var(--mono);font-size:14px;font-weight:900;color:${urgency === 'urgent' ? 'var(--red2)' : 'var(--text)'}">${fmtShort(monthlyRequired)}</div>
          </div>
          <div style="padding:8px 10px;border-radius:10px;background:var(--bg3);border:1px solid var(--border)">
            <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:3px">남은 기간</div>
            <div style="font-family:var(--mono);font-size:14px;font-weight:900;color:var(--text)">${monthsLeft}개월</div>
          </div>
        </div>
        ${urgency === 'urgent' ? `<div style="font-size:11px;color:var(--red2);padding:8px 10px;border-radius:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);margin-bottom:8px">⚠️ 목표 기간이 얼마 남지 않았습니다</div>` : ''}
        ${paceHtml}
        ` : pct >= 100 ? `
        <div style="font-size:13px;color:var(--green2);padding:10px;border-radius:10px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);margin-bottom:10px;text-align:center">
          🎉 목표를 달성했어요! 훌륭합니다!
        </div>
        ` : paceHtml ? paceHtml : ''}

        <!-- 공유 코드 -->
        <div class="goal-share-row" style="justify-content:space-between;align-items:center">
          <button class="goal-share-btn" data-share-id="${g.id}">🔗 ${g.sharedCode ? '코드 복사' : '공유 코드 생성'}</button>
          ${g.sharedCode ? `<span class="goal-invite-code-inline">${escapeHtml(g.sharedCode)}</span>` : ''}
          ${g.sharedFrom ? `<span style="font-size:10px;color:var(--text3)">📎 ${escapeHtml(g.sharedFrom)}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  container.innerHTML = summaryHtml + goalCards;
}

// ════════════════════════════════════════════════════════
// 하우스 레벨 카드
// ════════════════════════════════════════════════════════
export function renderHouseLevel() {
  const el = document.getElementById('house-level-card');
  if (!el) return;

  const totalAssets = getTotalAssets(state.assets);
  const netWorth = totalAssets; // simplified: total assets as net worth
  const level = getHouseLevel(netWorth);

  const pct = level.next && level.next > 0
    ? Math.min(100, Math.round((netWorth / level.next) * 100))
    : 100;

  el.setAttribute('data-house-detail', '1');
  // 레벨 바 미니 (전체 레벨 중 현재 위치)
  const miniLevels = HOUSE_LEVELS.map((l, i) => {
    const isActive = i === level.index;
    const isPast = i < level.index;
    return `<div title="${l.label}" style="flex:1;height:6px;border-radius:3px;background:${isPast ? l.color : isActive ? l.color : 'var(--bg3)'};opacity:${isActive ? 1 : isPast ? 0.6 : 0.3};transition:all 0.3s"></div>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:42px;line-height:1;filter:drop-shadow(0 2px 8px ${level.color}66)">${level.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
          <div style="font-size:16px;font-weight:900;color:var(--text)">${level.label}</div>
          <div style="font-size:9px;padding:2px 6px;border-radius:6px;font-weight:800;background:${level.color}22;color:${level.color};border:1px solid ${level.color}44">${level.sublabel}</div>
        </div>
        <div style="font-size:11px;color:var(--text3)">순자산 ${fmtShort(netWorth)} · ${level.index + 1}/${HOUSE_LEVELS.length} 단계</div>
        ${level.next ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">다음: ${level.nextIcon} ${level.nextLabel} · ${fmtShort(level.next - netWorth)} 부족</div>` : '<div style="font-size:10px;color:#f59e0b;margin-top:2px;font-weight:700">🏆 최고 레벨 달성!</div>'}
      </div>
    </div>
    ${level.next ? `
    <div style="margin-top:10px">
      <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3);margin-bottom:4px">
        <span>현재 레벨 진행도</span><span style="color:${level.color};font-weight:700">${pct}%</span>
      </div>
      <div class="house-progress-track">
        <div class="house-progress-fill" style="width:${pct}%;background:${level.color}"></div>
      </div>
    </div>` : ''}
    <div style="display:flex;gap:3px;margin-top:10px;align-items:center">${miniLevels}</div>
    <div style="font-size:10px;color:var(--accent2);text-align:center;margin-top:8px;opacity:0.7;letter-spacing:0.3px">▼ 탭해서 전체 레벨 보기</div>
  `;
}

// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// 홈 인사이트 — 무지출 일수 + TOP3 카테고리 + 지난달 대비
// ════════════════════════════════════════════════════════
function _renderHomeInsights() {
  const el = document.getElementById('home-month-insights');
  if (!el) return;
  const now = today();
  const y = now.getFullYear(), m = now.getMonth();
  const { expense, catTotals } = getLedgerMonth(y, m);

  // 무지출 일수
  const prefix = `${y}-${p2(m + 1)}`;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const elapsed = now.getDate();
  let zeroDays = 0;
  for (let d = 1; d <= elapsed; d++) {
    const dk = `${prefix}-${p2(d)}`;
    const items = state.ledgerData?.[dk] || [];
    if (items.filter(i => i.type === 'expense').length === 0) zeroDays++;
  }

  // 지난달 비교
  let prevM = m - 1, prevY = y;
  if (prevM < 0) { prevM = 11; prevY--; }
  const { expense: prevExp } = getLedgerMonth(prevY, prevM);
  const diff = expense - prevExp;
  const diffPct = prevExp > 0 ? Math.round((diff / prevExp) * 100) : 0;

  // TOP 3 카테고리
  const top3 = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 3);

  if (expense === 0 && zeroDays === 0) { el.innerHTML = ''; return; }

  const vsLastMonth = prevExp > 0 ? `
    <div style="display:flex;align-items:center;gap:4px">
      <span style="font-size:10px;color:var(--text3)">전월비</span>
      <span style="font-size:12px;font-weight:700;color:${diff > 0 ? 'var(--red2)' : 'var(--green2)'}">${diff > 0 ? '▲' : '▼'}${Math.abs(diffPct)}%</span>
    </div>` : '';

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.15);border-radius:12px;padding:10px">
        <div style="font-size:9px;color:var(--text3);margin-bottom:3px">이번달 무지출</div>
        <div style="font-size:22px;font-weight:900;color:var(--green2);font-family:var(--mono)">${zeroDays}<span style="font-size:11px;color:var(--text3);font-weight:400">일</span></div>
        <div style="font-size:9px;color:var(--text3);margin-top:2px">${elapsed}일 중 ${zeroDays}일</div>
      </div>
      <div style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.15);border-radius:12px;padding:10px">
        <div style="font-size:9px;color:var(--text3);margin-bottom:3px">이번달 지출</div>
        <div style="font-size:22px;font-weight:900;color:var(--red2);font-family:var(--mono)">${fmtShort(expense)}</div>
        ${vsLastMonth}
      </div>
    </div>
    ${top3.length > 0 ? `
    <div class="card" style="padding:10px 12px">
      <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:0.5px;margin-bottom:8px">TOP 3 지출 카테고리</div>
      ${top3.map(([cat, amt], i) => {
        const col = LEDGER_CAT_COLORS[cat] || '#64748b';
        const pct = expense > 0 ? Math.round((amt / expense) * 100) : 0;
        const ranks = ['🥇','🥈','🥉'];
        return `<div style="display:flex;align-items:center;gap:8px;${i > 0 ? 'margin-top:6px' : ''}">
          <span style="font-size:13px">${ranks[i]}</span>
          <span style="font-size:11px;color:var(--text2);flex:1;font-weight:600">${cat}</span>
          <div style="flex:1;max-width:80px;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${col};border-radius:2px"></div>
          </div>
          <span style="font-size:11px;font-family:var(--mono);color:var(--text2);min-width:50px;text-align:right">${fmtShort(amt)}</span>
        </div>`;
      }).join('')}
    </div>` : ''}`;
}

// ════════════════════════════════════════════════════════
// 월별 결산 카드 (새 달 첫 접속 시)
// ════════════════════════════════════════════════════════
function _renderMonthlyRecap() {
  const el = document.getElementById('home-monthly-recap');
  if (!el) return;
  const now = today();
  const currentYm = now.getFullYear() * 100 + (now.getMonth() + 1);
  const lastSeen = state.lastSeenMonth || 0;
  // 이번 달이 처음 열린 경우 (지난달 결산 표시)
  if (lastSeen === currentYm || lastSeen === 0) {
    if (lastSeen === 0) { state.lastSeenMonth = currentYm; }
    el.style.display = 'none';
    return;
  }
  // 지난달 데이터 가져오기
  const prevYm = lastSeen;
  const prevY = Math.floor(prevYm / 100);
  const prevM = (prevYm % 100) - 1;
  const { expense, income, net, catTotals } = getLedgerMonth(prevY, prevM);
  const savRate = income > 0 ? Math.max(0, Math.round(((income - expense) / income) * 100)) : 0;
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  state.lastSeenMonth = currentYm;

  if (expense === 0 && income === 0) { el.style.display = 'none'; return; }

  el.style.display = '';
  el.innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(99,102,241,0.14),rgba(139,92,246,0.10));border:1px solid rgba(129,140,248,0.25);border-radius:16px;padding:14px;position:relative">
      <button id="btn-close-recap" style="position:absolute;top:8px;right:10px;background:none;border:none;color:var(--text3);font-size:16px;cursor:pointer;padding:4px">✕</button>
      <div style="font-size:10px;font-weight:700;color:#a78bfa;letter-spacing:0.5px;margin-bottom:10px">📋 ${prevM + 1}월 결산</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">
        <div><div style="font-size:9px;color:var(--text3);margin-bottom:2px">수입</div><div style="font-size:15px;font-weight:900;color:var(--green2);font-family:var(--mono)">${fmtShort(income)}</div></div>
        <div><div style="font-size:9px;color:var(--text3);margin-bottom:2px">지출</div><div style="font-size:15px;font-weight:900;color:var(--red2);font-family:var(--mono)">${fmtShort(expense)}</div></div>
        <div><div style="font-size:9px;color:var(--text3);margin-bottom:2px">저축률</div><div style="font-size:15px;font-weight:900;color:${savRate >= 20 ? 'var(--green2)' : 'var(--orange)'};font-family:var(--mono)">${savRate}%</div></div>
      </div>
      ${topCat ? `<div style="font-size:11px;color:var(--text2)">가장 많이 쓴 항목: <strong style="color:var(--text)">${topCat[0]}</strong> (${fmtShort(topCat[1])})</div>` : ''}
    </div>`;
  document.getElementById('btn-close-recap')?.addEventListener('click', () => {
    el.style.display = 'none';
  });
}

// ════════════════════════════════════════════════════════
// 지출 이상 감지 카드 (Gemini 없는 순수 로직)
// ════════════════════════════════════════════════════════
function _renderAnomalyCard() {
  const el = document.getElementById('home-anomaly-card');
  if (!el) return;
  const now = today();
  const y = now.getFullYear(), m = now.getMonth();
  const { catTotals: catThis } = getLedgerMonth(y, m);
  // 3개월 평균 계산
  const catAvg = {};
  for (let i = 1; i <= 3; i++) {
    let pm = m - i, py = y;
    if (pm < 0) { pm += 12; py--; }
    const { catTotals } = getLedgerMonth(py, pm);
    for (const [cat, amt] of Object.entries(catTotals)) {
      catAvg[cat] = (catAvg[cat] || 0) + amt / 3;
    }
  }
  const anomalies = [];
  for (const [cat, amt] of Object.entries(catThis)) {
    const avg = catAvg[cat] || 0;
    if (avg > 0) {
      const pct = Math.round(((amt - avg) / avg) * 100);
      if (pct >= 50) anomalies.push({ cat, amt, avg, pct });
    }
  }
  anomalies.sort((a, b) => b.pct - a.pct);
  if (!anomalies.length) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = `
    <div style="background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.25);border-radius:14px;padding:12px">
      <div style="font-size:10px;font-weight:700;color:var(--orange);letter-spacing:0.5px;margin-bottom:8px">⚠️ 지출 이상 감지 — 최근 3개월 평균 대비</div>
      ${anomalies.slice(0, 3).map(a => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
          <span style="font-size:12px;color:var(--text2)">${a.cat}</span>
          <div style="text-align:right">
            <span style="font-size:12px;font-weight:700;color:var(--red2);font-family:var(--mono)">${fmtShort(a.amt)}</span>
            <span style="font-size:10px;color:var(--orange);margin-left:6px">▲${a.pct}%</span>
            <div style="font-size:9px;color:var(--text3)">평균 ${fmtShort(Math.round(a.avg))}</div>
          </div>
        </div>`).join('')}
    </div>`;
}

// ════════════════════════════════════════════════════════
// 청구서 알림 (D-3 이내 고정 지출)
// ════════════════════════════════════════════════════════
function _renderBillRemind() {
  const el = document.getElementById('home-bill-remind');
  if (!el) return;
  const now = today();
  const bills = [];
  for (const entry of (state.entries || [])) {
    if (entry.type !== 'expense' || entry.repeat !== '매월' || !entry.day) continue;
    const endM = entry.endMonth ? parseInt(entry.endMonth, 10) : null;
    const nowYm = now.getFullYear() * 100 + (now.getMonth() + 1);
    if (endM && endM < nowYm) continue;
    let billDate = new Date(now.getFullYear(), now.getMonth(), entry.day);
    if (billDate < now) billDate = new Date(now.getFullYear(), now.getMonth() + 1, entry.day);
    const daysLeft = Math.round((billDate - now) / 86400000);
    if (daysLeft >= 0 && daysLeft <= 3) bills.push({ entry, daysLeft });
  }
  if (!bills.length) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = `
    <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:14px;padding:12px">
      <div style="font-size:10px;font-weight:700;color:var(--red2);letter-spacing:0.5px;margin-bottom:8px">🔔 곧 청구 예정</div>
      ${bills.map(({ entry, daysLeft }) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
          <div>
            <span style="font-size:12px;color:var(--text)">${escapeHtml(entry.name)}</span>
            <span style="font-size:10px;color:var(--text3);margin-left:6px">${entry.category || ''}</span>
          </div>
          <div style="text-align:right">
            <div style="font-size:13px;font-weight:800;color:var(--red2);font-family:var(--mono)">${fmtShort(entry.amount)}</div>
            <div style="font-size:10px;color:${daysLeft === 0 ? 'var(--red2)' : 'var(--orange)'};font-weight:700">${daysLeft === 0 ? '오늘!' : `D-${daysLeft}`}</div>
          </div>
        </div>`).join('')}
    </div>`;
}

// 스트릭 칩
// ════════════════════════════════════════════════════════
export function renderStreak() {
  const el = document.getElementById('streak-chip-home');
  if (!el) return;

  const { count, hasToday } = computeStreak(state.ledgerData);
  if (count === 0) {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'inline-flex';
  el.innerHTML = `🔥 ${count}일 연속 기록 중${hasToday ? ' ✓' : ''}`;
}

// ════════════════════════════════════════════════════════
// 자산 탭
// ════════════════════════════════════════════════════════
export function renderAssets() {
  const container = document.getElementById('assets-page-content');
  if (!container) return;

  const assets = state.assets || [];
  const total = getTotalAssets(assets);
  const usable = getUsableMoney(assets);
  const byPurpose = getAssetsByPurpose(assets);

  // Purpose donut SVG
  const purposes = Object.entries(byPurpose).sort((a, b) => b[1] - a[1]);
  let donutSvg = '';
  const R = 40, CX = 48, CY = 48;
  if (purposes.length > 0 && total > 0) {
    let angle = -Math.PI / 2;
    purposes.forEach(([purpose, amt]) => {
      const pct = amt / total;
      const a = pct * 2 * Math.PI;
      const x1 = CX + R * Math.cos(angle);
      const y1 = CY + R * Math.sin(angle);
      const x2 = CX + R * Math.cos(angle + a);
      const y2 = CY + R * Math.sin(angle + a);
      const large = a > Math.PI ? 1 : 0;
      const col = PURPOSE_COLORS[purpose] || '#64748b';
      donutSvg += `<path d="M${CX},${CY} L${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${col}" opacity="0.88"/>`;
      angle += a;
    });
    donutSvg += `<circle cx="${CX}" cy="${CY}" r="24" fill="var(--bg2)"/>`;
    donutSvg += `<text x="${CX}" y="${CY + 4}" fill="var(--text)" font-size="9" text-anchor="middle" font-family="monospace" font-weight="700">${fmtShort(total)}</text>`;
  }

  const purposeLegend = purposes.map(([p, amt]) => {
    const col = PURPOSE_COLORS[p] || '#64748b';
    return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2)">
      <span style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0"></span>
      <span>${escapeHtml(p)}</span>
      <span style="margin-left:auto;font-family:var(--mono);font-weight:700">${fmtShort(amt)}</span>
    </div>`;
  }).join('');

  // Asset list
  const assetItems = assets.map(a => {
    const typeInfo = ASSET_TYPES[a.type] || ASSET_TYPES.other;
    const col = PURPOSE_COLORS[a.purpose] || '#64748b';
    return `
      <div class="asset-card">
        <div class="asset-icon">${typeInfo.icon}</div>
        <div class="asset-info">
          <div class="asset-name">${escapeHtml(a.name)}</div>
          <div style="display:flex;gap:6px;align-items:center;margin-top:3px">
            <span class="purpose-tag" style="background:${col}22;color:${col};border-color:${col}44">${escapeHtml(a.purpose)}</span>
            <span style="font-size:10px;color:var(--text3)">${escapeHtml(typeInfo.label)}</span>
          </div>
          ${a.memo ? `<div style="font-size:10px;color:var(--text3);margin-top:3px">${escapeHtml(a.memo)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span class="asset-amount">${fmtShort(a.amount)}</span>
          <div style="display:flex;gap:4px">
            <button class="icon-btn edit asset-edit-btn" data-id="${a.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button class="icon-btn del asset-del-btn" data-id="${a.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  // 순자산 히스토리 스냅샷 저장
  if (total > 0) {
    const now2 = today();
    const ym2 = now2.getFullYear() * 100 + (now2.getMonth() + 1);
    if (!state.netWorthHistory) state.netWorthHistory = [];
    const existing = state.netWorthHistory.findIndex(h => h.ym === ym2);
    if (existing >= 0) state.netWorthHistory[existing].total = total;
    else state.netWorthHistory.push({ ym: ym2, total });
    state.netWorthHistory.sort((a, b) => a.ym - b.ym);
    if (state.netWorthHistory.length > 24) state.netWorthHistory = state.netWorthHistory.slice(-24);
  }

  // 순자산 히스토리 미니 차트
  const history = (state.netWorthHistory || []).slice(-12);
  let historyChart = '';
  if (history.length >= 2) {
    const W = 280, H = 60;
    const minV = Math.min(...history.map(h => h.total));
    const maxV = Math.max(...history.map(h => h.total));
    const range = Math.max(maxV - minV, 1);
    const pts = history.map((h, i) => {
      const x = (i / (history.length - 1)) * W;
      const y = H - ((h.total - minV) / range) * (H - 8) - 4;
      return [x.toFixed(1), y.toFixed(1)];
    });
    const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
    const areaD = `${lineD} L${pts[pts.length-1][0]},${H} L${pts[0][0]},${H} Z`;
    const trend = history[history.length-1].total - history[0].total;
    const trendColor = trend >= 0 ? '#34d399' : '#f87171';
    historyChart = `
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:10px;font-weight:700;color:var(--text3)">${history.length}개월 순자산 추이</span>
          <span style="font-size:11px;font-weight:700;color:${trendColor}">${trend >= 0 ? '▲' : '▼'} ${fmtShort(Math.abs(trend))}</span>
        </div>
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width:100%;overflow:visible">
          <defs>
            <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${trendColor}" stop-opacity="0.3"/>
              <stop offset="100%" stop-color="${trendColor}" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="${areaD}" fill="url(#nwGrad)"/>
          <path d="${lineD}" fill="none" stroke="${trendColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="${pts[pts.length-1][0]}" cy="${pts[pts.length-1][1]}" r="3" fill="${trendColor}"/>
        </svg>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3);margin-top:2px">
          <span>${Math.floor(history[0].ym / 100)}/${history[0].ym % 100}월</span>
          <span>${Math.floor(history[history.length-1].ym / 100)}/${history[history.length-1].ym % 100}월</span>
        </div>
      </div>`;
  }

  container.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:1px">총 자산</div>
          <div style="font-family:var(--mono);font-size:28px;font-weight:900;color:var(--text)">${fmtShort(total)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--text3)">사용 가능</div>
          <div style="font-family:var(--mono);font-size:18px;font-weight:700;color:var(--accent2)">${fmtShort(usable)}</div>
        </div>
      </div>
      ${purposes.length > 0 ? `
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <svg width="96" height="96" viewBox="0 0 96 96" style="flex-shrink:0">${donutSvg}</svg>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:140px">${purposeLegend}</div>
      </div>` : ''}
      ${historyChart}
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">자산 목록</div>
      ${assets.length === 0 ? `<div class="empty-state">
        <div class="empty-state-illu">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
        <div class="empty-state-title">자산 없음</div>
        <div class="empty-state-desc">예금·투자·부동산 등 자산을 등록하면<br>순자산과 집 레벨을 추적할 수 있어요</div>
      </div>` : `<div class="assets-list">${assetItems}</div>`}
    </div>

    <!-- 배지 섹션 -->
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div class="card-title" style="margin:0">🏅 배지 컬렉션</div>
        <div style="font-size:11px;color:var(--text3)">${(state.badges||[]).length} / ${BADGE_DEFS.length} 획득</div>
      </div>
      <!-- 카테고리별 필터 -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px" id="badge-cat-filters">
        ${['전체','기록','자산','절약','부채','목표','레벨','시작','특별','투자','성취','도전'].map(cat =>
          `<button class="badge-filter-btn${cat==='전체'?' active':''}" data-cat="${cat}" style="padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700;border:1px solid var(--border);background:${cat==='전체'?'var(--accent)':'var(--bg3)'};color:${cat==='전체'?'#fff':'var(--text2)'};cursor:pointer">${cat}</button>`
        ).join('')}
      </div>
      <!-- 희귀도 범례 -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${Object.entries(RARITY_CONFIG).map(([k,v]) =>
          `<div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:50%;background:${v.color}"></div><span style="font-size:9px;color:var(--text3);font-weight:700">${v.label}</span></div>`
        ).join('')}
      </div>
      <div class="badge-grid" id="badge-grid-main">
        ${BADGE_DEFS.map(b => {
          const earned = (state.badges || []).includes(b.id);
          const r = RARITY_CONFIG[b.rarity] || RARITY_CONFIG.common;
          const glowStyle = earned && r.glow ? `box-shadow:0 0 16px ${r.color}55;` : '';
          return `<div class="badge-item ${earned ? 'earned' : 'locked'}" data-badge-id="${b.id}" data-badge-cat="${b.category}" title="${escapeHtml(b.desc)}" style="cursor:pointer;${earned ? `background:${r.bg};border-color:${r.border};${glowStyle}` : ''}">
            <div style="position:relative;display:inline-block">
              <span style="font-size:28px;${earned ? '' : 'filter:grayscale(1) opacity(0.3)'}">${b.icon}</span>
              ${earned ? `<div style="position:absolute;bottom:-2px;right:-4px;font-size:8px;background:${r.color};color:#fff;border-radius:4px;padding:1px 3px;font-weight:900;line-height:1">${r.label[0]}</div>` : ''}
            </div>
            <span style="font-size:10px;font-weight:800;color:${earned ? 'var(--text)' : 'var(--text3)'};margin-top:4px;line-height:1.2;text-align:center">${escapeHtml(b.label)}</span>
            <span style="font-size:8px;color:${earned ? r.color : 'var(--text3)'};font-weight:700">${earned ? r.label : '미획득'}</span>
            <span style="font-size:8px;color:var(--text3);text-align:center;line-height:1.3;margin-top:2px">${escapeHtml(b.desc)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════
// 예산 탭
// ════════════════════════════════════════════════════════
export function renderBudget() {
  const container = document.getElementById('budget-page-content');
  if (!container) return;

  let budgetYear, budgetMonth;
  try {
    const uiModule = window._budgetUiRef;
    budgetYear  = uiModule?.getBudgetYear?.()  ?? new Date().getFullYear();
    budgetMonth = uiModule?.getBudgetMonth?.() ?? new Date().getMonth();
  } catch (_) {
    budgetYear  = new Date().getFullYear();
    budgetMonth = new Date().getMonth();
  }

  const labelEl = document.getElementById('budget-month-label');
  if (labelEl) labelEl.textContent = `${budgetYear}년 ${budgetMonth + 1}월`;

  const budget = getMonthBudget(state.budgets, budgetYear, budgetMonth);
  const actual = getMonthActual(state.ledgerData, budgetYear, budgetMonth);

  // 전월 실적 (트렌드 비교용)
  let prevM = budgetMonth - 1, prevY = budgetYear;
  if (prevM < 0) { prevM = 11; prevY--; }
  const prevActual = getMonthActual(state.ledgerData, prevY, prevM);

  const allCats = new Set([...Object.keys(budget), ...Object.keys(actual)]);
  const totalBudget = Object.values(budget).reduce((s, v) => s + v, 0);
  const totalActual = Object.values(actual).reduce((s, v) => s + v, 0);
  const totalPct = totalBudget > 0 ? Math.min(100, Math.round((totalActual / totalBudget) * 100)) : 0;

  // 날짜 기반 계산
  const now = today();
  const isCurrentMonth = (budgetYear === now.getFullYear() && budgetMonth === now.getMonth());
  const totalDays = new Date(budgetYear, budgetMonth + 1, 0).getDate();
  const elapsedDays = isCurrentMonth ? now.getDate() : totalDays;
  const remainingDays = totalDays - elapsedDays;
  const dailyAllowance = totalBudget > 0 && remainingDays > 0
    ? Math.max(0, Math.round((totalBudget - totalActual) / remainingDays)) : 0;
  const projected = elapsedDays > 0 ? Math.round(totalActual / elapsedDays * totalDays) : 0;

  // 원형 게이지 (116px)
  const gaugeR = 48, gaugeCX = 58, gaugeCY = 58;
  const circumference = 2 * Math.PI * gaugeR;
  const dashOffset = circumference * (1 - totalPct / 100);
  const gaugeColor = totalPct >= 100 ? '#ef4444' : totalPct >= 80 ? '#f97316' : '#10b981';
  const gaugeSvg = `
    <svg width="116" height="116" viewBox="0 0 116 116" style="flex-shrink:0">
      <circle cx="${gaugeCX}" cy="${gaugeCY}" r="${gaugeR}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="10"/>
      <circle cx="${gaugeCX}" cy="${gaugeCY}" r="${gaugeR}" fill="none" stroke="${gaugeColor}" stroke-width="10"
        stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${dashOffset.toFixed(1)}"
        stroke-linecap="round" transform="rotate(-90 ${gaugeCX} ${gaugeCY})" style="transition:stroke-dashoffset 1s ease"/>
      <text x="${gaugeCX}" y="${gaugeCY - 7}" fill="var(--text)" font-size="18" text-anchor="middle" font-family="monospace" font-weight="900">${totalPct}%</text>
      <text x="${gaugeCX}" y="${gaugeCY + 9}" fill="var(--text3)" font-size="8" text-anchor="middle">사용</text>
    </svg>`;

  // 카테고리 행 (전월 트렌드 + 초과 하이라이트)
  const catRows = [...allCats].map(cat => {
    const b = budget[cat] || 0;
    const a = actual[cat] || 0;
    const p = prevActual[cat] || 0;
    const pct = b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;
    const over = a > b && b > 0;
    const fillColor = over ? 'var(--red2)' : pct >= 80 ? 'var(--orange)' : 'var(--green2)';
    const col = LEDGER_CAT_COLORS[cat] || '#64748b';

    let trendHtml = '';
    if (p > 0 && a > 0) {
      const trendPct = Math.round(((a - p) / p) * 100);
      const trendUp = trendPct > 0;
      trendHtml = `<span style="font-size:9px;color:${trendUp ? 'var(--red2)' : 'var(--green2)'};font-weight:700;margin-left:4px">${trendUp ? '▲' : '▼'}${Math.abs(trendPct)}%</span>`;
    }

    return `
      <div class="budget-cat-row" id="budget-row-${escapeHtml(cat)}" data-cat="${escapeHtml(cat)}"
        style="${over ? 'background:rgba(239,68,68,0.06);border-radius:10px;margin:2px -4px;padding:6px 4px;' : ''}">
        <span class="lstat-cat-dot" style="background:${col}"></span>
        <span style="flex:1;font-size:12px;font-weight:600;color:var(--text)">${escapeHtml(cat)}</span>
        <div style="flex:1.5;min-width:80px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
            <span style="font-size:10px;font-family:var(--mono);color:${over ? 'var(--red2)' : 'var(--text2)'}">
              ${fmtShort(a)}${b > 0 ? `<span style="color:var(--text3)">/${fmtShort(b)}</span>` : ''}
            </span>
            ${trendHtml}
          </div>
          <div class="budget-progress">
            <div class="budget-progress-fill" style="width:${pct}%;background:${fillColor}"></div>
          </div>
        </div>
        <button class="icon-btn edit budget-cat-edit-btn" data-cat="${escapeHtml(cat)}" style="margin-left:6px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
        </button>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        ${gaugeSvg}
        <div style="flex:1">
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:1px;margin-bottom:4px">${budgetYear}년 ${budgetMonth + 1}월 예산</div>
          <div style="font-family:var(--mono);font-size:24px;font-weight:900;color:var(--text)">${fmtShort(totalActual)}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">예산 ${fmtShort(totalBudget)} 중</div>
          ${totalActual > totalBudget && totalBudget > 0 ? `<div class="budget-over" style="margin-top:4px;font-size:11px">⚠️ 예산 초과 ${fmtShort(totalActual - totalBudget)}</div>` : ''}
        </div>
      </div>
      ${totalBudget > 0 && isCurrentMonth ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
        ${remainingDays > 0 ? `
        <div style="background:rgba(99,102,241,0.1);border-radius:10px;padding:10px">
          <div style="font-size:9px;color:var(--text3);margin-bottom:2px">오늘부터 일 한도</div>
          <div style="font-size:17px;font-weight:900;color:#a78bfa;font-family:var(--mono)">${fmtShort(dailyAllowance)}</div>
          <div style="font-size:9px;color:var(--text3);margin-top:1px">남은 ${remainingDays}일</div>
        </div>` : ''}
        ${elapsedDays > 0 ? `
        <div style="background:${projected > totalBudget ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)'};border-radius:10px;padding:10px">
          <div style="font-size:9px;color:var(--text3);margin-bottom:2px">월말 예상 지출</div>
          <div style="font-size:17px;font-weight:900;color:${projected > totalBudget ? 'var(--red2)' : 'var(--green2)'};font-family:var(--mono)">${fmtShort(projected)}</div>
          <div style="font-size:9px;color:var(--text3);margin-top:1px">${projected > totalBudget ? `초과 ${fmtShort(projected - totalBudget)} 예상` : '예산 내 유지 중'}</div>
        </div>` : ''}
      </div>` : ''}
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">카테고리별 예산
        <button class="btn btn-ghost" id="btn-budget-suggest" style="font-size:11px;padding:4px 10px"><div class="ripple-container"></div>✨ 자동 추천</button>
      </div>
      ${allCats.size === 0 ? '<div class="empty-state" style="padding:20px 0">지출 내역 또는 예산이 없습니다</div>' : catRows}
    </div>

    ${(() => {
      let prevM2 = budgetMonth - 1, prevY2 = budgetYear;
      if (prevM2 < 0) { prevM2 = 11; prevY2--; }
      const prevBudget2 = getMonthBudget(state.budgets, prevY2, prevM2);
      const prevActual2 = getMonthActual(state.ledgerData, prevY2, prevM2);
      const carryItems = Object.entries(prevBudget2)
        .map(([cat, b]) => ({ cat, leftover: b - (prevActual2[cat] || 0) }))
        .filter(x => x.leftover > 0);
      const totalCarry = carryItems.reduce((s, x) => s + x.leftover, 0);
      if (!totalCarry) return '';
      const ym = `${budgetYear}-${p2(budgetMonth + 1)}`;
      const alreadyApplied = !!(state.budgetCarryover?.[ym]);
      return `<div class="card" style="margin-bottom:12px;background:rgba(99,102,241,0.06);border-color:rgba(99,102,241,0.2)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:0.5px">전월 미사용 예산 이월</div>
            <div style="font-size:18px;font-weight:900;color:var(--accent2);font-family:var(--mono);margin-top:2px">${fmtShort(totalCarry)}</div>
          </div>
          <button class="btn ${alreadyApplied ? 'btn-ghost' : ''}" id="btn-budget-carryover" style="font-size:11px;padding:6px 12px" ${alreadyApplied ? 'disabled' : ''}>
            <div class="ripple-container"></div>${alreadyApplied ? '✅ 이월 적용됨' : '↩ 이월 적용'}
          </button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          ${carryItems.slice(0, 6).map(x => `<span style="font-size:10px;padding:2px 8px;border-radius:6px;background:rgba(99,102,241,0.1);color:var(--accent2)">${escapeHtml(x.cat)} +${fmtShort(x.leftover)}</span>`).join('')}
        </div>
      </div>`;
    })()}
  `;
}

// ════════════════════════════════════════════════════════
// 위시리스트 탭
// ════════════════════════════════════════════════════════
const WISH_PRIORITY_LABELS = { must: '꼭 살 것', want: '사고 싶음', maybe: '고민 중' };
const WISH_PRIORITY_COLORS = { must: 'var(--red2)', want: 'var(--accent2)', maybe: 'var(--text3)' };
let _wishFilter = '전체';
let _wishSelectedIds = new Set();  // 다중선택 ID 집합

export function setWishFilter(filter) {
  _wishFilter = filter;
  _wishSelectedIds.clear();
  renderWishlist();
}

// 다중선택 분석 바 업데이트
function _updateWishSelectBar() {
  const bar = document.getElementById('wish-multiselect-bar');
  if (!bar) return;
  // 현재 체크된 체크박스들 동기화
  document.querySelectorAll('.wish-checkbox').forEach(cb => {
    if (cb.checked) _wishSelectedIds.add(cb.dataset.id);
    else _wishSelectedIds.delete(cb.dataset.id);
  });
  const count = _wishSelectedIds.size;
  const countEl = document.getElementById('wish-select-count');
  if (countEl) countEl.textContent = count > 0 ? `${count}개 선택됨` : '항목을 선택하세요';
  bar.style.display = count > 0 ? 'flex' : 'none';
}

export function getWishSelectedIds() { return _wishSelectedIds; }
export function clearWishSelection() { _wishSelectedIds.clear(); renderWishlist(); }

export function renderWishlist() {
  const wishlist = state.wishlist || [];
  const summaryBar = document.getElementById('wish-summary-bar');
  const summaryInner = document.getElementById('wish-summary-inner');
  const container = document.getElementById('wish-list');
  if (!container) return;

  // 요약
  const total = wishlist.filter(w => !w.bought).reduce((s, w) => s + Number(w.price || 0), 0);
  const mustTotal = wishlist.filter(w => w.priority === 'must' && !w.bought).reduce((s, w) => s + Number(w.price || 0), 0);
  const boughtCount = wishlist.filter(w => w.bought).length;

  if (wishlist.length && summaryBar && summaryInner) {
    summaryBar.style.display = '';
    summaryInner.innerHTML = `
      <div style="flex:1;min-width:100px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:0.5px">미구매 합계</div>
        <div style="font-size:18px;font-weight:900;color:var(--red2);font-family:var(--mono)">${fmtShort(total)}</div>
      </div>
      <div style="flex:1;min-width:100px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:0.5px">꼭 살 것</div>
        <div style="font-size:18px;font-weight:900;color:var(--orange);font-family:var(--mono)">${fmtShort(mustTotal)}</div>
      </div>
      <div style="flex:1;min-width:100px">
        <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:0.5px">구매 완료</div>
        <div style="font-size:18px;font-weight:900;color:var(--green2);font-family:var(--mono)">${boughtCount}개</div>
      </div>
    `;
  } else if (summaryBar) {
    summaryBar.style.display = 'none';
  }

  // 필터링
  let filtered = wishlist;
  if (_wishFilter === 'bought') {
    filtered = wishlist.filter(w => w.bought);
  } else if (_wishFilter !== '전체') {
    filtered = wishlist.filter(w => !w.bought && w.priority === _wishFilter);
  } else {
    filtered = wishlist.filter(w => !w.bought);
  }

  if (!filtered.length) {
    const isEmpty = !wishlist.length;
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">${_wishFilter === 'bought' ? '✅' : '🛍️'}</div>
      <div class="empty-state-title">${_wishFilter === 'bought' ? '구매 완료 항목 없음' : '위시리스트 비어있음'}</div>
      <div class="empty-state-desc">${isEmpty ? '사고 싶은 물건을 추가하면<br>구매 가능일과 잔고 영향을 계산해드려요' : '해당 필터에 해당하는 항목이 없습니다'}</div>
      ${isEmpty ? '<div class="empty-state-hint">+ 추가 버튼으로 시작하세요</div>' : ''}
    </div>`;
    return;
  }

  container.innerHTML = filtered.map((w, idx) => {
    const sim = !w.bought ? simulateWishPurchase(w) : null;
    const priceStr = w.price ? fmtShort(Number(w.price)) : '가격 미입력';
    const priColor = w.bought ? 'var(--green2)' : (WISH_PRIORITY_COLORS[w.priority] || 'var(--text3)');
    const priLabel = w.bought ? '구매 완료' : (WISH_PRIORITY_LABELS[w.priority] || w.priority);
    const dateStr = w.targetDate ? `목표: ${w.targetDate}` : '';

    let impactHtml = '';
    if (sim) {
      const safeStr = sim.safeDate ? `구매 가능일: ${sim.safeDate}` : '';
      const canStr = sim.canAfford ? '✅ 지금 구매 가능' : '⏳ 잔고 부족';
      impactHtml = `
        <div class="wish-impact-row">
          <span class="wish-impact-badge ${sim.canAfford ? 'ok' : 'warn'}">${canStr}</span>
          <span class="wish-impact-text">${sim.impactSummary}</span>
          ${safeStr ? `<span class="wish-impact-date">${safeStr}</span>` : ''}
        </div>`;
    }

    const priBorderColor = w.bought ? 'var(--green2)' :
      (w.priority === 'must' ? 'var(--red2)' : w.priority === 'want' ? 'var(--accent2)' : 'var(--text3)');

    return `
      <div class="wish-card stagger-item ${w.bought ? 'bought' : ''}" data-id="${escapeHtml(w.id)}" data-idx="${idx}" draggable="true"
           style="border-left:3px solid ${priBorderColor};--stagger-idx:${idx}">
        <div class="wish-card-top">
          <!-- 드래그 핸들 -->
          <div class="wish-drag-handle" data-id="${escapeHtml(w.id)}" title="드래그하여 순서 변경">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" opacity="0.4"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>
          </div>
          <!-- 다중선택 체크박스 -->
          ${!w.bought ? `<label class="wish-select-wrap" onclick="event.stopPropagation()">
            <input type="checkbox" class="wish-checkbox" data-id="${escapeHtml(w.id)}" ${_wishSelectedIds.has(w.id) ? 'checked' : ''}>
          </label>` : ''}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
              <span class="wish-priority-badge" style="background:${priColor}20;color:${priColor};border-color:${priColor}40">${priLabel}</span>
              ${w.category ? `<span style="font-size:10px;color:var(--text3)">${escapeHtml(w.category)}</span>` : ''}
              ${dateStr ? `<span style="font-size:10px;color:var(--text3)">${dateStr}</span>` : ''}
            </div>
            <div class="wish-name">${escapeHtml(w.name)}</div>
            <div class="wish-price">${priceStr}</div>
            ${w.notes ? `<div style="font-size:11px;color:var(--text3);margin-top:3px">${escapeHtml(w.notes)}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0">
            ${w.url ? `<button class="wish-link-btn" data-url="${escapeHtml(w.url)}" title="링크 열기">🔗 링크</button>` : ''}
            <div style="display:flex;gap:4px">
              ${!w.bought ? `<button class="icon-btn wish-buy-btn" data-id="${escapeHtml(w.id)}" title="구매 완료 처리" style="color:var(--green2)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </button>` : `<button class="icon-btn wish-unbuy-btn" data-id="${escapeHtml(w.id)}" title="미구매로 되돌리기" style="color:var(--text3)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 109 9"/><polyline points="3 3 3 12 12 12"/></svg>
              </button>`}
              ${!w.bought ? `<button class="icon-btn wish-to-goal-btn" data-id="${escapeHtml(w.id)}" title="목표로 전환" style="color:var(--accent2)">🎯</button>` : ''}
              <button class="icon-btn edit wish-edit-btn" data-id="${escapeHtml(w.id)}" title="수정">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
              </button>
              <button class="icon-btn delete wish-del-btn" data-id="${escapeHtml(w.id)}" title="삭제">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              </button>
            </div>
          </div>
        </div>
        ${impactHtml}
      </div>`;
  }).join('');

  // 다중선택 바 업데이트
  _updateWishSelectBar();
}

// ════════════════════════════════════════════════════════
// 재테크 탭
// ════════════════════════════════════════════════════════
let _financeData = {}; // { symbol: { price, change, changePct, name, currency, lastUpdated } }
let _financeLoading = {};

export function setFinanceData(symbol, data) {
  _financeData[symbol] = data;
}

// ── 숫자 포맷 헬퍼 ──────────────────────────────────────
function _fmtPrice(price, currency) {
  if (currency === 'KRW') return price >= 1000 ? price.toLocaleString('ko-KR') : price.toFixed(0);
  if (currency === 'USD') return price < 10 ? price.toFixed(4) : price < 1000 ? price.toFixed(2) : price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toFixed(2);
}
function _currSym(currency) { return { KRW: '₩', USD: '$', EUR: '€', GBP: '£' }[currency] || ''; }
function _numFmt(n) { return Math.abs(n) >= 1e8 ? (n/1e8).toFixed(1)+'억' : Math.abs(n) >= 1e4 ? (n/1e4).toFixed(0)+'만' : n.toLocaleString('ko-KR'); }

export function renderFinance() {
  const watchlist = state.watchlist || [];
  const container = document.getElementById('watchlist-container');
  if (!container) return;

  // ── 포트폴리오 요약 카드 갱신 ──────────────────────────
  _updateFinancePortfolioCard(watchlist);

  // ── API 키 없음 배너 ──────────────────────────────────
  const apiBanner = document.getElementById('fin-api-banner');
  if (apiBanner) {
    apiBanner.style.display = state.alphaVantageKey ? 'none' : '';
  }

  if (!watchlist.length) {
    container.innerHTML = `
      <div class="fin-empty">
        <div class="fin-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
        </div>
        <div class="fin-empty-title">관심종목이 없어요</div>
        <div class="fin-empty-desc">주식·ETF·암호화폐를 추가하면<br>실시간 시세와 수익률을 한눈에 확인할 수 있어요</div>
        <button class="fin-empty-btn" id="btn-add-watchlist-empty">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          첫 종목 추가하기
        </button>
        <div class="fin-empty-tips">
          <span>🇰🇷 005930 · 삼성전자</span>
          <span>🇺🇸 AAPL · 애플</span>
          <span>₿ BTC-USD</span>
        </div>
      </div>`;
    document.getElementById('btn-add-watchlist-empty')?.addEventListener('click', () => {
      document.getElementById('btn-add-watchlist')?.click();
    });
    return;
  }

  // ── 그룹화: 보유 종목 vs 관심 종목 ──────────────────────
  const holdings = watchlist.filter(w => w.buyPrice && w.quantity);
  const watchOnly = watchlist.filter(w => !w.buyPrice || !w.quantity);

  const renderCard = (item) => {
    const data = _financeData[item.symbol];
    const isLoading = _financeLoading[item.symbol];
    const name = (data?.name) || item.name || item.symbol;
    const mkt = item.market || 'OTHER';
    const mktBadge = { KRX: '<span class="fin-mkt-badge krx">KRX</span>', US: '<span class="fin-mkt-badge us">US</span>', CRYPTO: '<span class="fin-mkt-badge crypto">CRYPTO</span>', OTHER: '<span class="fin-mkt-badge other">기타</span>' }[mkt] || '';

    let priceHtml = '';
    if (isLoading) {
      priceHtml = `<div class="fin-price-skeleton">
        <div class="skeleton" style="width:80px;height:20px;border-radius:6px;margin-bottom:5px"></div>
        <div class="skeleton" style="width:55px;height:13px;border-radius:5px"></div>
      </div>`;
    } else if (data && data.price != null) {
      const curr = data.currency || 'USD';
      const cs = _currSym(curr);
      const ps = _fmtPrice(data.price, curr);
      const chg = data.change || 0;
      const chgPct = data.changePct || 0;
      const isUp = chg > 0, isDown = chg < 0;
      const chgCls = isUp ? 'up' : isDown ? 'down' : 'flat';
      const chgSign = isUp ? '+' : '';

      // 수익률
      let pnlHtml = '';
      if (item.buyPrice && item.quantity) {
        const invested = Number(item.buyPrice) * Number(item.quantity);
        const current = data.price * Number(item.quantity);
        const pnl = current - invested;
        const pnlPct = invested > 0 ? (pnl / invested * 100) : 0;
        const pnlCls = pnl >= 0 ? 'up' : 'down';
        const pnlSign = pnl >= 0 ? '+' : '';
        pnlHtml = `<div class="fin-card-pnl ${pnlCls}">
          <span class="fin-pnl-amt">${pnlSign}${cs}${_fmtPrice(Math.abs(pnl), curr)}</span>
          <span class="fin-pnl-pct">${pnlSign}${pnlPct.toFixed(2)}%</span>
        </div>`;
      }

      priceHtml = `
        <div class="fin-card-price-wrap">
          <div class="fin-card-price">${cs}${ps}</div>
          <div class="fin-card-chg ${chgCls}">${chgSign}${chg.toFixed(curr === 'KRW' ? 0 : 2)} <span class="fin-chg-pct">${chgSign}${chgPct.toFixed(2)}%</span></div>
          ${pnlHtml}
        </div>`;
    } else if (data === null) {
      priceHtml = `<button class="fin-load-btn fin-load-trigger" data-symbol="${escapeHtml(item.symbol)}" style="font-size:10px;padding:5px 8px">↻ 재시도</button>`;
    } else {
      priceHtml = `<button class="fin-load-btn fin-load-trigger" data-symbol="${escapeHtml(item.symbol)}">시세 불러오기</button>`;
    }

    const holdInfo = (item.buyPrice && item.quantity) ? `
      <div class="fin-card-hold">
        <span>매수가 <b>${Number(item.buyPrice).toLocaleString('ko-KR')}</b></span>
        <span class="fin-hold-sep">·</span>
        <span><b>${item.quantity}</b>주</span>
      </div>` : '';

    return `
      <div class="fin-card" data-symbol="${escapeHtml(item.symbol)}">
        <div class="fin-card-left">
          <div class="fin-card-header">
            <span class="fin-card-name">${escapeHtml(name)}</span>
            ${mktBadge}
          </div>
          <div class="fin-card-ticker">${escapeHtml(item.symbol)}</div>
          ${holdInfo}
          ${item.note ? `<div class="fin-card-note">${escapeHtml(item.note)}</div>` : ''}
        </div>
        <div class="fin-card-right">
          ${priceHtml}
          <div class="fin-card-actions">
            <button class="fin-action-btn watchlist-edit-btn" data-symbol="${escapeHtml(item.symbol)}" title="수정">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button class="fin-action-btn delete watchlist-del-btn" data-symbol="${escapeHtml(item.symbol)}" title="삭제">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  };

  let html = '';
  if (holdings.length) {
    html += `<div class="fin-section-hdr">보유 종목 <span class="fin-section-count">${holdings.length}</span></div>`;
    html += `<div class="fin-cards-list">${holdings.map(renderCard).join('')}</div>`;
  }
  if (watchOnly.length) {
    html += `<div class="fin-section-hdr" style="margin-top:${holdings.length ? '16px' : '0'}">관심 종목 <span class="fin-section-count">${watchOnly.length}</span></div>`;
    html += `<div class="fin-cards-list">${watchOnly.map(renderCard).join('')}</div>`;
  }
  container.innerHTML = html;

  // 시세 불러오기 버튼 이벤트
  container.querySelectorAll('.fin-load-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sym = btn.dataset.symbol;
      const item = (state.watchlist || []).find(w => w.symbol === sym);
      if (item) fetchStockPrice(item).then(() => renderFinance());
    });
  });
}

function _updateFinancePortfolioCard(watchlist) {
  const card = document.getElementById('fin-portfolio-card');
  if (!card) return;

  if (!watchlist.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  let totalInvested = 0, totalCurrent = 0, holdCount = 0;
  let dayPnl = 0;
  for (const item of watchlist) {
    const data = _financeData[item.symbol];
    if (!data?.price) continue;
    if (item.buyPrice && item.quantity) {
      const qty = Number(item.quantity);
      totalInvested += Number(item.buyPrice) * qty;
      totalCurrent += data.price * qty;
      holdCount++;
    }
    if (data.change && item.quantity) {
      dayPnl += data.change * Number(item.quantity || 0);
    }
  }

  const pnl = totalCurrent - totalInvested;
  const pnlPct = totalInvested > 0 ? (pnl / totalInvested * 100) : 0;
  const pnlUp = pnl >= 0;
  const dayUp = dayPnl >= 0;

  const el = document.getElementById('fin-portfolio-inner');
  if (!el) return;

  if (holdCount === 0) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:4px 0">매수가·수량 입력 시 수익률이 표시돼요</div>`;
    return;
  }

  el.innerHTML = `
    <div class="fin-port-stat">
      <div class="fin-port-lbl">총 평가액</div>
      <div class="fin-port-val">${_numFmt(totalCurrent)}<span class="fin-port-unit">원</span></div>
    </div>
    <div class="fin-port-div"></div>
    <div class="fin-port-stat">
      <div class="fin-port-lbl">평가손익</div>
      <div class="fin-port-val ${pnlUp ? 'up' : 'down'}">${pnlUp ? '+' : ''}${_numFmt(pnl)}<span class="fin-port-unit">원</span></div>
      <div class="fin-port-sub ${pnlUp ? 'up' : 'down'}">${pnlUp ? '+' : ''}${pnlPct.toFixed(2)}%</div>
    </div>
    <div class="fin-port-div"></div>
    <div class="fin-port-stat">
      <div class="fin-port-lbl">오늘 변동</div>
      <div class="fin-port-val ${dayUp ? 'up' : 'down'}" style="font-size:18px">${dayUp ? '+' : ''}${_numFmt(dayPnl)}<span class="fin-port-unit">원</span></div>
    </div>`;
}

function updateFinanceSummary() { /* deprecated */ }

/**
 * 종목 시세 로드
 *  1. 암호화폐 → CoinGecko (CORS-OK, 무료, 신뢰)
 *  2. 주식/ETF → Yahoo Finance v8 (query1 + query2) × 3 CORS 프록시
 *     KRX: .KS 실패 시 .KQ 추가 재시도
 */
export async function fetchStockPrice(item) {
  const { symbol, market } = item;
  _financeLoading[symbol] = true;

  const setData = (price, change, changePct, currency, name) => {
    _financeData[symbol] = { price, change, changePct, currency,
      name: name || item.name || symbol,
      lastUpdated: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) };
  };

  try {
    // ── 1. 암호화폐: CoinGecko ──────────────────────────────
    if (market === 'CRYPTO') {
      const coinMap = {
        'BTC':'bitcoin','ETH':'ethereum','SOL':'solana','XRP':'ripple',
        'ADA':'cardano','DOGE':'dogecoin','DOT':'polkadot','AVAX':'avalanche-2',
        'MATIC':'matic-network','LINK':'chainlink','UNI':'uniswap','ATOM':'cosmos',
        'LTC':'litecoin','BCH':'bitcoin-cash','NEAR':'near','ALGO':'algorand',
        'TRX':'tron','ETC':'ethereum-classic','XLM':'stellar','VET':'vechain',
        'FIL':'filecoin','ICP':'internet-computer','HBAR':'hedera-hashgraph',
        'APT':'aptos','ARB':'arbitrum','OP':'optimism','SUI':'sui',
        'TON':'the-open-network','SHIB':'shiba-inu','PEPE':'pepe',
      };
      const base = symbol.replace(/-USD$|-KRW$/i, '').toUpperCase();
      const coinId = coinMap[base] || base.toLowerCase();
      try {
        const r = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd,krw&include_24hr_change=true`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (r.ok) {
          const json = await r.json();
          const d = json[coinId];
          if (d) {
            const inKRW = symbol.toUpperCase().endsWith('-KRW');
            const price = inKRW ? (d.krw || 0) : (d.usd || 0);
            const pct   = inKRW ? (d.krw_24h_change || 0) : (d.usd_24h_change || 0);
            const prev  = price / (1 + pct / 100);
            setData(price, price - prev, pct, inKRW ? 'KRW' : 'USD', item.name || base);
            return;
          }
        }
      } catch {}
    }

    // ── 2. 주식/ETF: Alpha Vantage (API 키 있을 때 우선) ────────
    const avKey = state.alphaVantageKey;
    if (avKey) {
      const avSymbol = market === 'KRX'
        ? symbol.replace(/\..+$/, '') + '.KSC'
        : symbol;
      try {
        const r = await fetch(
          `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(avSymbol)}&apikey=${encodeURIComponent(avKey)}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (r.ok) {
          const json = await r.json();
          const q = json['Global Quote'];
          const p = parseFloat(q?.['05. price']);
          const prev = parseFloat(q?.['08. previous close']);
          if (p > 0) {
            const chg = p - prev;
            const chgPct = prev > 0 ? (chg / prev * 100) : 0;
            const currency = market === 'KRX' ? 'KRW' : 'USD';
            setData(p, chg, chgPct, currency, item.name || q?.['01. symbol'] || symbol);
            return;
          }
        }
      } catch {}
    }

    // ── 2.5 한국 주식: Naver Finance 모바일 API (KRX 우선) ─────
    if (market === 'KRX') {
      const code = symbol.replace(/\..+$/, '');
      const naverBase = `https://m.stock.naver.com/api/stock/${code}/basic`;
      const naverUrls = [
        `https://corsproxy.io/?${encodeURIComponent(naverBase)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(naverBase)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(naverBase)}`,
        naverBase,
      ];
      const naverAttempts = naverUrls.map(url =>
        fetch(url, { signal: AbortSignal.timeout(7000) })
          .then(async r => {
            if (!r.ok) throw new Error('not ok');
            const data = await r.json();
            const p = parseFloat((data.closePrice || '').toString().replace(/,/g, ''));
            if (!p || p <= 0) throw new Error('no price');
            const chgAbs = parseFloat((data.compareToPreviousClosePrice || '0').toString().replace(/,/g, ''));
            const chgPct = parseFloat((data.fluctuationsRatio || '0').toString());
            const sign = data.fluctuationCode === '5' ? -1 : 1;
            return { p, chg: sign * Math.abs(chgAbs), pct: sign * Math.abs(chgPct),
                     name: data.stockName || item.name || symbol };
          })
      );
      try {
        const parsed = await Promise.any(naverAttempts);
        if (parsed) {
          setData(parsed.p, parsed.chg, parsed.pct, 'KRW', parsed.name);
          return;
        }
      } catch {}
    }

    // ── 3. 주식/ETF: Yahoo Finance v8 × 프록시 병렬 경쟁 ──────
    // 프록시 3종 + yahoo 도메인 2종을 동시에 시도하여 가장 먼저 오는 결과 사용
    const PROXIES = [
      { fn: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`, raw: true },
      { fn: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, raw: true },
      { fn: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, raw: false },
      { fn: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, raw: true },
    ];

    const parseYahooResponse = async (res, isRaw) => {
      if (!res.ok) throw new Error('not ok');
      let json;
      if (isRaw) {
        json = await res.json();
      } else {
        const w = await res.json();
        json = JSON.parse(w.contents);
      }
      const meta = json?.chart?.result?.[0]?.meta;
      if (!meta) throw new Error('no meta');
      const p = meta.regularMarketPrice || meta.previousClose;
      const prev = meta.previousClose || meta.chartPreviousClose || p;
      if (!p || p <= 0) throw new Error('no price');
      return { p, change: p - prev, changePct: prev ? (p - prev) / prev * 100 : 0,
               currency: meta.currency || 'USD', name: item.name || meta.shortName || symbol };
    };

    const tryTickerConcurrent = async (ticker) => {
      const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
      const attempts = [];
      for (const host of YAHOO_HOSTS) {
        const yahooUrl = `${host}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
        for (const proxy of PROXIES) {
          attempts.push(
            fetch(proxy.fn(yahooUrl), { signal: AbortSignal.timeout(8000) })
              .then(res => parseYahooResponse(res, proxy.raw))
          );
        }
      }
      return Promise.any(attempts);
    };

    const tickers = [symbol];
    if (market === 'KRX') {
      const code = symbol.replace(/\..+$/, '');
      tickers.unshift(`${code}.KS`, `${code}.KQ`);
    }

    for (const ticker of tickers) {
      try {
        const parsed = await tryTickerConcurrent(ticker);
        if (parsed) {
          setData(parsed.p, parsed.change, parsed.changePct, parsed.currency, parsed.name);
          return;
        }
      } catch { /* 다음 ticker 시도 */ }
    }

    _financeData[symbol] = null;
  } catch {
    _financeData[symbol] = null;
  } finally {
    _financeLoading[symbol] = false;
  }
}

let _lastRefreshTime = 0;

export async function refreshAllStocks(force = false) {
  const watchlist = state.watchlist || [];
  if (!watchlist.length) return;

  const now = Date.now();
  if (!force && now - _lastRefreshTime < 30000) return;
  _lastRefreshTime = now;

  const refreshBtn = document.getElementById('btn-finance-refresh');
  const infoEl = document.getElementById('finance-refresh-info');
  if (refreshBtn) refreshBtn.classList.add('spinning');
  if (infoEl) infoEl.textContent = '시세 불러오는 중...';

  await Promise.allSettled(watchlist.map(item => fetchStockPrice(item)));
  renderFinance();

  if (refreshBtn) refreshBtn.classList.remove('spinning');
  if (infoEl) infoEl.textContent = `${new Date().toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'})} 기준`;
}

// ════════════════════════════════════════════════════════
// 가계 공유 섹션
// ════════════════════════════════════════════════════════
export async function renderHouseholdSection() {
  const el = document.getElementById('household-section');
  if (!el) return;
  const { getCurrentHouseholdCode, getHouseholdMeta } = await import('./firebase');
  const code = getCurrentHouseholdCode();
  if (!code) {
    el.innerHTML = `
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.7">
        커플이나 가족과 같은 가계부를 공유하세요.<br>한 명이 코드를 생성하면 다른 사람이 참여할 수 있어요.
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn" id="btn-create-household" style="padding:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-radius:12px;font-size:13px;font-family:var(--font);display:flex;align-items:center;gap:8px;justify-content:center"><div class="ripple-container"></div>🏠 공유 코드 생성하기</button>
        <div style="display:flex;gap:8px">
          <input class="form-input" id="household-join-code" placeholder="코드 입력 (6자리)" maxlength="6" style="flex:1;text-transform:uppercase;font-family:var(--mono);font-size:14px;text-align:center;letter-spacing:3px">
          <button class="btn btn-ghost" id="btn-join-household" style="padding:12px 16px;font-size:13px;white-space:nowrap">참여</button>
        </div>
      </div>`;
    return;
  }
  const meta = await getHouseholdMeta() || {};
  const isOwner = meta.ownerId === window.currentUser?.uid;
  const memberStr = (meta.memberNames || []).join(' · ') || '-';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);border-radius:12px;margin-bottom:12px">
      <span style="font-size:20px">🏠</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:#a5b4fc">공유 모드 활성 ${isOwner ? '(방장)' : '(멤버)'}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">코드: <span style="font-family:var(--mono);font-weight:700;color:var(--text);letter-spacing:2px">${code}</span></div>
      </div>
      <button id="btn-copy-household-code" style="margin-left:auto;padding:4px 10px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.3);border-radius:8px;color:#a5b4fc;font-size:11px;cursor:pointer">복사</button>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:12px">멤버: ${escapeHtml(memberStr)}</div>
    <button class="btn" id="btn-leave-household" style="padding:10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:var(--red2);border-radius:12px;font-size:13px;font-family:var(--font);width:100%;display:flex;align-items:center;gap:8px;justify-content:center">${isOwner ? '🚪 공유 모드 종료' : '🚪 가계에서 나가기'}</button>`;
}

// ════════════════════════════════════════════════════════
// 홈 예산 진행 바 위젯
// ════════════════════════════════════════════════════════
export function renderHomeBudgetBars() {
  const el = document.getElementById('home-budget-widget');
  if (!el) return;

  const now = today();
  const budget = getMonthBudget(state.budgets || {}, now.getFullYear(), now.getMonth());
  const actual = getMonthActual(state.ledgerData, now.getFullYear(), now.getMonth());

  const cats = Object.keys(budget).filter(c => budget[c] > 0);
  if (!cats.length) {
    el.innerHTML = `
      <div class="card" style="padding:16px;text-align:center;cursor:pointer" id="home-budget-widget-card">
        <div style="font-size:28px;margin-bottom:8px">💰</div>
        <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px">예산이 설정되지 않았어요</div>
        <div style="font-size:11px;color:var(--text3);line-height:1.5">예산을 설정하면 카테고리별<br>지출 현황을 한눈에 볼 수 있어요</div>
        <div style="margin-top:10px;font-size:11px;color:var(--accent2);font-weight:700">예산 설정하러 가기 →</div>
      </div>`;
    document.getElementById('home-budget-widget-card')?.addEventListener('click', () => {
      document.querySelector('.nav-btn[data-page="ledger"]')?.click();
      setTimeout(() => document.querySelector('.ledger-sub-tab[data-tab="budget"]')?.click(), 200);
    });
    return;
  }

  const totalBgt = cats.reduce((s, c) => s + budget[c], 0);
  const totalAct = cats.reduce((s, c) => s + (actual[c] || 0), 0);
  const totalPct = totalBgt > 0 ? Math.min(150, Math.round((totalAct / totalBgt) * 100)) : 0;
  const totalColor = totalPct >= 100 ? 'var(--red2)' : totalPct >= 80 ? 'var(--orange)' : 'var(--green2)';

  const topCats = [...cats].sort((a, b) => (budget[b] || 0) - (budget[a] || 0)).slice(0, 4);

  const rows = topCats.map(cat => {
    const bgt = budget[cat] || 0;
    const act = actual[cat] || 0;
    const pct = bgt > 0 ? Math.min(100, Math.round((act / bgt) * 100)) : 0;
    const color = pct >= 100 ? 'var(--red2)' : pct >= 80 ? 'var(--orange)' : 'var(--accent2)';
    return `
      <div style="margin-bottom:9px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
          <span style="font-size:11px;color:var(--text2);font-weight:600">${escapeHtml(cat)}</span>
          <span style="font-size:10px;font-family:var(--mono);font-weight:700;color:${color}">${fmtShort(act)}<span style="color:var(--text3);font-weight:400"> / ${fmtShort(bgt)}</span></span>
        </div>
        <div style="height:5px;background:var(--bg4);border-radius:6px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:6px;transition:width 0.5s ease"></div>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="card" style="padding:14px 16px;cursor:pointer" id="home-budget-widget-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:12px;font-weight:800;color:var(--text)">💰 이달 예산</div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="height:5px;width:52px;background:var(--bg4);border-radius:6px;overflow:hidden">
            <div style="height:100%;width:${Math.min(100, totalPct)}%;background:${totalColor};border-radius:6px"></div>
          </div>
          <span style="font-size:11px;font-weight:700;color:${totalColor}">${totalPct}%</span>
        </div>
      </div>
      ${rows}
    </div>`;

  document.getElementById('home-budget-widget-card')?.addEventListener('click', () => {
    document.querySelector('.nav-btn[data-page="ledger"]')?.click();
    setTimeout(() => document.querySelector('.ledger-sub-tab[data-tab="budget"]')?.click(), 200);
  });
}

// ════════════════════════════════════════════════════════
// 홈 예측 미니 위젯
// ════════════════════════════════════════════════════════
export function renderHomeForecastWidget() {
  const el = document.getElementById('home-forecast-widget');
  if (!el) return;

  const now = today();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate();

  if (daysLeft <= 0) { el.innerHTML = ''; return; }

  const fc = buildForecast(daysLeft + 1);
  const endBalance = fc.length ? fc[fc.length - 1].balance : state.balance;
  const projExpense = fc.reduce((s, f) => s + f.expense, 0);
  const expenseEvents = fc.filter(f => f.expense > 0);
  const nextBig = expenseEvents.length
    ? expenseEvents.reduce((a, b) => b.expense > a.expense ? b : a)
    : null;

  const isDanger = endBalance < state.dangerLine;
  const isWarn   = endBalance < state.dangerLine * 2 && !isDanger;
  const statusColor = isDanger ? 'var(--red2)' : isWarn ? 'var(--yellow)' : 'var(--green2)';
  const statusIcon  = isDanger ? '🚨' : isWarn ? '⚠️' : '✅';
  const statusLabel = isDanger ? '위험' : isWarn ? '주의' : '안전';

  el.innerHTML = `
    <div class="card home-forecast-card" id="home-forecast-card" style="cursor:pointer;padding:14px 16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:14px">📈</span>
        <div style="font-size:12px;font-weight:800;color:var(--text)">이번 달 잔고 예측</div>
        <span class="forecast-status-badge" style="color:${statusColor};background:${statusColor}22;border:1px solid ${statusColor}44">${statusIcon} ${statusLabel}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div class="forecast-mini-cell">
          <div class="forecast-mini-label">월말 예상잔고</div>
          <div class="forecast-mini-val" style="color:${statusColor}">${fmtShort(endBalance)}</div>
          <div class="forecast-mini-sub">${daysLeft}일 후</div>
        </div>
        <div class="forecast-mini-cell">
          <div class="forecast-mini-label">예정 지출</div>
          <div class="forecast-mini-val" style="color:var(--red2)">${fmtShort(projExpense)}</div>
          <div class="forecast-mini-sub">${expenseEvents.length}건</div>
        </div>
        <div class="forecast-mini-cell">
          <div class="forecast-mini-label">다음 큰 지출</div>
          <div class="forecast-mini-val" style="color:var(--orange);font-size:13px">${nextBig ? fmtShort(nextBig.expense) : '—'}</div>
          <div class="forecast-mini-sub">${nextBig ? `${nextBig.date.getMonth() + 1}/${p2(nextBig.date.getDate())}` : '없음'}</div>
        </div>
      </div>
    </div>`;

  document.getElementById('home-forecast-card')?.addEventListener('click', () => {
    if (typeof window._nav === 'function') window._nav('forecast');
  });
}

// ════════════════════════════════════════════════════════
// 월간 리포트 카드 Canvas 이미지 저장
// ════════════════════════════════════════════════════════
export function saveReportCard() {
  const canvas = document.getElementById('report-card-canvas');
  if (!canvas) return;

  const W = 640, H = 1040;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  const now = today();
  const cf  = _calcMonthCF(now);
  const budget = getMonthBudget(state.budgets || {}, now.getFullYear(), now.getMonth());
  const actual = getMonthActual(state.ledgerData, now.getFullYear(), now.getMonth());

  const catEntries = Object.entries(cf.catTotals || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 4);
  const savingsRate = cf.income > 0
    ? Math.round(((cf.income - cf.expense) / cf.income) * 100) : 0;

  // ── 배경 그라디언트 ──────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f172a');
  bg.addColorStop(0.45, '#1e1b4b');
  bg.addColorStop(1, '#0f172a');
  _roundRect(ctx, 0, 0, W, H, 0);
  ctx.fillStyle = bg;
  ctx.fill();

  // ── 상단 노이즈/광택 효과 ────────────────────────────
  const shine = ctx.createLinearGradient(0, 0, W, 0);
  shine.addColorStop(0, 'rgba(99,102,241,0.08)');
  shine.addColorStop(0.5, 'rgba(139,92,246,0.14)');
  shine.addColorStop(1, 'rgba(99,102,241,0.05)');
  _roundRect(ctx, 0, 0, W, H, 0);
  ctx.fillStyle = shine;
  ctx.fill();

  // ── 헤더 로고 영역 ────────────────────────────────────
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = 'rgba(165,180,252,0.8)';
  ctx.fillText('CASH FLOW', 40, 58);

  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${now.getFullYear()}년 ${now.getMonth() + 1}월`, 40, 96);

  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(148,163,184,0.9)';
  ctx.fillText('Monthly Financial Report', 40, 118);

  // ── 구분선 ──────────────────────────────────────────
  ctx.strokeStyle = 'rgba(99,102,241,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(40, 136); ctx.lineTo(W - 40, 136); ctx.stroke();

  // ── 수입 / 지출 / 순현금 ────────────────────────────
  const cols3 = [
    { label: '수입', val: cf.income, color: '#34d399' },
    { label: '지출', val: cf.expense, color: '#f87171' },
    { label: '순현금', val: cf.net, color: cf.net >= 0 ? '#34d399' : '#f87171' },
  ];
  const col3W = (W - 80) / 3;
  cols3.forEach((c, i) => {
    const x = 40 + i * col3W;
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.fillText(c.label, x, 172);
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = c.color;
    const valStr = (c.val >= 0 ? '' : '-') + _fmtCanvas(Math.abs(c.val));
    ctx.fillText(valStr, x, 202);
  });

  // ── 저축률 바 ─────────────────────────────────────────
  const srY = 228;
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(148,163,184,0.8)';
  ctx.fillText('저축률', 40, srY);
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = savingsRate >= 20 ? '#34d399' : savingsRate >= 0 ? '#fbbf24' : '#f87171';
  ctx.fillText(`${savingsRate}%`, W - 80, srY);
  const barW = W - 80;
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  _roundRect(ctx, 40, srY + 8, barW, 8, 4);
  ctx.fill();
  const fillW = Math.max(0, Math.min(barW, barW * savingsRate / 100));
  const srGrad = ctx.createLinearGradient(40, 0, 40 + fillW, 0);
  srGrad.addColorStop(0, '#6366f1');
  srGrad.addColorStop(1, '#34d399');
  ctx.fillStyle = srGrad;
  _roundRect(ctx, 40, srY + 8, fillW, 8, 4);
  ctx.fill();

  // ── 구분선 ─────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(99,102,241,0.2)';
  ctx.beginPath(); ctx.moveTo(40, 264); ctx.lineTo(W - 40, 264); ctx.stroke();

  // ── 카테고리 TOP ────────────────────────────────────────
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = 'rgba(165,180,252,0.9)';
  ctx.fillText('지출 카테고리', 40, 290);

  const maxCatAmt = catEntries[0]?.[1] || 1;
  catEntries.forEach(([cat, amt], i) => {
    const y = 314 + i * 56;
    const pct = amt / (cf.expense || 1);
    const barFillW = (W - 160) * (amt / maxCatAmt) * 0.9;

    // 카테고리 배경
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    _roundRect(ctx, 36, y - 2, W - 72, 44, 8);
    ctx.fill();

    // 이름
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(cat.length > 6 ? cat.slice(0, 6) : cat, 52, y + 15);

    // 금액
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#f87171';
    ctx.fillText(_fmtCanvas(amt), W - 155, y + 15);

    // 퍼센트
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.fillText(`${Math.round(pct * 100)}%`, W - 60, y + 15);

    // 진행 바
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    _roundRect(ctx, 52, y + 24, W - 104, 5, 2);
    ctx.fill();
    const catColors = ['#6366f1', '#f87171', '#fbbf24', '#34d399'];
    const cg = ctx.createLinearGradient(52, 0, 52 + barFillW, 0);
    cg.addColorStop(0, catColors[i % catColors.length]);
    cg.addColorStop(1, catColors[(i + 1) % catColors.length]);
    ctx.fillStyle = cg;
    _roundRect(ctx, 52, y + 24, barFillW, 5, 2);
    ctx.fill();
  });

  const afterCats = 314 + catEntries.length * 56 + 16;

  // ── 구분선 ─────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(99,102,241,0.2)';
  ctx.beginPath(); ctx.moveTo(40, afterCats); ctx.lineTo(W - 40, afterCats); ctx.stroke();

  // ── 소비 성향 & 재정 건강 ────────────────────────────────
  const hs = _calcHealthScore(cf);

  // 성향
  const tagTotals = {};
  for (let mi = 0; mi < 1; mi++) {
    const d = new Date(now.getFullYear(), now.getMonth() - mi, 1);
    const pf = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
    for (const [dk, items] of Object.entries(state.ledgerData || {})) {
      if (!dk.startsWith(pf)) continue;
      for (const it of items) {
        if (it.type === 'expense' && it.tag) tagTotals[it.tag] = (tagTotals[it.tag] || 0) + it.amount;
      }
    }
  }
  const topTag = Object.entries(tagTotals).sort((a, b) => b[1] - a[1])[0]?.[0];
  const TAG_CONFIG_CARD = {
    '충동': { emoji: '💸', label: '충동형', color: '#f87171' },
    '계획': { emoji: '📋', label: '계획형', color: '#60a5fa' },
    '필수': { emoji: '✅', label: '알뜰형', color: '#34d399' },
    '외식': { emoji: '🍽️', label: '미식형', color: '#fb923c' },
    '선물': { emoji: '🎁', label: '베풂형', color: '#c084fc' },
  };
  const tCfg = topTag ? (TAG_CONFIG_CARD[topTag] || null) : null;

  const infoY = afterCats + 32;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = 'rgba(165,180,252,0.9)';
  ctx.fillText('소비 성향', 40, infoY);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = tCfg?.color || 'rgba(148,163,184,0.8)';
  ctx.fillText(tCfg ? `${tCfg.emoji} ${tCfg.label}` : '분석 중', 40, infoY + 24);

  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = 'rgba(165,180,252,0.9)';
  ctx.fillText('재정 건강', W / 2, infoY);
  const scoreColor = hs.score >= 70 ? '#34d399' : hs.score >= 40 ? '#fbbf24' : '#f87171';
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = scoreColor;
  ctx.fillText(`${hs.score}점`, W / 2, infoY + 28);

  // ── 하단 브랜딩 ───────────────────────────────────────
  const brandY = H - 48;
  ctx.strokeStyle = 'rgba(99,102,241,0.25)';
  ctx.beginPath(); ctx.moveTo(40, brandY - 16); ctx.lineTo(W - 40, brandY - 16); ctx.stroke();

  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = 'rgba(165,180,252,0.5)';
  ctx.fillText('캐플 : cashflow', 40, brandY + 4);

  const dateStr = `${now.getFullYear()}.${p2(now.getMonth() + 1)}.${p2(now.getDate())}`;
  ctx.fillText(dateStr, W - 40 - ctx.measureText(dateStr).width, brandY + 4);

  // ── Canvas 표시 + 다운로드 ─────────────────────────────
  canvas.style.display = 'block';
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow-report-${now.getFullYear()}${p2(now.getMonth() + 1)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  });
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function _fmtCanvas(n) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000)}만`;
  return n.toLocaleString('ko-KR') + '원';
}

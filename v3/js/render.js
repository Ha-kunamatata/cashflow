// ════════════════════════════════════════════════════════
// render.js — 화면 렌더링
// ════════════════════════════════════════════════════════
import { DAYS_KR, CAT_COLORS, LEDGER_CAT_COLORS, LEDGER_CATEGORIES, LEDGER_INCOME_CATEGORIES } from './config.js';
import { ASSET_TYPES, ASSET_PURPOSES, PURPOSE_COLORS, getTotalAssets, getUsableMoney, getAssetsByPurpose, getHouseLevel, HOUSE_LEVELS } from './assets.js';
import { getMonthBudget, getMonthActual } from './budget.js';
import { computeStreak, BADGE_DEFS, RARITY_CONFIG } from './streak.js';
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
} from './utils.js';
import { state, DEFAULT_CARDS } from './state.js';
import { buildForecast, getCards, simulateWishPurchase } from './forecast.js';

let _chartPeriod = 30;
let _forecastFilter = 'all';
let _entryFilter = '전체';

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

  const sc = document.getElementById('sum-checkcard');
  if (sc) sc.textContent = fmtShort(checkTotal);

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
        <div class="event-row" data-forecast-idx="${i}">
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
  const fc = buildForecast(_chartPeriod);
  const vals = fc.map((f) => f.balance);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, state.dangerLine);
  const range = max - min || 1;

  const W = 560;
  const H = 120;
  const PAD = 10;
  const bw = W / fc.length;

  const py = (v) => PAD + (H - PAD * 2) - ((v - min) / range) * (H - PAD * 2);

  const pts = fc
    .map((f, i) => `${(i * bw + bw / 2).toFixed(1)},${py(f.balance).toFixed(1)}`)
    .join(' ');

  let dots = '';
  fc.forEach((f, i) => {
    if (!f.income && !f.expense) return;
    const fill =
      f.balance < state.dangerLine
        ? '#ef4444'
        : f.income > 0
          ? '#10b981'
          : '#f87171';

    dots += `<circle cx="${(i * bw + bw / 2).toFixed(1)}" cy="${py(f.balance).toFixed(1)}" r="2.5" fill="${fill}" opacity="0.82"/>`;
  });

  let labels = '';
  const step = _chartPeriod <= 30 ? 7 : _chartPeriod <= 90 ? 14 : 30;

  fc.filter((_, i) => i % step === 0).forEach((f, i) => {
    labels += `<text x="${(i * step * bw + bw / 2).toFixed(1)}" y="${H + 2}" fill="#475569" font-size="9" font-family="monospace" text-anchor="middle">${f.date.getMonth() + 1}/${f.date.getDate()}</text>`;
  });

  const zeroY = py(0);
  const dangerY = py(state.dangerLine);

  const el = document.getElementById('forecast-chart');
  if (!el) return;

  el.innerHTML = `
    <defs>
      <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.03"/>
      </linearGradient>
    </defs>
    ${
      state.dangerLine > min
        ? `<rect x="0" y="${dangerY.toFixed(1)}" width="${W}" height="${(zeroY - dangerY).toFixed(1)}" fill="rgba(249,115,22,0.06)"/>`
        : ''
    }
    <line x1="0" y1="${zeroY.toFixed(1)}" x2="${W}" y2="${zeroY.toFixed(1)}" stroke="#334155" stroke-width="1" stroke-dasharray="4 4"/>
    ${
      state.dangerLine > 0
        ? `<line x1="0" y1="${dangerY.toFixed(1)}" x2="${W}" y2="${dangerY.toFixed(1)}" stroke="#f97316" stroke-width="1.5" stroke-dasharray="4 3"/>
           <text x="4" y="${(dangerY - 4).toFixed(1)}" fill="#f97316" font-size="8" font-family="monospace">${fmtShort(state.dangerLine)}</text>`
        : ''
    }
    <polygon points="0,${H} ${pts} ${W},${H}" fill="url(#ag)"/>
    <polyline points="${pts}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    ${labels}
  `;
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

export function renderEntries() {
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
    container.innerHTML = '<div class="empty-state">항목이 없습니다<br>위 버튼으로 추가하세요!</div>';
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
    const m = d.getMonth() + 1;
    const cd = state.cardData[ym] || {};
    const isCurrent = d.getFullYear() === t.getFullYear() && m === t.getMonth() + 1;

    // 이달 고정항목 중 이 카드에 해당하는 것 합산
    const fixedByCard = {};
    for (const card of cards) {
      const fixedSum = (state.entries || [])
        .filter(e => e.type === 'expense' && e.card === card.id &&
          (!e.endMonth || yyyymm(d) <= parseInt(e.endMonth, 10)))
        .reduce((s, e) => s + Number(e.amount || 0), 0);
      fixedByCard[card.id] = fixedSum;
    }

    const totalVariable = cards.reduce((s, c) => s + Number(cd[c.id] || 0), 0);
    const totalFixed = Object.values(fixedByCard).reduce((a, b) => a + b, 0);
    const grandTotal = totalVariable + totalFixed;

    const cardInputs = cards.map(card => {
      const varAmt = cd[card.id] || 0;
      const fixedAmt = fixedByCard[card.id] || 0;
      return `
        <div style="margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <div style="width:8px;height:8px;border-radius:50%;background:${escapeHtml(card.color)};flex-shrink:0"></div>
            <div style="font-size:12px;font-weight:700;color:var(--text2)">${escapeHtml(card.name)} <span style="font-weight:400;color:var(--text3)">(${card.payDay}일)</span></div>
          </div>
          ${fixedAmt > 0 ? `<div style="font-size:10px;color:var(--text3);margin-bottom:4px">고정항목 자동합산: <span style="color:var(--accent2);font-weight:700">${fmtShort(fixedAmt)}</span></div>` : ''}
          <div style="font-size:10px;color:var(--text3);margin-bottom:3px">변동 지출 (식비·쇼핑 등)</div>
          <input class="card-num-input" type="number" value="${varAmt || ''}" placeholder="0" inputmode="numeric"
            data-ym="${ym}" data-card="${escapeHtml(card.id)}"
            style="border-color:${escapeHtml(card.color)};border-width:1.5px">
          ${fixedAmt > 0 ? `<div style="font-size:10px;color:var(--text3);margin-top:3px">예상 총 청구: <span style="font-weight:700;color:var(--text)">${fmtShort(fixedAmt + varAmt)}</span></div>` : ''}
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
      const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
      const ymNum = Number(ym);
      const monthFc = fc.filter(f => f.ym === ymNum);
      const totalInc = monthFc.reduce((s, f) => s + f.income, 0);
      const totalExp = monthFc.reduce((s, f) => s + f.expense, 0);
      const net = totalInc - totalExp;
      const dangerDays = monthFc.filter(f => f.balance < (state.dangerLine || 0)).length;
      const lowestBalance = monthFc.length ? Math.min(...monthFc.map(f => f.balance)) : state.balance;
      return { label: `${d.getMonth() + 1}월`, totalInc, totalExp, net, dangerDays, lowestBalance };
    });

    // 전체 위험일
    const allDangerDays = fc.filter(f => f.balance < (state.dangerLine || 0));
    const firstDanger = allDangerDays[0];
    const dangerCount = allDangerDays.length;

    // 큰 지출 TOP 3 (30일 내)
    const next30 = fc.slice(0, 30);
    const bigEvents = [];
    next30.forEach(f => {
      f.events.filter(e => e.type === 'expense' && e.amt >= 50_000).forEach(e => {
        bigEvents.push({ date: `${f.date.getMonth()+1}/${f.date.getDate()}`, name: e.name, amt: e.amt });
      });
    });
    bigEvents.sort((a, b) => b.amt - a.amt);
    const top3 = bigEvents.slice(0, 3);

    summaryEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        ${months.map(m => `
          <div style="background:var(--bg3);border-radius:14px;padding:12px;border:1px solid var(--border)">
            <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">${m.label} 예상</div>
            <div style="font-size:11px;color:var(--green2)">▲ ${fmtShort(m.totalInc)}</div>
            <div style="font-size:11px;color:var(--red2)">▼ ${fmtShort(m.totalExp)}</div>
            <div style="font-size:13px;font-weight:900;color:${m.net >= 0 ? 'var(--green2)' : 'var(--red2)'};margin-top:4px">${m.net >= 0 ? '+' : ''}${fmtShort(m.net)}</div>
            ${m.dangerDays > 0 ? `<div style="font-size:10px;color:var(--orange);margin-top:4px">⚠️ 위험일 ${m.dangerDays}일</div>` : `<div style="font-size:10px;color:var(--green2);margin-top:4px">✅ 안전</div>`}
          </div>`).join('')}
      </div>
      ${firstDanger ? `
        <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.3);border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:12px">
          <span style="font-weight:700;color:var(--orange)">⚠️ 위험 알림</span>
          <span style="color:var(--text2);margin-left:8px">앞으로 ${dangerCount}일 위험 구간, 최초 ${firstDanger.date.getMonth()+1}/${firstDanger.date.getDate()}일 (잔고 ${fmtShort(firstDanger.balance)})</span>
        </div>` : `
        <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:12px">
          <span style="font-weight:700;color:var(--green2)">✅ 365일 안전</span>
          <span style="color:var(--text2);margin-left:8px">앞 1년 위험일 없음</span>
        </div>`}
      ${top3.length ? `
        <div style="margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">📌 30일 내 큰 지출</div>
          ${top3.map(e => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
            <span style="color:var(--text2)">${e.date} ${escapeHtml(e.name)}</span>
            <span style="color:var(--red2);font-weight:700;font-family:var(--mono)">-${fmtShort(e.amt)}</span>
          </div>`).join('')}
        </div>` : ''}
    `;
  }

  // 차트
  const chartEl = document.getElementById('ledger-forecast-chart');
  if (chartEl) {
    const slice = fc.slice(0, _lfPeriod);
    const vals = slice.map(f => f.balance);
    const min = Math.min(...vals, 0);
    const max = Math.max(...vals, state.dangerLine);
    const range = max - min || 1;
    const W = 560, H = 100, PAD = 8;
    const bw = W / slice.length;
    const py = v => PAD + (H - PAD * 2) - ((v - min) / range) * (H - PAD * 2);
    const pts = slice.map((f, i) => `${(i * bw + bw / 2).toFixed(1)},${py(f.balance).toFixed(1)}`).join(' ');
    let dots = '';
    slice.forEach((f, i) => {
      if (!f.income && !f.expense) return;
      const fill = f.balance < state.dangerLine ? '#ef4444' : f.income > 0 ? '#10b981' : '#f87171';
      dots += `<circle cx="${(i * bw + bw / 2).toFixed(1)}" cy="${py(f.balance).toFixed(1)}" r="2.5" fill="${fill}" opacity="0.85"/>`;
    });
    const dangerY = py(state.dangerLine);
    chartEl.innerHTML = `
      <defs><linearGradient id="lfg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/>
      </linearGradient></defs>
      ${state.dangerLine > min ? `<rect x="0" y="${dangerY.toFixed(1)}" width="${W}" height="${(py(0) - dangerY).toFixed(1)}" fill="rgba(249,115,22,0.06)"/>` : ''}
      ${state.dangerLine > 0 ? `<line x1="0" y1="${dangerY.toFixed(1)}" x2="${W}" y2="${dangerY.toFixed(1)}" stroke="#f97316" stroke-width="1.5" stroke-dasharray="4 3"/>` : ''}
      <polygon points="0,${H} ${pts} ${W},${H}" fill="url(#lfg)"/>
      <polyline points="${pts}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round"/>
      ${dots}`;
  }

  // 테이블: 이번달 + 다음달만 (navMonth로 이동 가능)
  const t = today();
  const baseYear = t.getFullYear();
  const baseMonth = t.getMonth() + _lfNavMonth;
  const targetDate = new Date(baseYear, baseMonth, 1);
  const ym = targetDate.getFullYear() * 100 + (targetDate.getMonth() + 1);

  const navBtn = document.getElementById('btn-lf-month-nav');
  if (navBtn) navBtn.textContent = `${targetDate.getFullYear()}년 ${targetDate.getMonth() + 1}월`;

  // 현재달 + 다음달 날짜 범위
  const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 2, 0);

  const filtered = fc.filter(f => f.date >= startDate && f.date <= endDate);
  const tbody = document.getElementById('ledger-forecast-tbody');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:16px">해당 기간에 이벤트 없음</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(f => {
    const isDanger = f.balance < state.dangerLine;
    const dow = f.date.getDay();
    const dayColor = dow === 0 ? '#ef4444' : dow === 6 ? '#60a5fa' : '';
    const names = f.events.slice(0, 2).map(e => escapeHtml(e.name)).join(', ');
    return `<tr class="${isDanger ? 'danger-row' : ''}" style="${isDanger ? 'background:rgba(239,68,68,0.06)' : ''}">
      <td style="font-family:var(--mono);font-size:11px">${f.date.getMonth()+1}/${p2(f.date.getDate())}</td>
      <td style="font-size:11px;${dayColor ? `color:${dayColor}` : ''}">${DAYS_KR[dow]}</td>
      <td style="color:var(--green2);font-family:var(--mono);font-size:11px">${f.income > 0 ? '+'+fmtShort(f.income) : ''}</td>
      <td style="color:var(--red2);font-family:var(--mono);font-size:11px">${f.expense > 0 ? '-'+fmtShort(f.expense) : ''}</td>
      <td style="font-family:var(--mono);font-size:11px;color:${isDanger ? 'var(--orange)' : 'var(--text)'}">${fmtShort(f.balance)}</td>
      <td style="font-size:10px;color:var(--text3);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${names}${isDanger ? ' ⚠️' : ''}</td>
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
    const fixedHtml = fixedForDay.slice(0, 2).map(e =>
      `<div class="ledger-day-fixed ${e.type === 'income' ? 'ledger-day-fixed-inc' : ''}">${escapeHtml(e.name.slice(0, 4))}</div>`
    ).join('');

    html += `
      <div class="ledger-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${heatLevel > 0 ? 'heat-' + heatLevel : ''}" data-dk="${dk}">
        <div class="ledger-day-top">
          <div class="${numClass}">${day}</div>
        </div>
        <div class="ledger-day-amounts">
          ${dayExp > 0 ? `<div class="ledger-day-expense">-${fmtShort(dayExp)}</div>` : ''}
          ${dayInc > 0 ? `<div class="ledger-day-income">+${fmtShort(dayInc)}</div>` : ''}
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

  const el = document.getElementById('ledger-stats-content');
  if (!el) return;

  // 카테고리 도넛 + 랭킹
  const cats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const total = expense || 1;
  let donutSvg = '', donutLegend = '';
  if (cats.length > 0) {
    const R = 44, CX = 52, CY = 52;
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
    donutSvg += `<circle cx="${CX}" cy="${CY}" r="26" fill="var(--bg2)"/>`;
    donutSvg += `<text x="${CX}" y="${CY+4}" fill="var(--text)" font-size="10" text-anchor="middle" font-family="monospace" font-weight="700">${Math.round((expense/total)*100)}%</text>`;
  }

  cats.slice(0, 7).forEach(([cat, amt]) => {
    const col = LEDGER_CAT_COLORS[cat] || '#64748b';
    const pct = Math.round((amt / total) * 100);
    donutLegend += `
      <div class="lstat-cat-row">
        <span class="lstat-cat-dot" style="background:${col}"></span>
        <span class="lstat-cat-name">${cat}</span>
        <div class="lstat-cat-bar"><div style="width:${pct}%;background:${col};height:100%;border-radius:4px;opacity:.85"></div></div>
        <span class="lstat-cat-amt">${fmtShort(amt)}</span>
      </div>`;
  });

  // 일별 바 차트
  const sortedDays = Object.entries(dayMap).sort((a, b) => a[0] - b[0]);
  const maxDayAmt  = Math.max(...sortedDays.map(([, v]) => v), 1);
  let dayBars = sortedDays.map(([day, amt]) => `
    <div class="bar-row">
      <span class="bar-label">${day}일</span>
      <div class="bar-track"><div class="bar-fill expense" style="width:${((amt/maxDayAmt)*100).toFixed(1)}%"></div></div>
      <span class="bar-value" style="color:var(--red2)">${fmtShort(amt)}</span>
    </div>`).join('');

  // 전월 비교
  let prevM = m - 1, prevY = y;
  if (prevM < 0) { prevM = 11; prevY--; }
  const { expense: prevExp, income: prevInc } = getLedgerMonth(prevY, prevM);
  const expDiff  = expense - prevExp;
  const incDiff  = income  - prevInc;

  el.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div class="card-title">${y}년 ${m + 1}월 요약</div>
      <div class="lstat-summary-row">
        <div class="lstat-summary-item"><div class="lstat-summary-label">지출</div><div class="lstat-summary-val red">${fmtShort(expense)}</div></div>
        <div class="lstat-summary-item"><div class="lstat-summary-label">수입</div><div class="lstat-summary-val green">${fmtShort(income)}</div></div>
        <div class="lstat-summary-item"><div class="lstat-summary-label">순액</div><div class="lstat-summary-val" style="color:${net>=0?'var(--green2)':'var(--red2)'}">${fmtSigned(net)}</div></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">카테고리별 지출</div>
      ${expense === 0 ? '<div class="empty-state" style="padding:20px 0">지출 없음</div>' : `
        <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px">
          <svg width="104" height="104" viewBox="0 0 104 104" style="flex-shrink:0">${donutSvg}</svg>
          <div style="flex:1;min-width:160px">${donutLegend}</div>
        </div>`}
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">일별 지출</div>
      ${sortedDays.length === 0 ? '<div class="empty-state" style="padding:20px 0">기록 없음</div>' : `<div class="monthly-chart-bar">${dayBars}</div>`}
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">전월 대비</div>
      <div class="report-mom-item">
        <span>지출</span>
        <span style="color:${expDiff>0?'var(--red2)':'var(--green2)'}">${expDiff>=0?'+':''}${fmtSigned(expDiff)}</span>
        <span style="font-size:11px;color:var(--text3)">(전월 ${fmtShort(prevExp)})</span>
      </div>
      <div class="report-mom-item" style="margin-top:8px">
        <span>수입</span>
        <span style="color:${incDiff>=0?'var(--green2)':'var(--red2)'}">${incDiff>=0?'+':''}${fmtSigned(incDiff)}</span>
        <span style="font-size:11px;color:var(--text3)">(전월 ${fmtShort(prevInc)})</span>
      </div>
    </div>
  `;
}

function _renderAnnualStats() {
  const y = currentLedgerYear;
  const { expense: yearExp, income: yearInc, net: yearNet, monthMap } = getLedgerYear(y);

  const el = document.getElementById('ledger-stats-content');
  if (!el) return;

  // 월별 바 차트 (수입+지출)
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = monthMap[i + 1] || { expense: 0, income: 0 };
    return { label: `${i + 1}월`, expense: d.expense, income: d.income };
  });
  const maxVal = Math.max(...months.flatMap(d => [d.expense, d.income]), 1);
  const monthBars = months.map(d => `
    <div>
      <div style="font-size:9px;color:var(--text3);margin-bottom:3px;font-weight:600">${d.label}</div>
      <div class="bar-row">
        <span class="bar-label" style="color:var(--green2)">수</span>
        <div class="bar-track"><div class="bar-fill income" style="width:${((d.income/maxVal)*100).toFixed(1)}%"></div></div>
        <span class="bar-value" style="color:var(--green2)">${fmtShort(d.income)}</span>
      </div>
      <div class="bar-row">
        <span class="bar-label" style="color:var(--red2)">지</span>
        <div class="bar-track"><div class="bar-fill expense" style="width:${((d.expense/maxVal)*100).toFixed(1)}%"></div></div>
        <span class="bar-value" style="color:var(--red2)">${fmtShort(d.expense)}</span>
      </div>
    </div>`).join('');

  // 최대/최소 지출월
  const expMonths = months.filter(d => d.expense > 0).sort((a, b) => b.expense - a.expense);
  const bestLabel  = expMonths.length > 0 ? expMonths[expMonths.length - 1].label : '-';
  const worstLabel = expMonths.length > 0 ? expMonths[0].label : '-';

  el.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div class="card-title">${y}년 연간 요약</div>
      <div class="lstat-summary-row">
        <div class="lstat-summary-item"><div class="lstat-summary-label">연간 지출</div><div class="lstat-summary-val red">${fmtShort(yearExp)}</div></div>
        <div class="lstat-summary-item"><div class="lstat-summary-label">연간 수입</div><div class="lstat-summary-val green">${fmtShort(yearInc)}</div></div>
        <div class="lstat-summary-item"><div class="lstat-summary-label">순액</div><div class="lstat-summary-val" style="color:${yearNet>=0?'var(--green2)':'var(--red2)'}">${fmtSigned(yearNet)}</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <span class="info-chip success">📉 지출 최소: ${bestLabel}</span>
        <span class="info-chip warning">📈 지출 최대: ${worstLabel}</span>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">월별 수입 / 지출</div>
      <div class="monthly-chart-bar">${monthBars}</div>
    </div>
  `;
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
    const srColor = savingsRate >= 20 ? 'var(--green2)' : savingsRate >= 0 ? 'var(--yellow)' : 'var(--red2)';
    headerEl.innerHTML = `
      <div class="report-header-month">${now.getFullYear()}년 ${now.getMonth() + 1}월 재정 요약</div>
      <div class="report-header-grid">
        <div class="report-header-item">
          <div class="report-header-label">수입</div>
          <div class="report-header-val green">${fmtShort(curMonth.income)}</div>
        </div>
        <div class="report-header-item">
          <div class="report-header-label">지출</div>
          <div class="report-header-val red">${fmtShort(curMonth.expense)}</div>
        </div>
        <div class="report-header-item">
          <div class="report-header-label">순현금</div>
          <div class="report-header-val" style="color:${curMonth.net >= 0 ? 'var(--green2)' : 'var(--red2)'}">${fmtSigned(curMonth.net)}</div>
        </div>
        <div class="report-header-item">
          <div class="report-header-label">저축률</div>
          <div class="report-header-val" style="color:${srColor}">${savingsRate}%</div>
        </div>
      </div>`;
  }

  // ── 6개월 현금 흐름 차트 ─────────────────────────────
  const netEl = document.getElementById('report-net-chart');
  if (netEl) {
    const maxAmt = Math.max(...months.flatMap(m => [m.income, m.expense]), 1);
    netEl.innerHTML = `
      <div class="monthly-chart-bar">
        ${months.map((m) => `
          <div>
            <div style="font-size:9px;color:var(--text3);margin-bottom:4px;font-weight:700">${m.label}</div>
            <div class="bar-row">
              <span class="bar-label" style="color:var(--green2)">수</span>
              <div class="bar-track"><div class="bar-fill income" style="width:${((m.income / maxAmt) * 100).toFixed(1)}%"></div></div>
              <span class="bar-value" style="color:var(--green2)">${fmtShort(m.income)}</span>
            </div>
            <div class="bar-row">
              <span class="bar-label" style="color:var(--red2)">지</span>
              <div class="bar-track"><div class="bar-fill expense" style="width:${((m.expense / maxAmt) * 100).toFixed(1)}%"></div></div>
              <span class="bar-value" style="color:var(--red2)">${fmtShort(m.expense)}</span>
            </div>
          </div>`).join('<div style="height:4px"></div>')}
      </div>`;
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
    const savingsRate = curMonth.income > 0
      ? Math.round(((curMonth.income - curMonth.expense) / curMonth.income) * 100)
      : 0;
    const expenseRatio = curMonth.income > 0 ? Math.round((curMonth.expense / curMonth.income) * 100) : 100;
    const activeHalbu = state.entries.filter(e => e.category === '할부' && e.repeat === '매월' && (!e.endMonth || parseInt(e.endMonth, 10) >= yyyymm(now))).length;
    const halbuRatio = state.entries.filter(e => e.type === 'expense' && e.repeat === '매월')
      .filter(e => e.category === '할부').reduce((s, e) => s + e.amount, 0);
    const halbuPct = curMonth.expense > 0 ? Math.round((halbuRatio / curMonth.expense) * 100) : 0;

    const score = Math.max(0, Math.min(100,
      (savingsRate >= 20 ? 30 : savingsRate >= 10 ? 20 : savingsRate >= 0 ? 10 : 0) +
      (expenseRatio <= 70 ? 30 : expenseRatio <= 85 ? 20 : expenseRatio <= 100 ? 10 : 0) +
      (halbuPct <= 10 ? 20 : halbuPct <= 25 ? 12 : halbuPct <= 40 ? 6 : 0) +
      (activeHalbu <= 2 ? 20 : activeHalbu <= 5 ? 12 : 6)
    ));
    const scoreColor = score >= 70 ? 'var(--green2)' : score >= 45 ? 'var(--yellow)' : 'var(--red2)';
    const scoreLabel = score >= 70 ? '우수' : score >= 45 ? '양호' : '주의';

    healthEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
        <div class="report-health-circle" style="border-color:${scoreColor}">
          <div style="font-size:22px;font-weight:900;color:${scoreColor};font-family:var(--mono)">${score}</div>
          <div style="font-size:9px;color:var(--text3)">/ 100</div>
        </div>
        <div>
          <div style="font-size:16px;font-weight:800;color:${scoreColor}">${scoreLabel}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:3px">재정 건강 지수</div>
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
export function renderGoals() {
  const container = document.getElementById('goals-list');
  if (!container) return;

  const goals = state.goals || [];
  if (!goals.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px">
        <div style="font-size:48px;margin-bottom:12px">🎯</div>
        <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">목표가 없습니다</div>
        <div style="font-size:13px;color:var(--text3);line-height:1.6">저축 목표를 설정하고<br>달성까지 추적해보세요</div>
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

  const goalCards = goals.map((g) => {
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

    // Monthly savings speed relative to required
    const monthlyIncome = state.entries
      .filter(e => e.type === 'income' && e.repeat === '매월')
      .reduce((s, e) => s + e.amount, 0);
    const canSaveMonthly = monthlyIncome > 0 && monthlyRequired > 0
      ? Math.min(100, Math.round((monthlyIncome * 0.3 / monthlyRequired) * 100)) : 0; // assume 30% savings rate

    return `
      <div class="goal-card ${urgency ? 'goal-card-' + urgency : ''}" data-goal-id="${g.id}" style="cursor:default">
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

        <!-- 금액 & 진행률 -->
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin:10px 0 6px">
          <div>
            <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:2px">저축 현황</div>
            <div style="display:flex;align-items:baseline;gap:4px">
              <span style="font-family:var(--mono);font-size:20px;font-weight:900;color:var(--accent2)">${fmtFull(saved)}</span>
              <span style="font-size:11px;color:var(--text3)">/ ${fmtShort(target)}</span>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:28px;font-weight:900;font-family:var(--mono);color:${barColor};line-height:1">${pct}%</div>
            ${pct < 100 ? `<div style="font-size:10px;color:var(--text3)">${fmtShort(remaining)} 남음</div>` : '<div style="font-size:10px;color:var(--green2)">달성 완료!</div>'}
          </div>
        </div>
        <div class="goal-progress-track" style="height:8px;margin-bottom:10px">
          <div class="goal-progress-fill" style="width:${pct}%;background:${pct >= 100 ? 'linear-gradient(90deg,var(--green2),#10b981)' : `linear-gradient(90deg,${barColor},${barColor}aa)`}"></div>
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
        ` : pct >= 100 ? `
        <div style="font-size:13px;color:var(--green2);padding:10px;border-radius:10px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);margin-bottom:10px;text-align:center">
          🎉 목표를 달성했어요! 훌륭합니다!
        </div>
        ` : ''}

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
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">자산 목록</div>
      ${assets.length === 0 ? '<div class="empty-state" style="padding:24px 0">등록된 자산이 없습니다<br>아래 버튼으로 추가하세요</div>' : `<div class="assets-list">${assetItems}</div>`}
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

  // Get year/month from ui.js budget state
  let budgetYear, budgetMonth;
  try {
    const uiModule = window._budgetUiRef;
    budgetYear  = uiModule?.getBudgetYear?.()  ?? new Date().getFullYear();
    budgetMonth = uiModule?.getBudgetMonth?.() ?? new Date().getMonth();
  } catch (_) {
    budgetYear  = new Date().getFullYear();
    budgetMonth = new Date().getMonth();
  }

  // Update header label
  const labelEl = document.getElementById('budget-month-label');
  if (labelEl) labelEl.textContent = `${budgetYear}년 ${budgetMonth + 1}월`;

  const budget = getMonthBudget(state.budgets, budgetYear, budgetMonth);
  const actual = getMonthActual(state.ledgerData, budgetYear, budgetMonth);

  // All categories with budget or spending
  const allCats = new Set([...Object.keys(budget), ...Object.keys(actual)]);
  const totalBudget = Object.values(budget).reduce((s, v) => s + v, 0);
  const totalActual = Object.values(actual).reduce((s, v) => s + v, 0);
  const totalPct = totalBudget > 0 ? Math.min(100, Math.round((totalActual / totalBudget) * 100)) : 0;

  // Circular gauge SVG
  const gaugeR = 42, gaugeCX = 52, gaugeCY = 52;
  const circumference = 2 * Math.PI * gaugeR;
  const dashOffset = circumference * (1 - totalPct / 100);
  const gaugeColor = totalPct >= 100 ? '#ef4444' : totalPct >= 80 ? '#f97316' : '#10b981';
  const gaugeSvg = `
    <svg width="104" height="104" viewBox="0 0 104 104">
      <circle cx="${gaugeCX}" cy="${gaugeCY}" r="${gaugeR}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="10"/>
      <circle cx="${gaugeCX}" cy="${gaugeCY}" r="${gaugeR}" fill="none" stroke="${gaugeColor}" stroke-width="10"
        stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${dashOffset.toFixed(1)}"
        stroke-linecap="round" transform="rotate(-90 ${gaugeCX} ${gaugeCY})" style="transition:stroke-dashoffset 1s ease"/>
      <text x="${gaugeCX}" y="${gaugeCY - 6}" fill="var(--text)" font-size="16" text-anchor="middle" font-family="monospace" font-weight="900">${totalPct}%</text>
      <text x="${gaugeCX}" y="${gaugeCY + 10}" fill="var(--text3)" font-size="8" text-anchor="middle">사용</text>
    </svg>`;

  const catRows = [...allCats].map(cat => {
    const b = budget[cat] || 0;
    const a = actual[cat] || 0;
    const pct = b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;
    const over = a > b && b > 0;
    const fillColor = over ? 'var(--red2)' : pct >= 80 ? 'var(--orange)' : 'var(--green2)';
    const col = LEDGER_CAT_COLORS[cat] || '#64748b';
    return `
      <div class="budget-cat-row" id="budget-row-${escapeHtml(cat)}" data-cat="${escapeHtml(cat)}">
        <span class="lstat-cat-dot" style="background:${col}"></span>
        <span style="flex:1;font-size:12px;font-weight:600;color:var(--text)">${escapeHtml(cat)}</span>
        <div class="budget-progress">
          <div class="budget-progress-fill" style="width:${pct}%;background:${fillColor}"></div>
        </div>
        <span style="font-size:11px;font-family:var(--mono);min-width:70px;text-align:right;${over ? 'color:var(--red2)' : ''}">
          ${fmtShort(a)}${b > 0 ? `<span style="color:var(--text3)">/${fmtShort(b)}</span>` : ''}
        </span>
        <button class="icon-btn edit budget-cat-edit-btn" data-cat="${escapeHtml(cat)}" style="margin-left:4px">
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
          <div style="font-family:var(--mono);font-size:22px;font-weight:900;color:var(--text)">${fmtShort(totalActual)}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">예산 ${fmtShort(totalBudget)} 중</div>
          ${totalActual > totalBudget && totalBudget > 0 ? `<div class="budget-over" style="margin-top:4px;font-size:11px">⚠️ 예산 초과 ${fmtShort(totalActual - totalBudget)}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">카테고리별 예산
        <button class="btn btn-ghost" id="btn-budget-suggest" style="font-size:11px;padding:4px 10px"><div class="ripple-container"></div>✨ 자동 추천</button>
      </div>
      ${allCats.size === 0 ? '<div class="empty-state" style="padding:20px 0">지출 내역 또는 예산이 없습니다</div>' : catRows}
    </div>
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
    const msg = _wishFilter === 'bought'
      ? '구매 완료된 항목 없음'
      : wishlist.length ? '해당 필터에 아이템 없음' : '위에서 + 추가 버튼으로<br>사고 싶은 것들을 기록해보세요';
    container.innerHTML = `<div class="empty-state" style="padding:40px 20px;text-align:center">
      <div style="font-size:40px;margin-bottom:12px">🛒</div>
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">아이템 없음</div>
      <div style="font-size:12px;color:var(--text3);line-height:1.6">${msg}</div>
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

    return `
      <div class="wish-card ${w.bought ? 'bought' : ''}" data-id="${escapeHtml(w.id)}" data-idx="${idx}" draggable="true">
        <div class="wish-card-top">
          <!-- 드래그 핸들 -->
          <div class="wish-drag-handle" data-id="${escapeHtml(w.id)}" title="드래그하여 순서 변경">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" opacity="0.4"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>
          </div>
          <!-- 다중선택 체크박스 -->
          ${!w.bought ? `<label class="wish-select-wrap" onclick="event.stopPropagation()">
            <input type="checkbox" class="wish-checkbox" data-id="${escapeHtml(w.id)}" style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;flex-shrink:0">
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

export function renderFinance() {
  const watchlist = state.watchlist || [];
  const container = document.getElementById('watchlist-container');
  if (!container) return;

  if (!watchlist.length) {
    container.innerHTML = `<div class="empty-state" style="padding:40px 20px;text-align:center">
      <div style="font-size:40px;margin-bottom:12px">📈</div>
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">관심종목 없음</div>
      <div style="font-size:12px;color:var(--text3);line-height:1.6">+ 추가 버튼으로 주식, ETF,<br>암호화폐 종목을 추적해보세요</div>
    </div>`;
    updateFinanceSummary();
    return;
  }

  container.innerHTML = watchlist.map(item => {
    const data = _financeData[item.symbol];
    const isLoading = _financeLoading[item.symbol];
    const name = (data && data.name) ? data.name : item.name;

    let priceSection = '';
    if (isLoading) {
      priceSection = `<div style="font-size:12px;color:var(--text3)">불러오는 중...</div>`;
    } else if (data && data.price != null) {
      const chgColor = data.change > 0 ? 'var(--green2)' : data.change < 0 ? 'var(--red2)' : 'var(--text3)';
      const chgSign = data.change > 0 ? '+' : '';
      const currency = data.currency === 'KRW' ? '₩' : data.currency === 'USD' ? '$' : '';
      const priceStr = data.currency === 'KRW'
        ? (data.price >= 1000 ? data.price.toLocaleString() : data.price.toFixed(2))
        : data.price.toFixed(2);

      // 수익률 계산 (매수가 입력 시)
      let returnHtml = '';
      if (item.buyPrice && item.quantity) {
        const investedKRW = Number(item.buyPrice) * Number(item.quantity);
        const currentKRW = data.price * Number(item.quantity);
        const pnl = currentKRW - investedKRW;
        const pnlPct = investedKRW > 0 ? (pnl / investedKRW * 100) : 0;
        const pnlColor = pnl >= 0 ? 'var(--green2)' : 'var(--red2)';
        returnHtml = `<div style="font-size:10px;color:${pnlColor};font-weight:700;margin-top:2px">
          ${pnl >= 0 ? '+' : ''}${currency}${Math.abs(pnl).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)
        </div>`;
      }

      priceSection = `
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:900;font-family:var(--mono);color:var(--text)">${currency}${priceStr}</div>
          <div style="font-size:12px;font-weight:700;color:${chgColor}">${chgSign}${data.change?.toFixed(2) || 0} (${chgSign}${data.changePct?.toFixed(2) || 0}%)</div>
          ${returnHtml}
        </div>`;
    } else {
      priceSection = `<div style="font-size:11px;color:var(--text3)">데이터 없음<br><span style="font-size:9px">⚠️ API 제한</span></div>`;
    }

    const mktLabel = { KRX: '🇰🇷', US: '🇺🇸', CRYPTO: '₿', OTHER: '🌐' }[item.market] || '🌐';

    return `
      <div class="watchlist-card" data-symbol="${escapeHtml(item.symbol)}">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
              <span style="font-size:14px">${mktLabel}</span>
              <span style="font-size:15px;font-weight:900;color:var(--text)">${escapeHtml(name || item.symbol)}</span>
              <span style="font-size:10px;color:var(--text3);font-family:var(--mono)">${escapeHtml(item.symbol)}</span>
            </div>
            ${item.buyPrice ? `<div style="font-size:10px;color:var(--text3)">매수가 ${Number(item.buyPrice).toLocaleString()} × ${item.quantity || 1}주</div>` : ''}
            ${item.note ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${escapeHtml(item.note)}</div>` : ''}
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px">
            ${priceSection}
            <div style="display:flex;flex-direction:column;gap:4px">
              <button class="icon-btn edit watchlist-edit-btn" data-symbol="${escapeHtml(item.symbol)}" title="수정">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
              </button>
              <button class="icon-btn delete watchlist-del-btn" data-symbol="${escapeHtml(item.symbol)}" title="삭제">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  updateFinanceSummary();
}

function updateFinanceSummary() {
  const el = document.getElementById('finance-summary-inner');
  if (!el) return;
  const watchlist = state.watchlist || [];
  if (!watchlist.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3)">종목을 추가하면 여기에 요약이 표시됩니다</div>';
    return;
  }

  let totalInvested = 0, totalCurrent = 0, updatedCount = 0;
  for (const item of watchlist) {
    const data = _financeData[item.symbol];
    if (item.buyPrice && item.quantity && data?.price) {
      totalInvested += Number(item.buyPrice) * Number(item.quantity);
      totalCurrent += data.price * Number(item.quantity);
      updatedCount++;
    }
  }

  const pnl = totalCurrent - totalInvested;
  const pnlPct = totalInvested > 0 ? (pnl / totalInvested * 100) : 0;
  const pnlColor = pnl >= 0 ? 'var(--green2)' : 'var(--red2)';

  el.innerHTML = updatedCount > 0 ? `
    <div style="flex:1;min-width:80px">
      <div style="font-size:10px;font-weight:700;color:var(--text3)">총 평가액</div>
      <div style="font-size:16px;font-weight:900;font-family:var(--mono);color:var(--text)">${totalCurrent.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원</div>
    </div>
    <div style="flex:1;min-width:80px">
      <div style="font-size:10px;font-weight:700;color:var(--text3)">수익/손실</div>
      <div style="font-size:16px;font-weight:900;font-family:var(--mono);color:${pnlColor}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원</div>
      <div style="font-size:11px;color:${pnlColor}">${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%</div>
    </div>
  ` : `<div style="font-size:12px;color:var(--text3)">매수가 입력 시 수익률이 표시됩니다</div>`;
}

/** 종목 데이터 로드 (Yahoo Finance 비공개 API) */
export async function fetchStockPrice(item) {
  const { symbol, market } = item;
  // 한국 주식: 종목코드.KS (코스피) 또는 .KQ (코스닥) 시도
  let ticker = symbol;
  if (market === 'KRX') {
    ticker = symbol.includes('.') ? symbol : `${symbol}.KS`;
  } else if (market === 'CRYPTO') {
    ticker = symbol.includes('-') ? symbol : `${symbol}-USD`;
  }

  _financeLoading[symbol] = true;

  const _yahooFetch = async (yahooUrl) => {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`;
    const res = await fetch(proxy, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('proxy error');
    const wrapper = await res.json();
    return JSON.parse(wrapper.contents);
  };

  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const json = await _yahooFetch(yahooUrl);
    const result = json.chart?.result?.[0];
    if (!result) throw new Error('데이터 없음');

    const meta = result.meta;
    const price = meta.regularMarketPrice || meta.previousClose;
    const prevClose = meta.previousClose || meta.chartPreviousClose;
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose * 100) : 0;

    _financeData[symbol] = {
      price,
      change,
      changePct,
      name: item.name || meta.shortName || symbol,
      currency: meta.currency || 'USD',
      lastUpdated: new Date().toLocaleTimeString('ko-KR'),
    };
  } catch (e) {
    // KOSDAQ 시도
    if (market === 'KRX' && !symbol.includes('.')) {
      try {
        const json2 = await _yahooFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + '.KQ')}?interval=1d&range=5d`);
        const result2 = json2.chart?.result?.[0];
        if (result2) {
          const meta2 = result2.meta;
          const price2 = meta2.regularMarketPrice || meta2.previousClose;
          const prev2 = meta2.previousClose || meta2.chartPreviousClose;
          _financeData[symbol] = {
            price: price2, change: price2 - prev2, changePct: prev2 ? ((price2 - prev2) / prev2 * 100) : 0,
            name: item.name || meta2.shortName || symbol, currency: 'KRW',
            lastUpdated: new Date().toLocaleTimeString('ko-KR'),
          };
        }
      } catch {}
    }
    if (!_financeData[symbol]) {
      _financeData[symbol] = null; // 실패 표시
    }
  } finally {
    _financeLoading[symbol] = false;
  }
}

export async function refreshAllStocks() {
  const watchlist = state.watchlist || [];
  if (!watchlist.length) return;

  const infoEl = document.getElementById('finance-refresh-info');
  if (infoEl) infoEl.textContent = '새로고침 중...';

  await Promise.allSettled(watchlist.map(item => fetchStockPrice(item)));
  renderFinance();

  if (infoEl) infoEl.textContent = `마지막 갱신: ${new Date().toLocaleTimeString('ko-KR')}`;
}

// @ts-nocheck
// ════════════════════════════════════════════════════════
// render-report.ts — reports/charts rendering
// ════════════════════════════════════════════════════════
import {
  today,
  dateKey,
  yyyymm,
  p2,
  fmtShort,
  fmtSigned,
  escapeHtml,
} from './utils';
import { state } from './state';
import { buildForecast } from './forecast';
import { DAYS_KR } from './config';
import { getMonthBudget, getMonthActual } from './budget';
import { hasGeminiKey, renderMarkdown, getWeeklyCoachingInsight } from './ai';
import { computeStreak } from './streak';
import { getLedgerMonth } from './render-ledger';

// ── module-local state ───────────────────────────────────
let _chartPeriod = 30;
let _forecastFilter = 'all';
let _trendSelectedCats = [];
let _annualReviewYear = null;
let _annualReviewListenerReady = false;
let _simCategory = null;
let _simCurrentAvg = 0;

// ── helper setters (module-private) ─────────────────────
function setChartPeriodState(v) { _chartPeriod = v; }
function setForecastFilterState(v) { _forecastFilter = v; }
function setTrendSelectedCats(v) { _trendSelectedCats = v; }
function setAnnualReviewYear(v) { _annualReviewYear = v; }
function setAnnualReviewListenerReady(v) { _annualReviewListenerReady = v; }
function setSimCategoryState(v) { _simCategory = v; }
function setSimCurrentAvg(v) { _simCurrentAvg = v; }

// ════════════════════════════════════════════════════════
// 재정 계산 헬퍼 (render-home.ts에서도 사용)
// ════════════════════════════════════════════════════════
export function _calcMonthCF(d) {
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

export function _calcHealthScore(cf) {
  const { income, expense } = cf;
  const now = today();
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
  const savPts = savingsRate >= 20 ? 25 : savingsRate >= 10 ? 18 : savingsRate >= 0 ? 10 : 0;
  const expenseRatio = income > 0 ? Math.round((expense / income) * 100) : 100;
  const expPts = expenseRatio <= 70 ? 20 : expenseRatio <= 85 ? 12 : expenseRatio <= 100 ? 5 : 0;
  const halbuAmt = state.entries
    .filter(e => e.type === 'expense' && e.repeat === '매월' && e.category === '할부')
    .reduce((s, e) => s + e.amount, 0);
  const halbuPct = expense > 0 ? Math.round((halbuAmt / expense) * 100) : 0;
  const halbuPts = halbuPct <= 10 ? 15 : halbuPct <= 25 ? 9 : halbuPct <= 40 ? 4 : 0;
  const activeHalbu = state.entries.filter(
    e => e.category === '할부' && e.repeat === '매월' && (!e.endMonth || parseInt(e.endMonth, 10) >= yyyymm(now))
  ).length;
  const halbuCntPts = activeHalbu <= 2 ? 10 : activeHalbu <= 5 ? 6 : 2;
  const { count: streak } = computeStreak(state.ledgerData);
  const streakPts = streak >= 14 ? 15 : streak >= 7 ? 10 : streak >= 3 ? 5 : 0;
  const budget = getMonthBudget(state.budgets || {}, now.getFullYear(), now.getMonth());
  const budgetCats = Object.keys(budget);
  let budgetPts = 8;
  let budgetCompliance = null;
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

// ── 카테고리 컬러 팔레트 ─────────────────────────────
const REPORT_CAT_COLORS = {
  '월급': '#34d399', '부수입': '#6ee7b7', '이자': '#a7f3d0',
  '카드': '#f87171', '할부': '#fb923c', '공과금': '#facc15',
  '보험': '#c084fc', '식비': '#60a5fa', '교통': '#38bdf8',
  '통신': '#a78bfa', '구독': '#f472b6', '기타지출': '#94a3b8',
  '주거': '#fbbf24', '의료': '#4ade80', '문화': '#e879f9',
  '교육': '#22d3ee', '생활': '#fb923c', '저축': '#34d399',
};

// ════════════════════════════════════════════════════════
// 예측
// ════════════════════════════════════════════════════════
export function setChartPeriod(days, btn) {
  setChartPeriodState(days);
  document.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  renderForecast();
}

export function setForecastFilter(filter, btn) {
  setForecastFilterState(filter);
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

export function renderForecastInsights() {
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
  setSimCategoryState(cat);
  setSimCurrentAvg(months > 0 ? Math.round(total / months) : 0);

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
// 카테고리별 6개월 트렌드 차트
// ════════════════════════════════════════════════════════
export function setTrendCategory(cat) {
  let newCats = [..._trendSelectedCats];
  if (newCats.includes(cat)) {
    newCats = newCats.filter(c => c !== cat);
  } else if (newCats.length < 4) {
    newCats.push(cat);
  }
  setTrendSelectedCats(newCats);
  document.querySelectorAll('#report-cat-trend-chips .ledger-tag-btn').forEach(b =>
    b.classList.toggle('active', newCats.includes(b.dataset.cat))
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

  let current = _trendSelectedCats;
  if (current.length === 0) {
    current = topCats.slice(0, 2);
    setTrendSelectedCats(current);
  }

  chipsEl.innerHTML = topCats.map(cat =>
    `<button class="ledger-tag-btn${current.includes(cat) ? ' active' : ''}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
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

// ════════════════════════════════════════════════════════
// 도넛 SVG 빌더
// ════════════════════════════════════════════════════════
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
    const expDiff = curMonth.expense - prevMonth.expense;
    const expDiffPct = prevMonth.expense > 0 ? Math.round(Math.abs(expDiff) / prevMonth.expense * 100) : 0;

    // 6개월 저축률 스파크라인
    const srRates = months.map(m => m.income > 0 ? Math.round(((m.income - m.expense) / m.income) * 100) : 0);
    const srMax = Math.max(...srRates.map(Math.abs), 1);
    const sparkBars = srRates.map((sr, i) => {
      const isLast = i === srRates.length - 1;
      const h = Math.max(8, Math.round((Math.abs(sr) / srMax) * 28));
      const col = sr >= 20 ? '#34d399' : sr >= 0 ? '#fbbf24' : '#f87171';
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">
        <div style="width:10px;height:${h}px;background:${col};border-radius:2px;opacity:${isLast ? '1' : '0.55'}"></div>
        <div style="font-size:7px;color:var(--text3)">${months[i].label}</div>
      </div>`;
    }).join('');

    headerEl.innerHTML = `
      <div class="report-header-month">${now.getFullYear()}년 ${now.getMonth() + 1}월 재정 요약
        ${prevMonth.expense > 0 && expDiffPct >= 3 ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:${expDiff>0?'rgba(248,113,113,.15)':'rgba(52,211,153,.15)'};color:${expDiff>0?'var(--red2)':'var(--green2)'};margin-left:6px">${expDiff>0?'▲':'▼'}${expDiffPct}% 전월</span>` : ''}
      </div>
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
      </div>
      <div style="margin-top:14px">
        <div style="font-size:9px;color:var(--text3);margin-bottom:6px;font-weight:600">6개월 저축률 추이</div>
        <div style="display:flex;align-items:flex-end;gap:4px;height:42px">${sparkBars}</div>
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

  // ── 카테고리별 지출 도넛 ──────────────────────────────
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
  if (_annualReviewYear === null) setAnnualReviewYear(now.getFullYear());

  if (yearNavEl && !_annualReviewListenerReady) {
    yearNavEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-annual-year]');
      if (btn) {
        setAnnualReviewYear(parseInt(btn.dataset.annualYear, 10));
        renderAnnualReview();
      }
    });
    setAnnualReviewListenerReady(true);
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
// 월간 리포트 카드 Canvas 이미지 저장
// ════════════════════════════════════════════════════════
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

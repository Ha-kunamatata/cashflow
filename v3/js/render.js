// ════════════════════════════════════════════════════════
// render.js — 화면 렌더링
// ════════════════════════════════════════════════════════
import { DAYS_KR, CAT_COLORS } from './config.js';
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
import { state } from './state.js';
import { buildForecast } from './forecast.js';

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

export function setSelectedLedgerDate(dk) {
  _selectedLedgerDate = dk;
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
  if (activePage?.id === 'page-cards') renderCards();
  if (activePage?.id === 'page-ledger') renderLedger();
  if (activePage?.id === 'page-report') renderReport();
  if (activePage?.id === 'page-goals') renderGoals();
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
  const checkDaysTotal = Object.keys(state.checkData || {}).length;

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
  if (tb) {
    animateNumber(tb, state.balance, (v) => fmtShort(v));
    tb.className = 'topbar-balance-amount' + (state.balance < state.dangerLine ? ' danger' : '');
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
  const checkTotal = Object.entries(state.checkData || {})
    .filter(([d]) => d.startsWith(monthPrefix))
    .reduce((sum, [, v]) => sum + v, 0);

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
      chips += `<span class="info-chip ${diff === 0 ? 'success' : ''}">💰 ${diff === 0 ? '오늘 월급날!' : `월급까지 D-${diff}`}</span>`;
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
      chips += `<span class="info-chip success">✅ 할부 ${endingHalbu.length}건 종료 임박</span>`;
    }
    if (monthlyIncome > 0) {
      const remaining = monthlyIncome - monthlyExpense - checkTotal;
      chips += `<span class="info-chip ${remaining < 0 ? 'warning' : ''}">📊 여유 ${remaining >= 0 ? fmtShort(remaining) : '-' + fmtShort(-remaining)}</span>`;
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

  const checkDays = Object.keys(state.checkData || {}).filter((d) => d.startsWith(monthPrefix)).length;
  const scSub = document.getElementById('sum-checkcard-sub');
  if (scSub) scSub.textContent = `${checkDays}일 기록`;

  const fillEl = document.getElementById('checkcard-budget-fill');
  if (fillEl && monthlyIncome > 0) {
    const spendable = Math.max(monthlyIncome - monthlyExpense, 1);
    const pct = Math.min(100, Math.round((checkTotal / spendable) * 100));
    fillEl.style.width = `${pct}%`;
    fillEl.style.background = pct >= 100 ? 'var(--red2)' : pct >= 80 ? 'var(--orange)' : 'var(--green2)';
  }

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
    .map((f) => {
      const isDanger = f.balance < state.dangerLine;
      const dow = f.date.getDay();
      const dayColor =
        dow === 0
          ? 'color:var(--red2)'
          : dow === 6
            ? 'color:var(--accent2)'
            : 'color:var(--text3)';

      return `
        <div class="event-row">
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
    const amtClass =
      e.type === 'income'
        ? 'income'
        : e.category === '할부' && e.card === '현대카드'
          ? 'halbu-h'
          : e.category === '할부' && e.card === '국민카드'
            ? 'halbu-k'
            : 'expense';

    const cardBadge =
      e.card === '현대카드'
        ? '<span class="badge hyundai">현대</span>'
        : e.card === '국민카드'
          ? '<span class="badge kookmin">국민</span>'
          : '';

    const endMonthStr = String(e.endMonth || '');
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
  renderCardMonths();
}

export function renderCardMonths() {
  const t = today();
  let html = '';

  for (let i = -1; i <= 12; i++) {
    const d = new Date(t.getFullYear(), t.getMonth() + i, 1);
    const ym = String(yyyymm(d));
    const m = d.getMonth() + 1;
    const cd = state.cardData[ym] || {};
    const h = cd.hyundai || 0;
    const k = cd.kookmin || 0;
    const isCurrent = d.getFullYear() === t.getFullYear() && m === t.getMonth() + 1;

    html += `
      <div class="card-month-item ${isCurrent ? 'current' : ''}">
        <div class="card-month-header">
          <span class="card-month-label">${d.getFullYear()}년 ${m}월 ${isCurrent ? '<span style="font-size:10px;color:var(--accent2)">(이번달)</span>' : ''}</span>
          <span class="card-month-total">${h + k > 0 ? '-' + fmtShort(h + k) : '-'}</span>
        </div>
        <div class="card-inputs">
          <div>
            <div class="card-input-label hyundai">🔵 현대카드 (1일)</div>
            <input class="card-num-input" type="number" value="${h || ''}" placeholder="0" inputmode="numeric" data-ym="${ym}" data-card="hyundai" style="border-color:var(--accent)">
          </div>
          <div>
            <div class="card-input-label kookmin">🟠 국민카드 (3일)</div>
            <input class="card-num-input" type="number" value="${k || ''}" placeholder="0" inputmode="numeric" data-ym="${ym}" data-card="kookmin" style="border-color:var(--orange)">
          </div>
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
  const y = currentLedgerYear;
  const m = currentLedgerMonth;

  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  const startWd = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const monthPrefix = `${y}-${p2(m + 1)}`;

  const ml = document.getElementById('ledger-month-label');
  if (ml) ml.textContent = `${y}년 ${m + 1}월`;

  const monthEntries = Object.entries(state.checkData || {}).filter(([d]) =>
    d.startsWith(monthPrefix)
  );
  const monthTotal = monthEntries.reduce((sum, [, v]) => sum + v, 0);
  const spendDays = monthEntries.length;

  let maxDayText = '-';
  if (monthEntries.length > 0) {
    const [mx, ma] = monthEntries.reduce((max, cur) => (cur[1] > max[1] ? cur : max));
    const md = new Date(mx);
    maxDayText = `${md.getDate()}일 · ${fmtShort(ma)}`;
  }

  const te = document.getElementById('ledger-total-spend');
  if (te) te.textContent = fmtShort(monthTotal);

  const ae = document.getElementById('ledger-avg-spend');
  if (ae) ae.textContent = spendDays > 0 ? fmtShort(Math.round(monthTotal / spendDays)) : '-';

  const me = document.getElementById('ledger-max-day');
  if (me) me.textContent = maxDayText;

  // ── 주간 소비 요약 ─────────────────────────────────────
  const weeklyEl = document.getElementById('ledger-weekly-summary');
  if (weeklyEl) {
    const weeklySums = [];
    monthEntries.forEach(([date, amt]) => {
      const day = parseInt(date.split('-')[2], 10);
      const weekIdx = Math.floor((day - 1 + startWd) / 7);
      weeklySums[weekIdx] = (weeklySums[weekIdx] || 0) + amt;
    });
    const totalWeeks = Math.ceil((totalDays + startWd) / 7);
    weeklyEl.innerHTML = Array.from({ length: totalWeeks }, (_, i) => {
      const sum = weeklySums[i] || 0;
      return `<div class="week-chip">
        <div class="week-chip-label">${i + 1}주차</div>
        <div class="week-chip-value ${sum === 0 ? 'zero' : ''}">${sum > 0 ? fmtShort(sum) : '-'}</div>
      </div>`;
    }).join('');
  }

  const ms = document.getElementById('ledger-month-summary');
  if (ms) {
    ms.innerHTML = `
      <div class="ledger-summary-hero">
        <div>
          <strong>${m + 1}월 소비 요약</strong>
          <span>날짜를 눌러 금액을 입력하거나 수정할 수 있어요</span>
        </div>
        <div style="font-family:var(--mono);font-size:16px;color:var(--orange);font-weight:800">${fmtShort(monthTotal)}</div>
      </div>
    `;
  }

  const chartEl = document.getElementById('ledger-bar-chart');
  if (chartEl) {
    if (!monthEntries.length) {
      chartEl.innerHTML = '<div class="empty-state" style="padding:20px 0">이번 달 소비 기록이 없습니다</div>';
    } else {
      const maxAmt = Math.max(...monthEntries.map(([, v]) => v), 1);
      chartEl.innerHTML = `
        <div class="monthly-chart-bar">
          ${monthEntries
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, amt]) => {
              const dd = new Date(date);
              return `
                <div class="bar-row">
                  <span class="bar-label">${dd.getDate()}일</span>
                  <div class="bar-track">
                    <div class="bar-fill expense" style="width:${((amt / maxAmt) * 100).toFixed(1)}%"></div>
                  </div>
                  <span class="bar-value" style="color:var(--red2)">${fmtShort(amt)}</span>
                </div>
              `;
            })
            .join('')}
        </div>
      `;
    }
  }

  let html = '';
  for (let i = 0; i < startWd; i++) {
    html += '<div class="ledger-day empty"></div>';
  }

  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(y, m, day);
    const dk = dateKey(d);
    const dow = d.getDay();
    const isToday = dk === dateKey(today());
    const isSelected = dk === _selectedLedgerDate;
    const amt = state.checkData?.[dk] || 0;
    const numClass = 'ledger-day-num' + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '');

    html += `
      <div class="ledger-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-dk="${dk}">
        <div class="ledger-day-top">
          <div class="${numClass}">${day}</div>
        </div>
        <div class="ledger-day-amount">${amt > 0 ? '-' + fmtShort(amt) : ''}</div>
      </div>
    `;
  }

  const grid = document.getElementById('ledger-calendar-grid');
  if (grid) grid.innerHTML = html;
}

export function changeLedgerMonth(diff) {
  currentLedgerMonth += diff;

  if (currentLedgerMonth < 0) {
    currentLedgerMonth = 11;
    currentLedgerYear--;
  }

  if (currentLedgerMonth > 11) {
    currentLedgerMonth = 0;
    currentLedgerYear++;
  }

  localStorage.setItem('cashflow_ledger_ym', JSON.stringify({ y: currentLedgerYear, m: currentLedgerMonth }));
  _selectedLedgerDate = null;

  const ec = document.getElementById('ledger-editor-card');
  if (ec) ec.style.display = 'none';

  renderLedger();
}

// ════════════════════════════════════════════════════════
// 리포트 탭
// ════════════════════════════════════════════════════════
export function renderReport() {
  const now = today();

  // ── 월별 순현금 흐름 차트 ─────────────────────────────
  const netEl = document.getElementById('report-net-chart');
  if (netEl) {
    const months = [];
    for (let i = -5; i <= 0; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ym = yyyymm(d);
      const ymStr = String(ym);
      const income = state.entries
        .filter((e) => e.type === 'income' && e.repeat === '매월')
        .reduce((s, e) => s + e.amount, 0);
      const fixedExp = state.entries
        .filter((e) => e.type === 'expense' && e.repeat === '매월' && (!e.endMonth || parseInt(e.endMonth, 10) >= ym))
        .reduce((s, e) => s + e.amount, 0);
      const cd = state.cardData[ymStr] || {};
      const checkTotal = Object.entries(state.checkData || {})
        .filter(([dk]) => dk.startsWith(`${d.getFullYear()}-${p2(d.getMonth() + 1)}`))
        .reduce((s, [, v]) => s + v, 0);
      const expense = fixedExp + (cd.hyundai || 0) + (cd.kookmin || 0) + checkTotal;
      months.push({ label: `${d.getMonth() + 1}월`, net: income - expense, income, expense });
    }
    const maxAbs = Math.max(...months.map((m) => Math.abs(m.net)), 1);
    netEl.innerHTML = `
      <div class="monthly-chart-bar">
        ${months.map((m) => {
          const pct = Math.round((Math.abs(m.net) / maxAbs) * 100);
          const isPos = m.net >= 0;
          return `
            <div class="bar-row">
              <span class="bar-label">${m.label}</span>
              <div class="bar-track">
                <div class="bar-fill ${isPos ? 'income' : 'expense'}" style="width:${pct}%"></div>
              </div>
              <span class="bar-value" style="color:${isPos ? 'var(--green2)' : 'var(--red2)'}">${fmtSigned(m.net)}</span>
            </div>`;
        }).join('')}
      </div>`;
  }

  // ── 카테고리별 지출 도넛 ──────────────────────────────
  const donutEl = document.getElementById('report-cat-donut');
  if (donutEl) {
    const catTotals = {};
    state.entries
      .filter((e) => e.type === 'expense' && e.repeat === '매월')
      .forEach((e) => {
        catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
      });
    const total = Object.values(catTotals).reduce((s, v) => s + v, 0);
    if (total === 0) {
      donutEl.innerHTML = '<div class="empty-state" style="padding:16px 0">지출 항목 없음</div>';
    } else {
      const cats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
      const colors = { '카드': '#f87171', '할부': '#fb923c', '공과금': '#facc15', '보험': '#c084fc', '기타지출': '#94a3b8' };
      // SVG donut
      const R = 44; const CX = 52; const CY = 52;
      let svgPaths = '';
      let startAngle = -Math.PI / 2;
      cats.forEach(([cat, amt]) => {
        const pct = amt / total;
        const angle = pct * 2 * Math.PI;
        const endAngle = startAngle + angle;
        const x1 = CX + R * Math.cos(startAngle);
        const y1 = CY + R * Math.sin(startAngle);
        const x2 = CX + R * Math.cos(endAngle);
        const y2 = CY + R * Math.sin(endAngle);
        const large = angle > Math.PI ? 1 : 0;
        const col = colors[cat] || '#64748b';
        svgPaths += `<path d="M${CX},${CY} L${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${col}" opacity="0.85"/>`;
        startAngle = endAngle;
      });
      svgPaths += `<circle cx="${CX}" cy="${CY}" r="24" fill="var(--bg2)"/>`;

      const legend = cats.slice(0, 5).map(([cat, amt]) => {
        const col = colors[cat] || '#64748b';
        return `<div class="report-cat-legend-row">
          <span style="width:10px;height:10px;border-radius:50%;background:${col};display:inline-block;flex-shrink:0"></span>
          <span style="font-size:11px;color:var(--text2)">${cat}</span>
          <span style="font-size:11px;font-family:var(--mono);font-weight:700;color:var(--text);margin-left:auto">${Math.round((amt / total) * 100)}%</span>
        </div>`;
      }).join('');

      donutEl.innerHTML = `
        <svg width="104" height="104" viewBox="0 0 104 104" style="flex-shrink:0">${svgPaths}</svg>
        <div style="flex:1;display:flex;flex-direction:column;gap:5px">${legend}</div>`;
    }
  }

  // ── 전월 비교 ────────────────────────────────────────
  const momEl = document.getElementById('report-mom-compare');
  if (momEl) {
    const thisMonthD = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const calcMonth = (d) => {
      const ym = yyyymm(d);
      const ymStr = String(ym);
      const income = state.entries
        .filter((e) => e.type === 'income' && e.repeat === '매월')
        .reduce((s, e) => s + e.amount, 0);
      const expense = state.entries
        .filter((e) => e.type === 'expense' && e.repeat === '매월' && (!e.endMonth || parseInt(e.endMonth, 10) >= ym))
        .reduce((s, e) => s + e.amount, 0);
      const cd = state.cardData[ymStr] || {};
      return { income, expense: expense + (cd.hyundai || 0) + (cd.kookmin || 0) };
    };
    const cur = calcMonth(thisMonthD);
    const prv = calcMonth(lastMonthD);
    const expDelta = cur.expense - prv.expense;
    const inDelta = cur.income - prv.income;
    momEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="report-mom-item">
          <div class="report-mom-label">이번달 수입</div>
          <div class="report-mom-value" style="color:var(--green2)">${fmtShort(cur.income)}</div>
          <div class="report-mom-delta" style="color:${inDelta >= 0 ? 'var(--green2)' : 'var(--red2)'}">${fmtSigned(inDelta)} 전월비</div>
        </div>
        <div class="report-mom-item">
          <div class="report-mom-label">이번달 지출</div>
          <div class="report-mom-value" style="color:var(--red2)">${fmtShort(cur.expense)}</div>
          <div class="report-mom-delta" style="color:${expDelta <= 0 ? 'var(--green2)' : 'var(--red2)'}">${fmtSigned(expDelta)} 전월비</div>
        </div>
      </div>`;
  }
}

// ════════════════════════════════════════════════════════
// 목표 탭
// ════════════════════════════════════════════════════════
export function renderGoals() {
  const container = document.getElementById('goals-list');
  if (!container) return;

  const goals = state.goals || [];
  if (!goals.length) {
    container.innerHTML = '<div class="empty-state">목표가 없습니다<br>위 버튼으로 추가하세요!</div>';
    return;
  }

  const now = today();
  const nowYm = yyyymm(now);

  container.innerHTML = goals.map((g) => {
    const saved = g.savedAmount || 0;
    const target = g.targetAmount || 1;
    const pct = Math.min(100, Math.round((saved / target) * 100));

    let monthsLeft = 0;
    let monthlyRequired = 0;
    if (g.targetDate) {
      const ty = parseInt(g.targetDate.slice(0, 4), 10);
      const tm = parseInt(g.targetDate.slice(4), 10) - 1;
      const targetDateObj = new Date(ty, tm, 1);
      monthsLeft = Math.max(0, (ty - now.getFullYear()) * 12 + (tm - now.getMonth()));
      const remaining = Math.max(0, target - saved);
      monthlyRequired = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
    }
    const barColor = pct >= 100 ? 'var(--green2)' : pct >= 60 ? 'var(--accent2)' : 'var(--orange)';

    return `
      <div class="goal-card">
        <div class="goal-card-top">
          <div class="goal-emoji">${g.emoji || '🎯'}</div>
          <div class="goal-info">
            <div class="goal-name">${escapeHtml(g.name)}</div>
            ${g.targetDate ? `<div class="goal-date">${g.targetDate.slice(0, 4)}년 ${parseInt(g.targetDate.slice(4), 10)}월 목표 · ${monthsLeft}개월 남음</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;margin-left:auto">
            <button class="icon-btn edit goal-edit-btn" data-id="${g.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button class="icon-btn del goal-del-btn" data-id="${g.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>
          </div>
        </div>
        <div class="goal-amounts">
          <span style="font-family:var(--mono);font-size:18px;font-weight:900;color:var(--accent2)">${fmtShort(saved)}</span>
          <span style="font-size:12px;color:var(--text3)"> / ${fmtShort(target)}</span>
          <span style="font-size:12px;font-weight:700;color:${barColor};margin-left:auto">${pct}%</span>
        </div>
        <div class="goal-progress-track">
          <div class="goal-progress-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        ${monthlyRequired > 0 && pct < 100 ? `<div class="goal-monthly-req">월 <strong>${fmtShort(monthlyRequired)}</strong> 씩 모으면 목표 달성 가능해요</div>` : pct >= 100 ? '<div class="goal-monthly-req" style="color:var(--green2)">🎉 목표 달성!</div>' : ''}
      </div>`;
  }).join('');
}

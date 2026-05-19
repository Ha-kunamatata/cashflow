// @ts-nocheck
// ════════════════════════════════════════════════════════
// render-ledger.ts — 가계부/달력/통계 렌더링
// ════════════════════════════════════════════════════════
import { LEDGER_CAT_COLORS, CAT_ICONS } from './config';
import { today, dateKey, p2, fmtShort, fmtSigned, escapeHtml, yyyymm } from './utils';
import { state } from './state';
import { buildForecast } from './forecast';
import { currentLedgerYear, currentLedgerMonth, _selectedLedgerDate, setCurrentLedgerYear, setCurrentLedgerMonth, setSelectedLedgerDate } from './render-state';
import { renderBudget } from './render-assets';
import { getMonthBudget } from './budget';

let _ledgerSubTab   = 'calendar';
let _ledgerStatsTab = 'monthly';
let _lfPeriod = 30;
let _lfNavMonth = 0;

export function getLedgerDay(dk) {
  const items   = state.ledgerData?.[dk] || [];
  const expense = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
  const income  = items.filter(i => i.type === 'income' ).reduce((s, i) => s + i.amount, 0);
  return { expense, income, items };
}

export function getLedgerMonth(year, month) {
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

export function getLedgerYear(year) {
  let expense = 0, income = 0;
  const monthMap = {};
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

export function renderLedger() {
  if (_ledgerSubTab === 'stats') {
    renderLedgerStats();
  } else if (_ledgerSubTab === 'forecast') {
    renderLedgerForecast();
  } else {
    renderLedgerCalendar();
  }
}

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
  const DAYS_KR_LF = ['일', '월', '화', '수', '목', '금', '토'];

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

    const allDangerDays = fc.filter(f => f.balance < (state.dangerLine || 0));
    const firstDanger = allDangerDays[0];
    const dangerCount = allDangerDays.length;

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

  const t = today();
  const baseYear = t.getFullYear();
  const baseMonth = t.getMonth() + _lfNavMonth;
  const targetDate = new Date(baseYear, baseMonth, 1);

  const navBtn = document.getElementById('btn-lf-month-nav');
  if (navBtn) navBtn.textContent = `${targetDate.getFullYear()}년 ${targetDate.getMonth() + 1}월`;

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
      <td style="font-size:11px;${dayColor ? `color:${dayColor}` : ''}">${DAYS_KR_LF[dow]}</td>
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

  // 예산 진행 바
  const budgetBar = document.getElementById('ledger-cal-budget-bar');
  if (budgetBar) {
    const budgets = getMonthBudget(state.budgets || {}, y, m);
    const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0);
    if (totalBudget > 0) {
      const pct = Math.min(100, Math.round((monthExp / totalBudget) * 100));
      const over = monthExp > totalBudget;
      budgetBar.style.display = '';
      budgetBar.innerHTML = `
        <div class="cal-budget-bar-row">
          <span class="cal-budget-bar-lbl">이번달 예산</span>
          <span class="cal-budget-bar-pct" style="color:${over ? 'var(--red2)' : 'var(--text2)'}">${pct}% ${over ? '초과' : '사용'}</span>
          <span class="cal-budget-bar-amt">${fmtShort(monthExp)} / ${fmtShort(totalBudget)}</span>
        </div>
        <div class="cal-budget-track">
          <div class="cal-budget-fill ${over ? 'over' : pct >= 80 ? 'warn' : ''}" style="width:${pct}%"></div>
        </div>`;
    } else {
      budgetBar.style.display = 'none';
    }
  }

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

    const { expense: dayExp, income: dayInc, items: dayItems } = getLedgerDay(dk);
    const heatPct = maxDay > 0 ? dayExp / maxDay : 0;
    const heatLevel = heatPct > 0.8 ? 4 : heatPct > 0.5 ? 3 : heatPct > 0.25 ? 2 : heatPct > 0 ? 1 : 0;

    // 카테고리 컬러 도트 (지출 상위 3개)
    const catAmts = {};
    dayItems.forEach(item => {
      if (item.type === 'expense') catAmts[item.category] = (catAmts[item.category] || 0) + item.amount;
    });
    const topCats = Object.entries(catAmts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const catDotsHtml = topCats.length > 0
      ? `<div class="lday-cat-dots">${topCats.map(([cat]) => `<span class="lday-cat-dot" style="background:${LEDGER_CAT_COLORS[cat] || '#64748b'}"></span>`).join('')}</div>`
      : '';

    const fixedForDay = (state.entries || []).filter(e =>
      e.repeat === '매월' && e.day === day &&
      (!e.endMonth || parseInt(e.endMonth) >= yyyymm(new Date(y, m, 1)))
    );
    const fixedHtml = fixedForDay.slice(0, 1).map(e =>
      `<div class="ledger-day-fixed ${e.type === 'income' ? 'ledger-day-fixed-inc' : ''}">${escapeHtml(e.name.slice(0, 4))}</div>`
    ).join('');

    html += `
      <div class="ledger-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${heatLevel > 0 ? 'heat-' + heatLevel : ''}" data-dk="${dk}">
        <div class="ledger-day-top">
          <div class="${numClass}">${day}</div>
        </div>
        ${catDotsHtml}
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

  const TAG_EMOJI = { '충동': '💸', '계획': '📋', '필수': '✅', '외식': '🍽️', '선물': '🎁' };
  const tagTotals = {}, tagCounts = {};
  const pfx = `${y}-${p2(m + 1)}`;
  for (const [dk, items] of Object.entries(state.ledgerData || {})) {
    if (!dk.startsWith(pfx)) continue;
    for (const item of items) {
      if (item.type === 'expense' && item.tag) {
        tagTotals[item.tag] = (tagTotals[item.tag] || 0) + item.amount;
        tagCounts[item.tag] = (tagCounts[item.tag] || 0) + 1;
      }
    }
  }
  const tagEntries = Object.entries(tagTotals).sort((a, b) => b[1] - a[1]);

  const el = document.getElementById('ledger-stats-content');
  if (!el) return;

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
    donutSvg += `<text x="${CX}" y="${CY-2}" fill="var(--text3)" font-size="7" text-anchor="middle" font-family="monospace">지출</text>`;
    donutSvg += `<text x="${CX}" y="${CY+8}" fill="var(--text)" font-size="8.5" text-anchor="middle" font-family="monospace" font-weight="700">${fmtShort(expense)}</text>`;
  }

  const sortedDays = Object.entries(dayMap).sort((a, b) => a[0] - b[0]);
  const maxDayAmt  = Math.max(...sortedDays.map(([, v]) => v), 1);
  let dayBars = sortedDays.map(([day, amt]) => `
    <div class="bar-row">
      <span class="bar-label">${day}일</span>
      <div class="bar-track"><div class="bar-fill expense" style="width:${((amt/maxDayAmt)*100).toFixed(1)}%"></div></div>
      <span class="bar-value" style="color:var(--red2)">${fmtShort(amt)}</span>
    </div>`).join('');

  let prevM = m - 1, prevY = y;
  if (prevM < 0) { prevM = 11; prevY--; }
  const { expense: prevExp, income: prevInc, catTotals: prevCatTotals } = getLedgerMonth(prevY, prevM);
  const expDiff  = expense - prevExp;
  const incDiff  = income  - prevInc;

  // 카테고리별 전월 대비 트렌드
  cats.slice(0, 7).forEach(([cat, amt]) => {
    const col = LEDGER_CAT_COLORS[cat] || '#64748b';
    const icon = CAT_ICONS[cat] || '📌';
    const pct = Math.round((amt / total) * 100);
    const prevAmt = prevCatTotals[cat] || 0;
    const trend = prevAmt > 0 ? Math.round(((amt - prevAmt) / prevAmt) * 100) : null;
    const trendHtml = trend !== null && Math.abs(trend) >= 5
      ? `<span class="lstat-cat-trend" style="color:${trend > 0 ? 'var(--red2)' : 'var(--green2)'}">${trend > 0 ? '▲' : '▼'}${Math.abs(trend)}%</span>`
      : '';
    donutLegend += `
      <div class="lstat-cat-row">
        <span class="lstat-cat-icon-sm">${icon}</span>
        <span class="lstat-cat-name">${cat}</span>
        <div class="lstat-cat-bar"><div style="width:${pct}%;background:${col};height:100%;border-radius:4px;opacity:.85"></div></div>
        <span class="lstat-cat-amt">${fmtShort(amt)}</span>
        ${trendHtml}
      </div>`;
  });

  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : null;
  const srChip = savingsRate !== null
    ? `<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${savingsRate >= 20 ? 'rgba(52,211,153,0.15)' : savingsRate >= 0 ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)'};color:${savingsRate >= 20 ? 'var(--green2)' : savingsRate >= 0 ? '#fbbf24' : 'var(--red2)'};font-weight:700">저축률 ${savingsRate}%</span>`
    : '';

  el.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">${y}년 ${m + 1}월 요약 ${srChip}</div>
      <div class="lstat-summary-row">
        <div class="lstat-summary-item">
          <div class="lstat-summary-label">지출</div>
          <div class="lstat-summary-val red">${fmtShort(expense)}</div>
          ${prevExp > 0 ? `<div style="font-size:9px;color:${expDiff>0?'var(--red2)':'var(--green2)'};margin-top:2px">${expDiff>0?'▲':'▼'}${Math.abs(Math.round((expDiff/prevExp)*100))}% 전월</div>` : ''}
        </div>
        <div class="lstat-summary-item">
          <div class="lstat-summary-label">수입</div>
          <div class="lstat-summary-val green">${fmtShort(income)}</div>
          ${prevInc > 0 ? `<div style="font-size:9px;color:${incDiff>=0?'var(--green2)':'var(--red2)'};margin-top:2px">${incDiff>=0?'▲':'▼'}${Math.abs(Math.round((incDiff/prevInc)*100))}% 전월</div>` : ''}
        </div>
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

    ${tagEntries.length > 0 ? `
    <div class="card" style="margin-bottom:12px">
      <div class="card-title">🏷️ 소비 유형별 지출</div>
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
  `;
}

function _renderHeatmap(year) {
  const el = document.getElementById('ledger-heatmap');
  if (!el) return;

  const dayExp = {};
  const yearPfx = `${year}-`;
  for (const [dk, items] of Object.entries(state.ledgerData || {})) {
    if (!dk.startsWith(yearPfx)) continue;
    const exp = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
    if (exp > 0) dayExp[dk] = exp;
  }

  const maxExp = Math.max(...Object.values(dayExp), 1);
  const jan1 = new Date(year, 0, 1);
  const startDow = jan1.getDay();
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
    if (i < startDow) continue;
    const dayIdx = i - startDow;
    const d = new Date(year, 0, dayIdx + 1);
    const dk = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const exp = dayExp[dk] || 0;
    const intensity = exp > 0 ? Math.min(1, exp / maxExp) : 0;

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

function _renderAnnualStats() {
  const y = currentLedgerYear;
  const { expense: yearExp, income: yearInc, net: yearNet, monthMap } = getLedgerYear(y);

  const el = document.getElementById('ledger-stats-content');
  if (!el) return;

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

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">📅 ${y}년 지출 히트맵</div>
      <div id="ledger-heatmap" style="overflow-x:auto;padding-bottom:4px"></div>
    </div>
  `;

  _renderHeatmap(y);
}

export function changeLedgerMonth(diff) {
  let newYear = currentLedgerYear;
  let newMonth = currentLedgerMonth + diff;

  if (newMonth < 0)  { newMonth = 11; newYear--; }
  if (newMonth > 11) { newMonth = 0;  newYear++; }

  setCurrentLedgerYear(newYear);
  setCurrentLedgerMonth(newMonth);

  localStorage.setItem('cashflow_ledger_ym', JSON.stringify({ y: newYear, m: newMonth }));
  setSelectedLedgerDate(null);

  renderLedger();

  if (_ledgerSubTab === 'stats') renderLedgerStats();
}

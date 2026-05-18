// @ts-nocheck
// ════════════════════════════════════════════════════════
// render-home.ts — home screen rendering
// ════════════════════════════════════════════════════════
import { DAYS_KR } from './config';
import { getMonthBudget, getMonthActual } from './budget';
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
import { state } from './state';
import { buildForecast } from './forecast';
import { getLedgerDay, getLedgerMonth, _calcMonthCF, _calcHealthScore } from './render-ledger';
import { renderHouseLevel, renderStreak } from './render-goals';

// ════════════════════════════════════════════════════════
// 주간 요약 카드 helpers
// ════════════════════════════════════════════════════════
export function _getWeekExpense(offsetWeeks) {
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
// 스파크라인 (최근 14일 지출 패턴)
// ════════════════════════════════════════════════════════
export function _renderSparkline() {
  const el = document.getElementById('balance-sparkline');
  if (!el) return;
  const now = today();
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dk = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const items = state.ledgerData?.[dk] || [];
    const exp = items.filter(it => it.type === 'expense').reduce((s, it) => s + it.amount, 0);
    days.push({ exp, isToday: i === 0 });
  }
  const hasData = days.some(d => d.exp > 0);
  if (!hasData) { el.innerHTML = ''; return; }
  const maxExp = Math.max(...days.map(d => d.exp), 1);
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:9px;color:rgba(255,255,255,0.35);letter-spacing:0.5px">14일 지출 패턴</span>
      <span style="font-size:9px;color:rgba(255,255,255,0.45)">오늘 <span style="color:#f87171;font-weight:700">${fmtShort(days[13].exp)}</span></span>
    </div>
    <div style="display:flex;align-items:flex-end;gap:2px;height:26px">
      ${days.map(d => {
        const pct = Math.max(10, Math.round((d.exp / maxExp) * 100));
        const col = d.isToday ? 'rgba(129,140,248,0.9)' : d.exp > 0 ? 'rgba(248,113,113,0.65)' : 'rgba(255,255,255,0.08)';
        return `<div style="flex:1;border-radius:2px 2px 0 0;background:${col};height:${pct}%;transition:height 0.3s ease"></div>`;
      }).join('')}
    </div>`;
}

// ════════════════════════════════════════════════════════
// 오늘의 소비 타임라인
// ════════════════════════════════════════════════════════
export function _renderTodayTimeline() {
  const el = document.getElementById('today-timeline');
  if (!el) return;
  const dk = dateKey(today());
  const items = (state.ledgerData?.[dk] || []).filter(i => i.type === 'expense');
  if (!items.length) { el.innerHTML = ''; return; }
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
// 홈 예산 진행 바 위젯
// ════════════════════════════════════════════════════════
export function renderHomeBudgetBars() {
  const el = document.getElementById('home-budget-widget');
  if (!el) return;

  const now = today();
  const budget = getMonthBudget(state.budgets || {}, now.getFullYear(), now.getMonth());
  const actual = getMonthActual(state.ledgerData, now.getFullYear(), now.getMonth());

  const cats = Object.keys(budget).filter(c => budget[c] > 0);
  if (!cats.length) { el.innerHTML = ''; return; }

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
  renderHomeBudgetBars();
  renderHomeForecastWidget();
  renderWeeklyCard();

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

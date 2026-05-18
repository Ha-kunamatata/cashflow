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
import { getLedgerDay, getLedgerMonth } from './render-ledger';
import { _calcMonthCF, _calcHealthScore } from './render-report';
import { renderHouseLevel, renderStreak } from './render-goals';
import { detectRecurringPatterns } from './recurring';

// ════════════════════════════════════════════════════════
// 월 진행률 바
// ════════════════════════════════════════════════════════
export function renderMonthProgress() {
  const el = document.getElementById('month-progress-wrap');
  if (!el) return;
  const now = today();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = now.getDate();
  const elapsedPct = Math.round((elapsed / lastDay) * 100);

  const budget = getMonthBudget(state.budgets || {}, now.getFullYear(), now.getMonth());
  const actual = getMonthActual(state.ledgerData, now.getFullYear(), now.getMonth());
  const budgetTotal = Object.values(budget).reduce((s: number, v: number) => s + v, 0);
  const actualTotal = Object.values(actual).reduce((s: number, v: number) => s + v, 0);
  const budgetPct = budgetTotal > 0 ? Math.min(150, Math.round((actualTotal / budgetTotal) * 100)) : null;

  const barColor = budgetPct !== null
    ? (budgetPct > elapsedPct + 15 ? 'var(--red2)' : budgetPct > elapsedPct ? 'var(--orange)' : 'var(--green2)')
    : 'var(--accent2)';

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
      <span style="font-size:9px;color:rgba(255,255,255,0.4);letter-spacing:0.5px">${now.getMonth() + 1}월 진행률</span>
      <span style="font-size:9px;color:rgba(255,255,255,0.5)">${elapsed}일 / ${lastDay}일</span>
    </div>
    <div style="position:relative;height:5px;background:rgba(255,255,255,0.08);border-radius:6px;overflow:visible">
      <div style="height:100%;width:${elapsedPct}%;background:rgba(255,255,255,0.25);border-radius:6px;transition:width 0.6s ease"></div>
      ${budgetPct !== null ? `<div style="position:absolute;top:0;left:0;height:100%;width:${Math.min(100, budgetPct)}%;background:${barColor};border-radius:6px;opacity:0.85;transition:width 0.6s ease"></div>` : ''}
    </div>
    ${budgetPct !== null ? `
    <div style="display:flex;justify-content:space-between;margin-top:4px">
      <span style="font-size:9px;color:rgba(255,255,255,0.35)">시간 ${elapsedPct}%</span>
      <span style="font-size:9px;color:${barColor};font-weight:700">예산 ${budgetPct}% 소진</span>
    </div>` : `<div style="margin-top:4px;font-size:9px;color:rgba(255,255,255,0.3)">이번 달 ${lastDay - elapsed}일 남음</div>`}`;
}

// ════════════════════════════════════════════════════════
// 이번달 현금흐름 요약 카드
// ════════════════════════════════════════════════════════
export function renderCashflowCard() {
  const el = document.getElementById('home-cashflow-card');
  if (!el) return;

  const now = today();
  const cf = _calcMonthCF(now);
  const savingsRate = cf.income > 0 ? Math.round(((cf.income - cf.expense) / cf.income) * 100) : 0;
  const srColor = savingsRate >= 20 ? 'var(--green2)' : savingsRate >= 0 ? 'var(--yellow)' : 'var(--red2)';

  // 전월 비교
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevCf = _calcMonthCF(prevDate);
  const expDelta = cf.expense - prevCf.expense;
  const expDeltaPct = prevCf.expense > 0 ? Math.round((Math.abs(expDelta) / prevCf.expense) * 100) : 0;

  // 소비 게이지 (수입 대비 지출)
  const spendPct = cf.income > 0 ? Math.min(130, Math.round((cf.expense / cf.income) * 100)) : 0;
  const spendColor = spendPct >= 100 ? 'var(--red2)' : spendPct >= 80 ? 'var(--orange)' : 'var(--green2)';

  el.innerHTML = `
    <div class="card" style="padding:14px 16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:12px;font-weight:800;color:var(--text)">📊 이번달 현금흐름</div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:10px;color:var(--text3)">${now.getFullYear()}년 ${now.getMonth() + 1}월</span>
          <span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:20px;background:${srColor}22;color:${srColor};border:1px solid ${srColor}44">저축 ${savingsRate}%</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="text-align:center;padding:10px 6px;background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.2);border-radius:12px">
          <div style="font-size:9px;color:var(--text3);margin-bottom:3px;letter-spacing:0.3px">월 수입</div>
          <div style="font-size:14px;font-weight:800;font-family:var(--mono);color:var(--green2)">${fmtShort(cf.income)}</div>
        </div>
        <div style="text-align:center;padding:10px 6px;background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.2);border-radius:12px">
          <div style="font-size:9px;color:var(--text3);margin-bottom:3px;letter-spacing:0.3px">월 지출</div>
          <div style="font-size:14px;font-weight:800;font-family:var(--mono);color:var(--red2)">${fmtShort(cf.expense)}</div>
          ${expDelta !== 0 && prevCf.expense > 0 ? `<div style="font-size:9px;color:${expDelta > 0 ? 'var(--red2)' : 'var(--green2)'};">${expDelta > 0 ? '▲' : '▼'}${expDeltaPct}% 전월</div>` : ''}
        </div>
        <div style="text-align:center;padding:10px 6px;background:${cf.net >= 0 ? 'rgba(16,185,129,0.07)' : 'rgba(248,113,113,0.07)'};border:1px solid ${cf.net >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(248,113,113,0.2)'};border-radius:12px">
          <div style="font-size:9px;color:var(--text3);margin-bottom:3px;letter-spacing:0.3px">순현금</div>
          <div style="font-size:14px;font-weight:800;font-family:var(--mono);color:${cf.net >= 0 ? 'var(--green2)' : 'var(--red2)'}">${fmtSigned(cf.net)}</div>
        </div>
      </div>
      <div style="margin-top:2px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:10px;color:var(--text3)">소비율 (수입 대비)</span>
          <span style="font-size:10px;font-weight:700;color:${spendColor}">${spendPct}%</span>
        </div>
        <div style="height:6px;background:var(--bg4);border-radius:8px;overflow:hidden">
          <div style="height:100%;width:${Math.min(100, spendPct)}%;background:linear-gradient(90deg,var(--green2),${spendColor});border-radius:8px;transition:width 0.6s ease"></div>
        </div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════
// 다음 7일 예정 캘린더
// ════════════════════════════════════════════════════════
export function renderUpcoming7Day() {
  const el = document.getElementById('upcoming-7day');
  if (!el) return;

  const now = today();
  const fc = buildForecast(8);
  const next7 = fc.slice(1, 8); // tomorrow ~ 7 days

  if (!next7.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">예정 없음</div>'; return; }

  el.innerHTML = next7.map(f => {
    const hasEvent = f.income > 0 || f.expense > 0;
    const dow = f.date.getDay();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const isWeekend = dow === 0 || dow === 6;
    const isDanger = f.balance < state.dangerLine;

    return `
      <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
        <div style="width:36px;text-align:center;flex-shrink:0">
          <div style="font-size:13px;font-weight:800;font-family:var(--mono);color:${isWeekend ? 'var(--accent2)' : 'var(--text)'}">${f.date.getDate()}</div>
          <div style="font-size:9px;color:${isWeekend ? 'var(--accent2)' : 'var(--text3)'};margin-top:1px">${dayNames[dow]}</div>
        </div>
        <div style="flex:1;min-width:0">
          ${hasEvent
            ? f.events.slice(0, 2).map(ev => `<div style="font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(ev.name)}</div>`).join('')
            : '<div style="font-size:11px;color:var(--text3)">일정 없음</div>'
          }
        </div>
        <div style="text-align:right;flex-shrink:0">
          ${f.income > 0 ? `<div style="font-size:11px;font-weight:700;font-family:var(--mono);color:var(--green2)">+${fmtShort(f.income)}</div>` : ''}
          ${f.expense > 0 ? `<div style="font-size:11px;font-weight:700;font-family:var(--mono);color:var(--red2)">-${fmtShort(f.expense)}</div>` : ''}
          <div style="font-size:9px;color:${isDanger ? 'var(--red2)' : 'var(--text3)'}">${fmtShort(f.balance)}</div>
        </div>
      </div>`;
  }).join('');
}

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
  const daysIn = dow === 0 ? 7 : dow;

  // 이번 주 일별 지출 (월~오늘)
  const weekDayNames = ['월', '화', '수', '목', '금', '토', '일'];
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const d = new Date(now);
    d.setDate(now.getDate() + diffToMon + i);
    if (d > now) { weekDays.push({ label: weekDayNames[i], exp: 0, isFuture: true }); continue; }
    const dk = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const exp = (state.ledgerData?.[dk] || []).filter(it => it.type === 'expense').reduce((s, it) => s + it.amount, 0);
    weekDays.push({ label: weekDayNames[i], exp, isToday: i === (dow === 0 ? 6 : dow - 1), isFuture: false });
  }
  const maxDay = Math.max(...weekDays.map(d => d.exp), 1);

  const budget = getMonthBudget(state.budgets || {}, now.getFullYear(), now.getMonth());
  const hasBudget = Object.keys(budget).length > 0;
  const actual = hasBudget ? getMonthActual(state.ledgerData, now.getFullYear(), now.getMonth()) : {};
  const budgetTotal = Object.values(budget).reduce((s: number, v: number) => s + v, 0);
  const actualTotal = Object.values(actual).reduce((s: number, v: number) => s + v, 0);
  const remaining = budgetTotal - actualTotal;

  el.innerHTML = `
    <div class="card" style="padding:14px 16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:15px">📅</span>
        <div style="font-size:12px;font-weight:800;color:var(--text)">이번 주 지출</div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:6px">
          <span style="font-size:13px;font-weight:800;font-family:var(--mono);color:#a5b4fc">${fmtShort(thisWeek)}</span>
          <span style="font-size:10px;color:${diffColor};font-weight:700">${diff <= 0 ? '▼' : '▲'}${fmtShort(Math.abs(diff))}</span>
        </div>
      </div>
      <div style="display:flex;align-items:flex-end;gap:4px;height:44px;margin-bottom:4px">
        ${weekDays.map(d => {
          const pct = d.isFuture ? 0 : Math.max(d.exp > 0 ? 15 : 0, Math.round((d.exp / maxDay) * 100));
          const col = d.isToday ? 'var(--accent2)' : d.isFuture ? 'rgba(255,255,255,0.05)' : 'rgba(248,113,113,0.6)';
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
            <div style="flex:1;width:100%;display:flex;align-items:flex-end">
              <div style="width:100%;height:${pct}%;background:${col};border-radius:3px 3px 0 0;min-height:${d.exp > 0 ? '4px' : '0'};transition:height 0.4s ease"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:4px">
        ${weekDays.map(d => `<div style="flex:1;text-align:center;font-size:9px;color:${d.isToday ? 'var(--accent2)' : 'var(--text3)'}${d.isToday ? ';font-weight:700' : ''}">${d.label}</div>`).join('')}
      </div>
      ${hasBudget ? `
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;padding:8px 10px;background:var(--bg3);border-radius:10px;border:1px solid var(--border);margin-top:10px">
        <span style="color:var(--text3)">이번달 예산 잔여</span>
        <span style="font-weight:800;font-family:var(--mono);color:${remaining >= 0 ? 'var(--green2)' : 'var(--red2)'}">${fmtSigned(remaining)}</span>
      </div>` : ''}
    </div>`;
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
const _CAT_DOTS: Record<string, string> = {
  '식비': '#f97316', '교통': '#38bdf8', '카드': '#f87171', '할부': '#fb923c',
  '공과금': '#facc15', '보험': '#c084fc', '통신': '#a78bfa', '구독': '#f472b6',
  '의료': '#4ade80', '주거': '#fbbf24', '문화': '#e879f9', '교육': '#22d3ee',
  '생활': '#94a3b8', '기타지출': '#64748b',
};

export function _renderTodayTimeline() {
  const el = document.getElementById('today-timeline');
  if (!el) return;
  const dk = dateKey(today());
  const allItems = state.ledgerData?.[dk] || [];
  const expenses = allItems.filter(i => i.type === 'expense');
  const incomes = allItems.filter(i => i.type === 'income');
  if (!allItems.length) { el.innerHTML = ''; return; }

  const totalExp = expenses.reduce((s, i) => s + i.amount, 0);
  const totalInc = incomes.reduce((s, i) => s + i.amount, 0);

  // 카테고리별 합산
  const catMap: Record<string, number> = {};
  expenses.forEach(i => { catMap[i.category] = (catMap[i.category] || 0) + i.amount; });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

  el.innerHTML = `
    <div class="card" style="padding:12px 14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:14px">🕐</span>
        <div style="font-size:12px;font-weight:800;color:var(--text)">오늘의 기록</div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
          ${totalInc > 0 ? `<span style="font-size:11px;font-weight:700;font-family:var(--mono);color:var(--green2)">+${fmtShort(totalInc)}</span>` : ''}
          ${totalExp > 0 ? `<span style="font-size:11px;font-weight:700;font-family:var(--mono);color:var(--red2)">-${fmtShort(totalExp)}</span>` : ''}
        </div>
      </div>
      ${topCats.length > 0 ? `
      <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
        ${topCats.map(([cat, amt]) => {
          const dot = _CAT_DOTS[cat] || '#64748b';
          return `<span style="font-size:10px;padding:3px 8px;border-radius:20px;background:${dot}18;border:1px solid ${dot}40;color:${dot};font-weight:600">${escapeHtml(cat)} ${fmtShort(amt)}</span>`;
        }).join('')}
      </div>` : ''}
      ${[...expenses.slice(-5).reverse(), ...incomes.slice(-2).reverse()].slice(0, 5).map(i => {
        const dot = i.type === 'income' ? 'var(--green2)' : (_CAT_DOTS[i.category] || '#64748b');
        return `
          <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--border)">
            <div style="width:6px;height:6px;border-radius:50%;background:${dot};flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(i.memo || i.category || '-')}</div>
              <div style="font-size:10px;color:var(--text3)">${escapeHtml(i.category)}</div>
            </div>
            <div style="font-size:12px;font-weight:700;font-family:var(--mono);color:${i.type === 'income' ? 'var(--green2)' : 'var(--red2)'};flex-shrink:0">${i.type === 'income' ? '+' : '-'}${fmtShort(i.amount)}</div>
          </div>`;
      }).join('')}
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
// 반복 패턴 감지 힌트 배너
// ════════════════════════════════════════════════════════
function _renderRecurringHint() {
  // house-level-card 앞에 동적으로 삽입
  const anchor = document.getElementById('house-level-card');
  if (!anchor) return;
  const existing = document.getElementById('recurring-hint-card');

  const patterns = detectRecurringPatterns(state.ledgerData || {}, state.entries || []);
  if (!patterns.length) {
    existing?.remove();
    return;
  }

  const html = `
    <div id="recurring-hint-card" style="margin-bottom:12px;padding:12px 14px;border-radius:14px;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.25);cursor:pointer" data-action="entries">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:14px">🔍</span>
        <div style="font-size:12px;font-weight:800;color:var(--text)">반복 지출 패턴 감지</div>
        <span style="margin-left:auto;font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(251,191,36,0.2);color:#fbbf24;font-weight:700">${patterns.length}건</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${patterns.slice(0, 3).map(p => `
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:11px;color:var(--text2)">${escapeHtml(p.memo)} <span style="font-size:10px;color:var(--text3)">· 매월 ~${p.suggestedDay}일</span></span>
            <span style="font-size:11px;font-family:var(--mono);font-weight:700;color:var(--orange)">${fmtShort(p.avgAmount)}</span>
          </div>`).join('')}
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:8px">항목 탭에서 고정 항목으로 등록하세요 →</div>
    </div>`;

  if (existing) {
    existing.outerHTML = html;
  } else {
    anchor.insertAdjacentHTML('beforebegin', html);
  }
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
  renderMonthProgress();
  renderCashflowCard();
  _renderTodayTimeline();
  renderHomeBudgetBars();
  renderWeeklyCard();
  renderHomeForecastWidget();
  renderUpcoming7Day();

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

  // ── 반복 패턴 감지 힌트 ──────────────────────────────
  _renderRecurringHint();

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

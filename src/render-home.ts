// @ts-nocheck
// ════════════════════════════════════════════════════════
// render-home.ts — home screen rendering
// ════════════════════════════════════════════════════════
import { DAYS_KR, LEDGER_CAT_COLORS, CAT_ICONS } from './config';
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
// 히어로 카드 내 이번달 수입/지출/저축률 3분할
// ════════════════════════════════════════════════════════
function _renderHeroMonthStats() {
  const el = document.getElementById('hero-month-stats');
  if (!el) return;
  const now = today();
  const { income, expense } = getLedgerMonth(now.getFullYear(), now.getMonth());
  const net = income - expense;
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : null;
  const srColor = savingsRate !== null
    ? (savingsRate >= 20 ? '#34d399' : savingsRate >= 0 ? '#fbbf24' : '#f87171')
    : 'rgba(255,255,255,0.4)';

  el.innerHTML = `
    <div class="hero-stats-row">
      <div class="hero-stat-item">
        <div class="hero-stat-lbl">수입</div>
        <div class="hero-stat-val" style="color:#34d399">${income > 0 ? '+' + fmtShort(income) : '-'}</div>
      </div>
      <div class="hero-stat-sep"></div>
      <div class="hero-stat-item">
        <div class="hero-stat-lbl">지출</div>
        <div class="hero-stat-val" style="color:#f87171">${expense > 0 ? '-' + fmtShort(expense) : '-'}</div>
      </div>
      <div class="hero-stat-sep"></div>
      <div class="hero-stat-item">
        <div class="hero-stat-lbl">저축률</div>
        <div class="hero-stat-val" style="color:${srColor}">${savingsRate !== null ? savingsRate + '%' : '-'}</div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════
// 이번달 현금흐름 요약 카드 (하위호환 유지)
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

  // 이번 주 카테고리별 합산
  const weekCatAmts: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const d = new Date(now);
    d.setDate(now.getDate() + diffToMon + i);
    if (d > now) break;
    const dk = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    (state.ledgerData?.[dk] || []).forEach(it => {
      if (it.type === 'expense') weekCatAmts[it.category] = (weekCatAmts[it.category] || 0) + it.amount;
    });
  }
  const topWeekCats = Object.entries(weekCatAmts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  el.innerHTML = `
    <div class="home-section-hdr">이번 주</div>
    <div class="card" style="padding:14px 16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="font-size:12px;font-weight:800;color:var(--text)">주간 지출</div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:6px">
          <span style="font-size:15px;font-weight:900;font-family:var(--mono);color:#a5b4fc">${fmtShort(thisWeek)}</span>
          ${lastWeek > 0 ? `<span style="font-size:10px;color:${diffColor};font-weight:700;padding:2px 7px;border-radius:8px;background:${diff<=0?'rgba(52,211,153,.1)':'rgba(248,113,113,.1)'}">${diff <= 0 ? '▼' : '▲'}${fmtShort(Math.abs(diff))}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:flex-end;gap:3px;height:52px;margin-bottom:3px">
        ${weekDays.map(d => {
          const pct = d.isFuture ? 0 : Math.max(d.exp > 0 ? 12 : 0, Math.round((d.exp / maxDay) * 100));
          const col = d.isToday ? '#818cf8' : d.isFuture ? 'rgba(255,255,255,0.04)' : 'rgba(248,113,113,0.55)';
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px">
            ${!d.isFuture && d.exp > 0 ? `<div style="font-size:7px;color:var(--text3);font-family:var(--mono);margin-bottom:1px">${fmtShort(d.exp).replace('만','만\n')}</div>` : '<div style="height:12px"></div>'}
            <div style="flex:1;width:100%;display:flex;align-items:flex-end">
              <div style="width:100%;height:${pct}%;background:${col};border-radius:3px 3px 0 0;min-height:${d.exp > 0 ? '3px' : '0'};transition:height .4s ease"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:3px;margin-bottom:${topWeekCats.length ? '10px' : '0'}">
        ${weekDays.map(d => `<div style="flex:1;text-align:center;font-size:9px;color:${d.isToday ? '#818cf8' : 'var(--text3)'}${d.isToday ? ';font-weight:800' : ''}">${d.label}</div>`).join('')}
      </div>
      ${topWeekCats.length > 0 ? `
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        ${topWeekCats.map(([cat, amt]) => {
          const col = LEDGER_CAT_COLORS[cat] || '#64748b';
          return `<span style="font-size:10px;padding:2px 8px;border-radius:20px;background:${col}18;color:${col};font-weight:600">${escapeHtml(cat)} ${fmtShort(amt)}</span>`;
        }).join('')}
      </div>` : ''}
      ${hasBudget ? `
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;padding:7px 10px;background:var(--bg3);border-radius:10px;border:1px solid var(--border);margin-top:8px">
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
// 오늘의 소비 타임라인 (뱅크샐러드 스타일 카드)
// ════════════════════════════════════════════════════════
const TAG_EMOJI_HOME: Record<string, string> = { '충동': '💸', '계획': '📋', '필수': '✅', '외식': '🍽️', '선물': '🎁' };

export function _renderTodayTimeline() {
  const el = document.getElementById('today-timeline');
  if (!el) return;
  const dk = dateKey(today());
  const allItems = state.ledgerData?.[dk] || [];
  if (!allItems.length) { el.innerHTML = ''; return; }

  const totalExp = allItems.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
  const totalInc = allItems.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);

  const cardsHtml = allItems.slice().reverse().map(i => {
    const col  = LEDGER_CAT_COLORS[i.category] || '#64748b';
    const icon = CAT_ICONS[i.category] || (i.type === 'income' ? '💰' : '📦');
    const sign = i.type === 'income' ? '+' : '-';
    const amtCls = i.type === 'income' ? 'green' : 'red';
    return `<div class="lday-card">
      <div class="lday-card-icon-wrap" style="background:${col}15;border-color:${col}35;color:${col}">${icon}</div>
      <div class="lday-card-body">
        <div class="lday-card-name">${escapeHtml(i.memo || i.category)}</div>
        <div class="lday-card-meta">
          <span>${escapeHtml(i.category)}</span>
          ${i.tag ? `<span class="lday-card-tag">${TAG_EMOJI_HOME[i.tag] || ''}${escapeHtml(i.tag)}</span>` : ''}
        </div>
      </div>
      <div class="lday-card-right">
        <span class="lday-card-amount ${amtCls}">${sign}${fmtShort(i.amount)}</span>
      </div>
    </div>`;
  }).join('');

  const nowD = today();
  const dateLabel = `${nowD.getMonth() + 1}월 ${nowD.getDate()}일`;

  el.innerHTML = `
    <div class="home-section-hdr">오늘의 소비</div>
    <div class="card today-timeline-card">
      <div class="today-timeline-header">
        <span class="today-timeline-title">${dateLabel}</span>
        <div class="today-timeline-totals">
          ${totalInc > 0 ? `<span class="today-total-inc">+${fmtShort(totalInc)}</span>` : ''}
          ${totalExp > 0 ? `<span class="today-total-exp">-${fmtShort(totalExp)}</span>` : ''}
        </div>
      </div>
      ${cardsHtml}
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
    <div class="home-section-hdr">예산 현황</div>
    <div class="card" style="padding:14px 16px;cursor:pointer" id="home-budget-widget-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:12px;font-weight:800;color:var(--text)">이달 예산</div>
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
// 이달 카테고리별 소비 도넛 링 (뱅크샐러드 스타일)
// ════════════════════════════════════════════════════════
export function renderHomeCategoryRing() {
  const el = document.getElementById('home-cat-ring');
  if (!el) return;
  const now = today();
  const { expense, catTotals } = getLedgerMonth(now.getFullYear(), now.getMonth());
  if (!expense || !catTotals) { el.innerHTML = ''; return; }

  const topCats: [string, number][] = (Object.entries(catTotals) as [string, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!topCats.length) { el.innerHTML = ''; return; }

  const R = 40, cx = 50, cy = 50, sw = 13;
  const circ = 2 * Math.PI * R;
  let off = 0;
  const GAP = 1.5;
  const paths = topCats.map(([cat, amt]) => {
    const dash = (amt / expense) * circ;
    const seg = `<circle r="${R}" cx="${cx}" cy="${cy}" fill="none"
      stroke="${LEDGER_CAT_COLORS[cat] || '#64748b'}" stroke-width="${sw}"
      stroke-dasharray="${Math.max(0, dash - GAP)} ${circ - Math.max(0, dash - GAP)}"
      stroke-dashoffset="${circ - off}"
      stroke-linecap="butt"
      transform="rotate(-90 ${cx} ${cy})"/>`;
    off += dash;
    return seg;
  }).join('');

  const legend = topCats.map(([cat, amt]) => {
    const col = LEDGER_CAT_COLORS[cat] || '#64748b';
    const icon = CAT_ICONS[cat] || '📌';
    const pct = Math.round((amt / expense) * 100);
    return `<div class="hring-legend-row">
      <span class="hring-legend-dot" style="background:${col}"></span>
      <span class="hring-legend-icon">${icon}</span>
      <span class="hring-legend-cat">${escapeHtml(cat)}</span>
      <span class="hring-legend-bar-wrap"><span class="hring-legend-bar" style="width:${pct}%;background:${col}"></span></span>
      <span class="hring-legend-amt" style="color:${col}">${fmtShort(amt)}</span>
    </div>`;
  }).join('');

  const savingsRate = (() => {
    const { income } = getLedgerMonth(now.getFullYear(), now.getMonth());
    return income > 0 ? Math.round(((income - expense) / income) * 100) : null;
  })();

  el.innerHTML = `<div class="home-section-hdr">이달 카테고리</div><div class="card hring-card">
    <div class="hring-header">
      <span style="font-size:12px;font-weight:800;color:var(--text)">카테고리별 지출</span>
      ${savingsRate !== null ? `<span class="hring-sr-chip" style="color:${savingsRate >= 20 ? 'var(--green2)' : savingsRate >= 0 ? 'var(--yellow)' : 'var(--red2)'}">저축 ${savingsRate}%</span>` : ''}
    </div>
    <div class="hring-body">
      <div class="hring-donut-wrap">
        <svg viewBox="0 0 100 100" width="96" height="96">
          <circle r="${R}" cx="${cx}" cy="${cy}" fill="none" stroke="var(--bg4)" stroke-width="${sw}"/>
          ${paths}
        </svg>
        <div class="hring-donut-center">
          <div class="hring-donut-label">지출</div>
          <div class="hring-donut-amt">${fmtShort(expense)}</div>
        </div>
      </div>
      <div class="hring-legend">${legend}</div>
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════
// 스마트 카테고리 인사이트 배너
// ════════════════════════════════════════════════════════
function _renderCatInsightBanner() {
  const anchor = document.getElementById('home-cat-ring');
  if (!anchor) return;
  const now = today();
  const { catTotals: thisCat } = getLedgerMonth(now.getFullYear(), now.getMonth());
  const thisCatMap = (thisCat || {}) as Record<string, number>;

  const pastAvg: Record<string, number> = {};
  for (let m = 1; m <= 3; m++) {
    const pd = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const { catTotals: pc } = getLedgerMonth(pd.getFullYear(), pd.getMonth());
    Object.entries(pc || {}).forEach(([cat, amt]: [string, number]) => {
      pastAvg[cat] = (pastAvg[cat] || 0) + amt / 3;
    });
  }

  const spikes = (Object.entries(thisCatMap) as [string, number][])
    .filter(([cat, amt]) => {
      const avg = pastAvg[cat] || 0;
      return avg > 5000 && amt > avg * 1.25 && amt > 15000;
    })
    .map(([cat, amt]) => ({ cat, amt, avg: pastAvg[cat], ratio: amt / pastAvg[cat] }))
    .sort((a, b) => b.ratio - a.ratio).slice(0, 2);

  const existing = document.getElementById('home-cat-insight');
  if (!spikes.length) { existing?.remove(); return; }

  const rows = spikes.map(s => {
    const col = LEDGER_CAT_COLORS[s.cat] || '#f59e0b';
    const icon = CAT_ICONS[s.cat] || '📌';
    const pct = Math.round(((s.amt - s.avg) / s.avg) * 100);
    return `<div class="cat-insight-row">
      <span class="cat-insight-icon">${icon}</span>
      <div class="cat-insight-body">
        <div class="cat-insight-msg" style="color:${col}">${escapeHtml(s.cat)} 지출이 평소보다 <strong>+${pct}%</strong> 많아요</div>
        <div class="cat-insight-sub">이번달 ${fmtShort(s.amt)} · 3개월 평균 ${fmtShort(Math.round(s.avg))}</div>
      </div>
    </div>`;
  }).join('');

  const bannerHtml = `<div id="home-cat-insight" class="cat-insight-banner">
    <div class="cat-insight-title">💡 지출 패턴 알림</div>
    ${rows}
  </div>`;

  if (existing) { existing.outerHTML = bannerHtml; }
  else { anchor.insertAdjacentHTML('afterend', bannerHtml); }
}

// ════════════════════════════════════════════════════════
// 이번 주 가로 날짜 스트립 (뱅크샐러드 시그니처)
// ════════════════════════════════════════════════════════
export function renderWeekStrip() {
  const el = document.getElementById('home-week-strip');
  if (!el) return;
  const now = today();
  const dow = now.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + diffToMon + i);
    const dk = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const items = state.ledgerData?.[dk] || [];
    const exp = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
    const inc = items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
    const isToday = dk === dateKey(now);
    const isFuture = d > now;
    days.push({ d, dk, exp, inc, isToday, isFuture, dayName: dayNames[d.getDay()], dowIdx: d.getDay() });
  }

  el.innerHTML = `<div class="week-strip">
    ${days.map(day => {
      const isWeekend = day.dowIdx === 0 || day.dowIdx === 6;
      const hasTx = day.exp > 0 || day.inc > 0;
      return `<div class="week-strip-day ${day.isToday ? 'today' : ''} ${day.isFuture ? 'future' : ''}" data-dk="${day.dk}">
        <div class="week-strip-name" style="color:${isWeekend ? 'var(--accent2)' : ''}">${day.dayName}</div>
        <div class="week-strip-date ${day.isToday ? 'today' : ''}">${day.d.getDate()}</div>
        ${hasTx ? `<div class="week-strip-dots">
          ${day.exp > 0 ? '<span class="week-strip-dot exp"></span>' : ''}
          ${day.inc > 0 ? '<span class="week-strip-dot inc"></span>' : ''}
        </div>` : '<div class="week-strip-dots"></div>'}
        ${day.exp > 0 && !day.isFuture ? `<div class="week-strip-amt">${fmtShort(day.exp)}</div>` : '<div class="week-strip-amt"></div>'}
      </div>`;
    }).join('')}
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
    const now2 = today();
    const daysLeft = new Date(now2.getFullYear(), now2.getMonth() + 1, 0).getDate() - now2.getDate();
    let insightText = '';
    if (state.balance < state.dangerLine) {
      insightText = `⚠️ 잔고가 위험선 아래예요. ${daysLeft}일 남았어요.`;
    } else if (checkTotal > 0 && prevCheckTotal > 0) {
      const diff = checkTotal - prevCheckTotal;
      const diffPct = Math.round(Math.abs(diff) / prevCheckTotal * 100);
      if (diffPct >= 5) {
        insightText = diff < 0
          ? `📉 이번달 지출이 전월보다 ${diffPct}% 줄었어요!`
          : `📈 이번달 지출이 전월보다 ${diffPct}% 늘었어요.`;
      } else {
        insightText = net > 0 ? `✅ 이번달 현금흐름이 플러스예요.` : `⚡ 이번달 지출이 수입을 초과했어요.`;
      }
    } else {
      insightText = net > 0
        ? `✅ 월 순현금 플러스 흐름이에요.`
        : monthlyExpense > 0
          ? `⚡ 고정 지출 비중을 점검해보세요.`
          : `💡 가계부에 수입·지출을 기록해보세요.`;
    }
    insightEl.textContent = insightText;
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

  // 오늘 지출 chip 추가 + 무지출 축하
  const todayKey  = dateKey(today());
  const { expense: todayExp, income: todayInc } = getLedgerDay(todayKey);
  if (todayExp > 0 || todayInc > 0) {
    const todayChip = `<span class="info-chip" data-chip="today" style="cursor:pointer">💸 오늘 ${todayExp > 0 ? fmtShort(todayExp) + ' 지출' : '무지출'}${todayInc > 0 ? (todayExp > 0 ? ' / ' : '') + fmtShort(todayInc) + ' 수입' : ''}</span>`;
    if (chipsEl) chipsEl.innerHTML = todayChip + (chipsEl.innerHTML || '');
  } else {
    // 오늘 아무 기록 없음 = 무지출 가능성 → 자정이 넘은 경우만
    const h = today().getHours();
    if (h >= 6) {
      const noSpendChip = `<span class="info-chip success" data-chip="nospend" style="cursor:pointer">🎉 오늘 아직 무지출!</span>`;
      if (chipsEl) chipsEl.innerHTML = noSpendChip + (chipsEl.innerHTML || '');
    }
  }

  // 스마트 지출 인사이트 chip
  if (chipsEl && prevCheckTotal > 0 && checkTotal > 0) {
    const diff = checkTotal - prevCheckTotal;
    const diffPct = Math.round(Math.abs(diff) / prevCheckTotal * 100);
    if (diffPct >= 10) {
      const insightChip = diff < 0
        ? `<span class="info-chip success" data-chip="insight">📉 지출 ${diffPct}% 절약 중</span>`
        : `<span class="info-chip warning" data-chip="insight">📈 지출 전월비 +${diffPct}%</span>`;
      if (chipsEl) chipsEl.innerHTML += insightChip;
    }
  }

  const fillEl = document.getElementById('checkcard-budget-fill');
  if (fillEl && monthlyIncome > 0) {
    const spendable = Math.max(monthlyIncome - monthlyExpense, 1);
    const pct = Math.min(100, Math.round((checkTotal / spendable) * 100));
    fillEl.style.width = `${pct}%`;
    fillEl.style.background = pct >= 100 ? 'var(--red2)' : pct >= 80 ? 'var(--orange)' : 'var(--green2)';
  }

  // 히어로 카드 월 배지
  const heroMonthBadge = document.getElementById('hero-month-badge');
  if (heroMonthBadge) heroMonthBadge.textContent = `${today().getMonth() + 1}월`;

  renderWeekStrip();
  _renderSparkline();
  renderMonthProgress();
  _renderHeroMonthStats();
  _renderTodayTimeline();
  renderHomeCategoryRing();
  _renderCatInsightBanner();

  // FAB 펄스: 오늘 기록이 없을 때만 표시
  const fabBtn = document.getElementById('btn-fab-main');
  if (fabBtn) {
    const dk = dateKey(today());
    const hasTodayEntry = (state.ledgerData?.[dk] || []).length > 0;
    fabBtn.classList.toggle('pulse', !hasTodayEntry);
  }
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

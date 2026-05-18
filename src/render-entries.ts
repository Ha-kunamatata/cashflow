// @ts-nocheck
// ════════════════════════════════════════════════════════
// render-entries.ts — entries, cards, subscription radar
// ════════════════════════════════════════════════════════
import { CAT_COLORS } from './config';
import {
  today,
  yyyymm,
  fmtShort,
  fmtSigned,
  escapeHtml,
} from './utils';
import { state } from './state';
import { getCards } from './forecast';
import { renderHome } from './render-home';

let _entryFilter = '전체';
function setEntryFilterState(v) { _entryFilter = v; }
import { renderForecast, renderReport } from './render-report';
import { renderLedger } from './render-ledger';
import { renderGoals } from './render-goals';
import { renderAssets, renderWishlist, renderFinance } from './render-assets';

// ════════════════════════════════════════════════════════
// 수입/지출 목록
// ════════════════════════════════════════════════════════
export function setEntryFilter(filter, btn) {
  setEntryFilterState(filter);
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
      <div class="empty-state-icon">📋</div>
      <div class="empty-state-title">고정 항목 없음</div>
      <div class="empty-state-desc">월급·구독·보험 등 매달 반복되는<br>수입/지출을 여기에 등록하세요</div>
      <div class="empty-state-hint">+ 추가 버튼으로 시작하세요</div>
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
// 설정 통계
// ════════════════════════════════════════════════════════
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

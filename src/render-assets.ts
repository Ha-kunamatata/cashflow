// @ts-nocheck
// ════════════════════════════════════════════════════════
// render-assets.ts — 자산/예산/위시리스트/재테크 렌더링
// ════════════════════════════════════════════════════════
import { LEDGER_CAT_COLORS } from './config';
import { ASSET_TYPES, ASSET_PURPOSES, PURPOSE_COLORS, getTotalAssets, getUsableMoney, getAssetsByPurpose, HOUSE_LEVELS } from './assets';
import { BADGE_DEFS, RARITY_CONFIG } from './streak';
import { getMonthBudget, getMonthActual } from './budget';
import { today, fmtShort, fmtSigned, escapeHtml, p2 } from './utils';
import { state } from './state';
import { simulateWishPurchase } from './forecast';

const WISH_PRIORITY_LABELS = { must: '꼭 살 것', want: '사고 싶음', maybe: '고민 중' };
const WISH_PRIORITY_COLORS = { must: 'var(--red2)', want: 'var(--accent2)', maybe: 'var(--text3)' };
let _wishFilter = '전체';
let _wishSelectedIds = new Set();

let _financeData = {};
let _financeLoading = {};
let _lastRefreshTime = 0;

export function setFinanceData(symbol, data) {
  _financeData[symbol] = data;
}

export function setWishFilter(filter) {
  _wishFilter = filter;
  _wishSelectedIds.clear();
  renderWishlist();
}

function _updateWishSelectBar() {
  const bar = document.getElementById('wish-multiselect-bar');
  if (!bar) return;
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

export function renderAssets() {
  const container = document.getElementById('assets-page-content');
  if (!container) return;

  const assets = state.assets || [];
  const total = getTotalAssets(assets);
  const usable = getUsableMoney(assets);
  const byPurpose = getAssetsByPurpose(assets);

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
      ${assets.length === 0 ? `<div class="empty-state">
        <div class="empty-state-icon">🏦</div>
        <div class="empty-state-title">자산 없음</div>
        <div class="empty-state-desc">예금·투자·부동산 등 자산을 등록하면<br>순자산과 집 레벨을 추적할 수 있어요</div>
        <div class="empty-state-hint">+ 자산 추가 버튼을 탭하세요</div>
      </div>` : `<div class="assets-list">${assetItems}</div>`}
    </div>

    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div class="card-title" style="margin:0">🏅 배지 컬렉션</div>
        <div style="font-size:11px;color:var(--text3)">${(state.badges||[]).length} / ${BADGE_DEFS.length} 획득</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px" id="badge-cat-filters">
        ${['전체','기록','자산','절약','부채','목표','레벨','시작','특별','투자','성취','도전'].map(cat =>
          `<button class="badge-filter-btn${cat==='전체'?' active':''}" data-cat="${cat}" style="padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700;border:1px solid var(--border);background:${cat==='전체'?'var(--accent)':'var(--bg3)'};color:${cat==='전체'?'#fff':'var(--text2)'};cursor:pointer">${cat}</button>`
        ).join('')}
      </div>
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

  const allCats = new Set([...Object.keys(budget), ...Object.keys(actual)]);
  const totalBudget = Object.values(budget).reduce((s, v) => s + v, 0);
  const totalActual = Object.values(actual).reduce((s, v) => s + v, 0);
  const totalPct = totalBudget > 0 ? Math.min(100, Math.round((totalActual / totalBudget) * 100)) : 0;

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

export function renderWishlist() {
  const wishlist = state.wishlist || [];
  const summaryBar = document.getElementById('wish-summary-bar');
  const summaryInner = document.getElementById('wish-summary-inner');
  const container = document.getElementById('wish-list');
  if (!container) return;

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

    return `
      <div class="wish-card ${w.bought ? 'bought' : ''}" data-id="${escapeHtml(w.id)}" data-idx="${idx}" draggable="true">
        <div class="wish-card-top">
          <div class="wish-drag-handle" data-id="${escapeHtml(w.id)}" title="드래그하여 순서 변경">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" opacity="0.4"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>
          </div>
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

  _updateWishSelectBar();
}

export function renderFinance() {
  const watchlist = state.watchlist || [];
  const container = document.getElementById('watchlist-container');
  if (!container) return;

  if (!watchlist.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📈</div>
      <div class="empty-state-title">관심종목 없음</div>
      <div class="empty-state-desc">주식·ETF·암호화폐를 추가하면<br>실시간 시세와 수익률을 추적합니다</div>
      <div class="empty-state-hint">우측 상단 + 추가 버튼을 탭하세요</div>
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

export async function fetchStockPrice(item) {
  const { symbol, market } = item;
  let ticker = symbol;
  if (market === 'KRX') {
    ticker = symbol.includes('.') ? symbol : `${symbol}.KS`;
  } else if (market === 'CRYPTO') {
    ticker = symbol.includes('-') ? symbol : `${symbol}-USD`;
  }

  _financeLoading[symbol] = true;

  const CORS_PROXIES = [
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];

  const _yahooFetch = async (yahooUrl) => {
    for (let i = 0; i < CORS_PROXIES.length; i++) {
      try {
        const proxyUrl = CORS_PROXIES[i](yahooUrl);
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error('proxy error');
        if (i === 1) {
          const wrapper = await res.json();
          return JSON.parse(wrapper.contents);
        } else {
          return await res.json();
        }
      } catch (err) {
        if (i === CORS_PROXIES.length - 1) throw err;
      }
    }
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
      price, change, changePct,
      name: item.name || meta.shortName || symbol,
      currency: meta.currency || 'USD',
      lastUpdated: new Date().toLocaleTimeString('ko-KR'),
    };
  } catch (e) {
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
      _financeData[symbol] = null;
    }
  } finally {
    _financeLoading[symbol] = false;
  }
}

export async function refreshAllStocks() {
  const watchlist = state.watchlist || [];
  if (!watchlist.length) return;

  const now = Date.now();
  if (now - _lastRefreshTime < 30000) return;
  _lastRefreshTime = now;

  const infoEl = document.getElementById('finance-refresh-info');
  if (infoEl) infoEl.textContent = '새로고침 중...';

  await Promise.allSettled(watchlist.map(item => fetchStockPrice(item)));
  renderFinance();

  if (infoEl) infoEl.textContent = `마지막 갱신: ${new Date().toLocaleTimeString('ko-KR')}`;
}

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

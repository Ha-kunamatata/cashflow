// ════════════════════════════════════════════════════════
// ui.ts — 폼 / 시트 / 네비게이션 / 인터랙션
// ════════════════════════════════════════════════════════
// @ts-nocheck
import { INCOME_CATS, EXPENSE_CATS, LEDGER_CATEGORIES, LEDGER_INCOME_CATEGORIES, LEDGER_CAT_COLORS, CAT_ICONS } from './config';
import { uid, today, dateKey, fmtFull, fmtShort, fmtSigned, escapeHtml, showBadge, openSheet, closeSheet } from './utils';
import { publishSharedGoal, fetchSharedGoalByCode, createHousehold, joinHousehold, leaveHousehold, getCurrentHouseholdCode } from './firebase';
import { state, save, syncLedgerToBalance, DEFAULT_CARDS } from './state';
import * as renderModule from './render';
import { getGeminiKey, setGeminiKey, hasGeminiKey, getHomeInsight, getLedgerAnalysis, chatWithAI, renderMarkdown } from './ai';
import { ASSET_TYPES, ASSET_PURPOSES, PURPOSE_COLORS } from './assets';
import { setMonthBudget, getMonthBudget } from './budget';
import { computeStreak, checkBadges, BADGE_DEFS } from './streak';

// ── 목표 관련 ────────────────────────────────────────────
let _editGoalId = null;

export function openGoalForm(id) {
  _editGoalId = id || null;
  const g = id ? (state.goals || []).find((x) => x.id === id) : null;

  document.getElementById('goal-sheet-title').textContent = g ? '목표 수정' : '목표 추가';
  document.getElementById('goal-emoji').value = g?.emoji || '';
  document.getElementById('goal-name').value = g?.name || '';
  document.getElementById('goal-target').value = g?.targetAmount || '';
  document.getElementById('goal-date').value = g?.targetDate || '';
  document.getElementById('goal-saved').value = g?.savedAmount || '';

  openSheet('goal-sheet');
  setTimeout(() => document.getElementById('goal-name')?.focus(), 80);
}

export function saveGoal() {
  const emoji = document.getElementById('goal-emoji').value.trim() || '🎯';
  const name = document.getElementById('goal-name').value.trim();
  const targetAmount = Number(document.getElementById('goal-target').value) || 0;
  const targetDate = document.getElementById('goal-date').value.trim();
  const savedAmount = Number(document.getElementById('goal-saved').value) || 0;

  if (!name) { alert('목표명을 입력하세요'); return; }
  if (!targetAmount) { alert('목표 금액을 입력하세요'); return; }

  if (!state.goals) state.goals = [];

  const goal = { id: _editGoalId || uid(), emoji, name, targetAmount, targetDate, savedAmount };

  if (_editGoalId) {
    state.goals = state.goals.map((g) => (g.id === _editGoalId ? goal : g));
  } else {
    state.goals.push(goal);
  }

  save();
  closeSheet('goal-sheet');
  renderModule.renderGoals();
  showBadge('✅ 목표 저장됨');
}

export function deleteGoal(id) {
  if (!confirm('목표를 삭제할까요?')) return;
  state.goals = (state.goals || []).filter((g) => g.id !== id);
  save();
  renderModule.renderGoals();
  showBadge('🗑️ 목표 삭제됨');
}

// ── 네비게이션 ─────────────────────────────────────────
const PAGE_MAP = {
  home: 'page-home',
  assets: 'page-assets',
  forecast: 'page-forecast',
  entries: 'page-entries',
  ledger: 'page-ledger',
  report: 'page-report',
  goals: 'page-goals',
  wishlist: 'page-wishlist',
  finance: 'page-finance',
  view: 'page-view',
  settings: 'page-settings',
};
// 바텀 탭 순서 (슬라이드 방향 결정용)
const NAV_ORDER = ['home','assets','ledger','entries','goals','wishlist','finance','report'];
let _curNavPage = 'home';

export function navigate(page, btn) {
  const prevIdx = NAV_ORDER.indexOf(_curNavPage);
  const nextIdx = NAV_ORDER.indexOf(page);
  _curNavPage = page;

  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active', 'nav-right', 'nav-left'));
  const nextEl = document.getElementById(PAGE_MAP[page]);
  if (nextEl) {
    nextEl.classList.add('active');
    if (prevIdx >= 0 && nextIdx >= 0 && prevIdx !== nextIdx) {
      const cls = nextIdx > prevIdx ? 'nav-right' : 'nav-left';
      nextEl.classList.add(cls);
      nextEl.addEventListener('animationend', () => nextEl.classList.remove(cls), { once: true });
    }
  }

  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  if (btn) {
    btn.classList.add('active');
  } else {
    const idx = Object.keys(PAGE_MAP).indexOf(page);
    document.querySelectorAll('.nav-btn')[idx]?.classList.add('active');
  }

  if (page === 'forecast') renderModule.renderForecast();
  if (page === 'ledger') renderModule.renderLedger();
  if (page === 'report') renderModule.renderReport();
  if (page === 'goals') renderModule.renderGoals();
  if (page === 'assets') renderModule.renderAssets();
  if (page === 'wishlist') renderModule.renderWishlist();
  if (page === 'finance') {
    renderModule.renderFinance();
    // 탭 진입 시 자동 새로고침
    renderModule.refreshAllStocks();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── 테마 ───────────────────────────────────────────────
export function applyTheme() {
  document.body.classList.toggle('light-theme', (state.theme || 'dark') === 'light');

  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.textContent = state.theme === 'light' ? '라이트 모드' : '다크 모드';
  }
}

export function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  save();
  showBadge(state.theme === 'light' ? '☀️ 라이트 모드' : '🌙 다크 모드');
}

// ── 잔고 시트 ──────────────────────────────────────────
export function openBalanceSheet() {
  const cur = document.getElementById('balance-sheet-current');
  const inp = document.getElementById('balance-sheet-input');

  if (cur) cur.textContent = fmtFull(state.balance);
  if (inp) inp.value = state.balance || '';

  openSheet('balance-sheet');
  setTimeout(() => inp?.focus(), 80);
}

export function submitBalanceSheet() {
  state.balance = Number(document.getElementById('balance-sheet-input')?.value) || 0;

  save();
  renderModule.renderHome();

  if (document.getElementById('page-forecast')?.classList.contains('active')) {
    renderModule.renderForecast();
  }

  closeSheet('balance-sheet');
  showBadge('✅ 잔고가 수정됐어요');
}

// ── 프로필 시트 ────────────────────────────────────────
export function openProfileSheet() {
  const user = window.currentUser;
  const avatar = document.getElementById('profile-sheet-avatar');
  const name = document.getElementById('profile-sheet-name');
  const email = document.getElementById('profile-sheet-email');

  if (name) name.textContent = user?.displayName || '사용자';
  if (email) email.textContent = user?.email || '-';

  if (avatar) {
    avatar.innerHTML = user?.photoURL
      ? `<img src="${user.photoURL}" referrerpolicy="no-referrer">`
      : (user?.displayName || user?.email || '?')[0].toUpperCase();
  }

  openSheet('profile-sheet');
}

export function confirmSignOut() {
  closeSheet('profile-sheet');
  openSheet('signout-sheet');
}

// ── 위험선 ─────────────────────────────────────────────
export function onDangerLineChange() {
  state.dangerLine = Number(document.getElementById('danger-line-input')?.value) || 0;

  const settingDanger = document.getElementById('setting-danger');
  if (settingDanger) settingDanger.value = state.dangerLine;

  save();
  renderModule.renderHome();

  if (document.getElementById('page-forecast')?.classList.contains('active')) {
    renderModule.renderForecast();
  }
}

export function saveSetting(key, val) {
  if (key === 'dangerLine') {
    state.dangerLine = Number(val) || 0;

    const dangerInput = document.getElementById('danger-line-input');
    if (dangerInput) dangerInput.value = state.dangerLine;

    save();
    renderModule.renderHome();
  }
}

// ── 항목 폼 ────────────────────────────────────────────
export function showForm(entry) {
  document.getElementById('form-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';

  state.editId = entry ? entry.id : null;
  state.formType = entry ? entry.type : 'income';

  updateTypeButtons(state.formType);

  document.getElementById('form-sheet-title').textContent = entry ? '항목 수정' : '항목 추가';
  document.getElementById('f-name').value = entry?.name || '';
  document.getElementById('f-amount').value = entry?.amount || '';
  document.getElementById('f-repeat').value = entry?.repeat || '매월';
  document.getElementById('f-day').value = entry?.day || '';
  document.getElementById('f-endmonth').value = entry?.endMonth || '';
  document.getElementById('f-date').value = entry?.date || '';
  document.getElementById('form-save-btn').textContent = entry ? '수정 완료' : '추가';

  // 카드 드롭다운 동적 생성
  const cards = (state.cards && state.cards.length > 0) ? state.cards : DEFAULT_CARDS;
  const cardSel = document.getElementById('f-card');
  if (cardSel) {
    cardSel.innerHTML = '<option value="">없음</option>' +
      cards.map(c => `<option value="${c.id}">${c.name} (${c.payDay}일)</option>`).join('');
    cardSel.value = entry?.card || '';
  }

  updateCatOptions(state.formType, entry?.category);
  onRepeatChange();
}

export function hideForm() {
  document.getElementById('form-overlay').style.display = 'none';
  document.body.style.overflow = '';
  state.editId = null;
}

export function closeFormIfOutside(e) {
  if (e.target === document.getElementById('form-overlay')) {
    hideForm();
  }
}

export function setFormType(type) {
  state.formType = type;
  updateTypeButtons(type);
  updateCatOptions(type);
}

function updateTypeButtons(type) {
  document.getElementById('type-income-btn').className = `type-btn ${type === 'income' ? 'income-active' : 'inactive'}`;
  document.getElementById('type-expense-btn').className = `type-btn ${type === 'expense' ? 'expense-active' : 'inactive'}`;
}

const FORM_CAT_ICONS = {
  '월급':'💰','수당':'💼','기타수입':'📦',
  '카드':'💳','할부':'📅','공과금':'💡','보험':'🛡️','기타지출':'📦',
};
function updateCatOptions(type, selected) {
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const first = selected || cats[0];
  // hidden input 값 초기화
  const hiddenInput = document.getElementById('f-category') as HTMLInputElement;
  if (hiddenInput) hiddenInput.value = first;

  const grid = document.getElementById('f-cat-grid');
  if (!grid) return;
  grid.innerHTML = cats.map(c => {
    const icon = FORM_CAT_ICONS[c] || '📦';
    const isSel = c === first;
    return `<button type="button" class="form-cat-chip${isSel ? ' selected' : ''}" data-cat="${c}">
      <span>${icon}</span><span>${c}</span>
    </button>`;
  }).join('');

  grid.querySelectorAll('.form-cat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.form-cat-chip').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (hiddenInput) hiddenInput.value = (btn as HTMLElement).dataset.cat || '';
    });
  });
}

export function onRepeatChange() {
  const rep = document.getElementById('f-repeat').value;

  document.getElementById('day-label').textContent =
    rep === '1회성' ? '기준일' : rep === '격주' ? '시작일' : '기준일 (매월 며칠)';

  document.getElementById('date-wrap').style.display = rep !== '매월' ? 'block' : 'none';
}

export function saveEntry() {
  const name = document.getElementById('f-name').value.trim();
  const amount = Number(document.getElementById('f-amount').value);

  if (!name || !amount) {
    alert('항목명과 금액을 입력해주세요');
    return;
  }

  const entry = {
    id: state.editId || uid(),
    type: state.formType,
    name,
    amount,
    category: document.getElementById('f-category').value,
    repeat: document.getElementById('f-repeat').value,
    day: parseInt(document.getElementById('f-day').value, 10) || null,
    card: document.getElementById('f-card').value,
    endMonth: document.getElementById('f-endmonth').value.trim() || null,
    date: document.getElementById('f-date').value || null,
  };

  if (state.editId) {
    state.entries = state.entries.map((e) => (e.id === state.editId ? entry : e));
  } else {
    state.entries.push(entry);
  }

  hideForm();
  save();
  renderModule.renderAll();
  showBadge('✅ 저장됨');
}

export function editEntry(id) {
  const entry = state.entries.find((x) => x.id === id);
  if (entry) showForm(entry);
}

export function deleteEntry(id) {
  if (!confirm('삭제할까요?')) return;

  state.entries = state.entries.filter((e) => e.id !== id);
  save();
  renderModule.renderAll();
}

// ── 카드 데이터 ────────────────────────────────────────
export function updateCardData(ym, card, val) {
  if (!state.cardData[ym]) state.cardData[ym] = {};
  state.cardData[ym][card] = Number(val) || 0;

  save();
  renderModule.renderHome();

  if (document.getElementById('page-forecast')?.classList.contains('active')) {
    renderModule.renderForecast();
  }
}

// ── 가계부 ─────────────────────────────────────────────
let _ledgerDayDate   = null; // 현재 열려있는 날짜 시트의 날짜
let _ledgerItemDate  = null; // 항목 폼의 대상 날짜
let _ledgerItemId    = null; // 수정 중인 항목 id (null이면 신규)
let _ledgerItemType  = 'expense';
let _ledgerCatGroup  = Object.keys(LEDGER_CATEGORIES)[0];
let _ledgerCategory  = LEDGER_CATEGORIES[Object.keys(LEDGER_CATEGORIES)[0]][0];
let _ledgerItemTag   = null; // 소비 유형 태그
let _calcAmountStr   = '';   // 계산기 입력 문자열


// 날짜 셀 클릭 → 날짜 시트 열기
export function openLedgerDaySheet(dateStr) {
  _ledgerDayDate = dateStr;
  renderModule.setSelectedLedgerDate(dateStr);
  renderModule.renderLedger();
  _renderDaySheet();
  openSheet('ledger-day-sheet');
}

export function closeLedgerDaySheet() {
  _ledgerDayDate = null;
  renderModule.setSelectedLedgerDate(null);
  renderModule.renderLedger();
  closeSheet('ledger-day-sheet');
}

function _renderDaySheet() {
  const dateStr = _ledgerDayDate;
  if (!dateStr) return;

  const d = new Date(dateStr);
  const items   = state.ledgerData?.[dateStr] || [];
  const expense = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
  const income  = items.filter(i => i.type === 'income' ).reduce((s, i) => s + i.amount, 0);
  const net     = income - expense;

  const title = document.getElementById('ledger-day-sheet-date');
  if (title) title.textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;

  const summary = document.getElementById('ledger-day-sheet-summary');
  if (summary) {
    summary.innerHTML = `
      <div class="lday-summary-item"><span class="lday-lbl">지출</span><span class="lday-val red">${fmtShort(expense)}</span></div>
      <div class="lday-summary-item"><span class="lday-lbl">수입</span><span class="lday-val green">${fmtShort(income)}</span></div>
      <div class="lday-summary-item"><span class="lday-lbl">순액</span><span class="lday-val" style="color:${net>=0?'var(--green2)':'var(--red2)'}">${fmtSigned(net)}</span></div>
    `;
  }

  const list = document.getElementById('ledger-day-items-list');
  if (!list) return;

  if (items.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:28px 0;font-size:13px">기록 없음. + 추가 버튼으로 입력하세요</div>';
    return;
  }

  const TAG_EMOJI: Record<string, string> = { '충동': '💸', '계획': '📋', '필수': '✅', '외식': '🍽️', '선물': '🎁' };
  list.innerHTML = items.map(item => {
    const col  = LEDGER_CAT_COLORS[item.category] || '#64748b';
    const icon = CAT_ICONS[item.category] || (item.type === 'income' ? '💰' : '📦');
    const sign = item.type === 'expense' ? '-' : '+';
    const amtCls = item.type === 'expense' ? 'red' : 'green';
    return `
      <div class="lday-card" data-id="${item.id}">
        <div class="lday-card-icon-wrap" style="background:${col}15;border-color:${col}35;color:${col}">
          ${icon}
        </div>
        <div class="lday-card-body">
          <div class="lday-card-name">${escapeHtml(item.memo || item.category)}</div>
          <div class="lday-card-meta">
            <span>${escapeHtml(item.category)}</span>
            ${item.tag ? `<span class="lday-card-tag">${TAG_EMOJI[item.tag] || ''}${escapeHtml(item.tag)}</span>` : ''}
          </div>
        </div>
        <div class="lday-card-right">
          <span class="lday-card-amount ${amtCls}">${sign}${fmtShort(item.amount)}</span>
          <div class="lday-card-actions">
            <button class="lday-card-action-btn lday-edit-btn" data-id="${item.id}">수정</button>
            <button class="lday-card-action-btn del lday-del-btn" data-id="${item.id}">삭제</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// 항목 추가/수정 폼 열기
export function openLedgerItemForm(dateStr, itemId) {
  _ledgerItemDate = dateStr || _ledgerDayDate;
  _ledgerItemId   = itemId || null;

  const existing = itemId
    ? (state.ledgerData?.[_ledgerItemDate] || []).find(i => i.id === itemId)
    : null;

  _ledgerItemType  = existing?.type     || 'expense';
  _ledgerCategory  = existing?.category || LEDGER_CATEGORIES[_ledgerCatGroup]?.[0] || '기타';
  if (existing) {
    for (const [grp, cats] of Object.entries(LEDGER_CATEGORIES)) {
      if (cats.includes(_ledgerCategory)) { _ledgerCatGroup = grp; break; }
    }
  } else {
    const recentCats = _getRecentCats();
    if (recentCats.length) {
      _ledgerCatGroup = _RECENT_GROUP;
      _ledgerCategory = recentCats[0];
    }
  }

  // 계산기 금액 초기화
  _calcAmountStr = existing?.amount ? String(existing.amount) : '';
  _updateCalcDisplay();

  const titleEl = document.getElementById('ledger-item-sheet-title');
  if (titleEl) {
    const d = new Date(_ledgerItemDate);
    titleEl.textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${existing ? '수정' : ''}`;
  }

  const memoEl = document.getElementById('ledger-item-memo') as HTMLInputElement;
  if (memoEl) memoEl.value = existing?.memo || '';

  _ledgerItemTag = existing?.tag || null;
  _renderTagButtons();
  _renderItemFormType();
  renderLedgerTemplates();
  openSheet('ledger-item-sheet');
}

export function closeLedgerItemForm() {
  _calcAmountStr = '';
  closeSheet('ledger-item-sheet');
}

export function setLedgerItemType(type) {
  _ledgerItemType = type;
  if (type === 'expense') {
    const cats = LEDGER_CATEGORIES[_ledgerCatGroup];
    _ledgerCategory = cats?.includes(_ledgerCategory) ? _ledgerCategory : cats?.[0] || '기타';
  } else {
    _ledgerCategory = LEDGER_INCOME_CATEGORIES.includes(_ledgerCategory) ? _ledgerCategory : LEDGER_INCOME_CATEGORIES[0];
  }
  _renderItemFormType();
}

export function getCatIcon(cat: string): string {
  return CAT_ICONS[cat] || '📌';
}

export function selectLedgerCatGroup(groupName) {
  _ledgerCatGroup = groupName;
  if (groupName === _RECENT_GROUP) {
    _ledgerCategory = _getRecentCats()[0] || '기타';
  } else {
    _ledgerCategory = LEDGER_CATEGORIES[groupName]?.[0] || '기타';
  }
  _renderCatChips();
  _renderCatGroupTabs();
}

export function selectLedgerCat(catName) {
  _ledgerCategory = catName;
  _renderCatChips();
}

function _updateCalcDisplay() {
  const el = document.getElementById('calc-display-value');
  const wrap = document.getElementById('calc-amount-display');
  if (!el) return;
  const num = parseInt(_calcAmountStr || '0', 10);
  el.textContent = num.toLocaleString('ko-KR');
  if (wrap) {
    wrap.className = `calc-amount-display ${_ledgerItemType === 'expense' ? 'expense' : 'income'}`;
  }
}

function _handleCalcKey(key: string) {
  if (key === 'save') {
    if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
    saveLedgerItem();
    return;
  }
  if (key === 'del' || key === 'clear') {
    if (navigator.vibrate) navigator.vibrate(15);
    if (key === 'del') _calcAmountStr = _calcAmountStr.slice(0, -1);
    else _calcAmountStr = '';
  } else if (key === '00') {
    if (_calcAmountStr) { _calcAmountStr += '00'; if (navigator.vibrate) navigator.vibrate(8); }
  } else {
    if (_calcAmountStr.length >= 10) return;
    if (_calcAmountStr === '0') _calcAmountStr = key;
    else _calcAmountStr += key;
    if (navigator.vibrate) navigator.vibrate(8);
  }
  _updateCalcDisplay();
}

// 계산기 키패드 이벤트 위임 설정 (한 번만)
let _calcKeypadReady = false;
function _setupCalcKeypad() {
  if (_calcKeypadReady) return;
  _calcKeypadReady = true;
  const sheet = document.getElementById('ledger-item-sheet');
  sheet?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-key]') as HTMLElement;
    if (!btn) return;
    const key = btn.dataset.key;
    if (key) _handleCalcKey(key);
  });
  sheet?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-quick]') as HTMLElement;
    if (!btn) return;
    const add = parseInt(btn.dataset.quick || '0', 10);
    if (!add) return;
    const cur = parseInt(_calcAmountStr || '0', 10) || 0;
    _calcAmountStr = String(cur + add);
    if (navigator.vibrate) navigator.vibrate(8);
    _updateCalcDisplay();
  });
}

function _renderItemFormType() {
  const expBtn = document.getElementById('ledger-type-expense');
  const incBtn = document.getElementById('ledger-type-income');
  if (expBtn) expBtn.className = `calc-type-btn ${_ledgerItemType === 'expense' ? 'expense-active' : ''}`;
  if (incBtn) incBtn.className = `calc-type-btn ${_ledgerItemType === 'income' ? 'income-active' : ''}`;

  _updateCalcDisplay();
  _renderCatGroupTabs();
  _renderCatChips();
  _setupCalcKeypad();
}

const _RECENT_CATS_KEY = 'recentCats';
const _RECENT_CATS_MAX = 8;

function _getRecentCats(): string[] {
  try { return JSON.parse(localStorage.getItem(_RECENT_CATS_KEY) || '[]'); } catch { return []; }
}
function _pushRecentCat(cat: string) {
  const arr = _getRecentCats().filter(c => c !== cat);
  arr.unshift(cat);
  localStorage.setItem(_RECENT_CATS_KEY, JSON.stringify(arr.slice(0, _RECENT_CATS_MAX)));
}

const _RECENT_GROUP = '최근';

function _renderCatGroupTabs() {
  const el = document.getElementById('ledger-cat-groups');
  if (!el) return;
  if (_ledgerItemType === 'income') { el.innerHTML = ''; return; }
  const recentCats = _getRecentCats();
  const groups = recentCats.length
    ? [_RECENT_GROUP, ...Object.keys(LEDGER_CATEGORIES)]
    : Object.keys(LEDGER_CATEGORIES);
  el.innerHTML = groups.map(grp => `
    <button class="calc-cat-group-tab${grp === _ledgerCatGroup ? ' active' : ''}" data-group="${escapeHtml(grp)}">${grp}</button>
  `).join('');
}

function _renderCatChips() {
  const el = document.getElementById('ledger-cat-chips');
  if (!el) return;
  let cats: string[];
  if (_ledgerItemType === 'income') {
    cats = LEDGER_INCOME_CATEGORIES;
  } else if (_ledgerCatGroup === _RECENT_GROUP) {
    cats = _getRecentCats();
  } else {
    cats = LEDGER_CATEGORIES[_ledgerCatGroup] || [];
  }

  el.className = 'calc-cat-grid';
  el.innerHTML = cats.map(cat => {
    const col = LEDGER_CAT_COLORS[cat] || '#64748b';
    const icon = CAT_ICONS[cat] || '📌';
    const sel = cat === _ledgerCategory;
    return `
      <button class="calc-cat-item${sel ? ' active' : ''}" data-cat="${escapeHtml(cat)}"
        style="--item-color:${col}">
        <span class="calc-cat-icon">${icon}</span>
        <span class="calc-cat-name">${escapeHtml(cat)}</span>
      </button>`;
  }).join('');
}

export function selectLedgerTag(tag) {
  _ledgerItemTag = _ledgerItemTag === tag ? null : tag;
  _renderTagButtons();
}

function _renderTagButtons() {
  const row = document.getElementById('ledger-tag-row');
  if (!row) return;
  row.querySelectorAll('.ledger-tag-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tag === _ledgerItemTag);
  });
}

export function saveLedgerItem() {
  const amt  = parseInt(_calcAmountStr || '0', 10) || Number((document.getElementById('ledger-item-amount') as HTMLInputElement)?.value) || 0;
  const memo = (document.getElementById('ledger-item-memo') as HTMLInputElement)?.value.trim() || '';

  if (!amt) {
    // 금액 없으면 표시 흔들기
    const disp = document.getElementById('calc-amount-display');
    if (disp) { disp.style.animation = 'none'; disp.offsetHeight; disp.style.animation = 'shake 0.3s ease'; }
    return;
  }
  if (!_ledgerItemDate) return;

  if (!state.ledgerData) state.ledgerData = {};
  if (!state.ledgerData[_ledgerItemDate]) state.ledgerData[_ledgerItemDate] = [];

  const item = {
    id:       _ledgerItemId || uid(),
    type:     _ledgerItemType,
    category: _ledgerCategory,
    amount:   amt,
    memo,
    ..._ledgerItemTag ? { tag: _ledgerItemTag } : {},
  };

  if (_ledgerItemId) {
    state.ledgerData[_ledgerItemDate] = state.ledgerData[_ledgerItemDate].map(i =>
      i.id === _ledgerItemId ? item : i
    );
  } else {
    state.ledgerData[_ledgerItemDate].push(item);
  }

  if (item.type === 'expense') _pushRecentCat(item.category);

  syncLedgerToBalance();
  save();

  closeLedgerItemForm();
  // 날짜 시트 갱신
  if (_ledgerDayDate === _ledgerItemDate) _renderDaySheet();
  renderModule.renderLedger();
  renderModule.renderHome();
  showBadge('✅ 가계부 저장됨');
}

export function deleteLedgerItem(dateStr, itemId) {
  if (!confirm('항목을 삭제할까요?')) return;
  if (!state.ledgerData?.[dateStr]) return;

  state.ledgerData[dateStr] = state.ledgerData[dateStr].filter(i => i.id !== itemId);
  if (state.ledgerData[dateStr].length === 0) delete state.ledgerData[dateStr];

  syncLedgerToBalance();
  save();

  _renderDaySheet();
  renderModule.renderLedger();
  renderModule.renderHome();
  showBadge('🗑️ 항목 삭제됨');
}

// 날짜 시트에서 항목 삭제 (현재 열려있는 날짜 기준)
export function deleteLedgerCurrentDayItem(itemId) {
  if (!_ledgerDayDate) return;
  deleteLedgerItem(_ledgerDayDate, itemId);
}

// 구버전 호환 alias (app.js에서 직접 참조할 경우)
export const openLedgerEditor     = openLedgerDaySheet;
export const closeLedgerEditor    = closeLedgerDaySheet;
export const saveLedgerExpense    = () => {};
export const clearLedgerExpense   = () => {};

// ── 데이터 관리 ────────────────────────────────────────
export function exportData() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  );
  a.download = `cashflow_${dateKey(today())}.json`;
  a.click();
}

export function importDataClick() {
  document.getElementById('import-file').click();
}

export function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (typeof imported !== 'object' || imported === null || Array.isArray(imported)) {
        throw new Error('invalid');
      }
      if (!Array.isArray(imported.entries)) imported.entries = [];
      if (typeof imported.cardData !== 'object' || imported.cardData === null) imported.cardData = {};
      if (typeof imported.checkData !== 'object' || imported.checkData === null) imported.checkData = {};
      if (typeof imported.ledgerData !== 'object' || imported.ledgerData === null) imported.ledgerData = {};
      if (typeof imported.balance !== 'number') delete imported.balance;
      if (!Array.isArray(imported.assets)) imported.assets = [];
      if (typeof imported.budgets !== 'object' || imported.budgets === null || Array.isArray(imported.budgets)) imported.budgets = {};
      if (!Array.isArray(imported.badges)) imported.badges = [];
      if (typeof imported.streak !== 'object' || imported.streak === null || Array.isArray(imported.streak)) imported.streak = { count: 0, lastDate: '' };
      Object.assign(state, imported);
      save();
      renderModule.renderAll();
      showBadge('✅ 가져오기 완료');
    } catch (err) {
      alert('파일 형식 오류');
    }
  };

  reader.readAsText(file);
}

export function resetAll() {
  state.entries = [];
  state.cardData = {};
  state.checkData = {};
  state.ledgerData = {};
  state.appliedCheckData = {};
  state.balance = 0;
  state.assets = [];
  state.budgets = {};
  state.badges = [];
  state.streak = { count: 0, lastDate: '' };

  save();
  applyTheme();
  renderModule.renderAll();
}

// ════════════════════════════════════════════════════════
// AI 기능
// ════════════════════════════════════════════════════════

// ── Gemini API 키 설정 ────────────────────────────────
export function initGeminiKeyUI() {
  const input = document.getElementById('gemini-api-key-input');
  const status = document.getElementById('gemini-key-status');
  const fab = document.getElementById('btn-ai-chat-fab');
  const insightCard = document.getElementById('ai-insight-card');

  if (input) {
    const stored = getGeminiKey();
    input.value = stored ? '••••••••••••••••••••' : '';
    if (status) status.textContent = stored ? '✅ API 키가 저장되어 있습니다' : '키를 입력하면 AI 기능이 활성화됩니다';
  }

  // AI insight card & FAB are always visible
  if (fab) fab.style.display = 'flex';
  if (insightCard) insightCard.style.display = 'block';

  // If no key, show setup message in insight card
  if (!hasGeminiKey()) {
    const content = document.getElementById('ai-insight-content');
    if (content) {
      content.innerHTML = `🤖 AI 인사이트를 사용하려면 설정 탭에서 Gemini API 키를 입력하세요. (무료) <button class="btn btn-ghost" onclick="import('./ui').then(m=>m.navigate('settings'))" style="font-size:11px;padding:3px 8px;margin-left:4px"><div class="ripple-container"></div>설정으로 →</button>`;
    }
  }
}

export function saveGeminiKey() {
  const input = document.getElementById('gemini-api-key-input');
  const status = document.getElementById('gemini-key-status');
  const val = input?.value?.trim() || '';

  // 마스킹된 값은 그대로 유지
  if (val === '••••••••••••••••••••') { showBadge('ℹ️ 변경사항 없음'); return; }

  setGeminiKey(val);
  // 크로스 디바이스 동기화: state에도 저장
  state.geminiKey = val;
  save();
  const hasKey = hasGeminiKey();

  // FAB and insight card always visible
  const fab = document.getElementById('btn-ai-chat-fab');
  const insightCard = document.getElementById('ai-insight-card');
  if (fab) fab.style.display = 'flex';
  if (insightCard) insightCard.style.display = 'block';

  if (input) input.value = hasKey ? '••••••••••••••••••••' : '';
  if (status) status.textContent = hasKey ? '✅ API 키가 저장되었습니다' : 'API 키가 삭제되었습니다';
  showBadge(hasKey ? '✅ API 키 저장됨' : '🗑️ API 키 삭제됨');

  if (hasKey) {
    refreshHomeInsight();
  } else {
    const content = document.getElementById('ai-insight-content');
    if (content) {
      content.innerHTML = `🤖 AI 인사이트를 사용하려면 설정 탭에서 Gemini API 키를 입력하세요. (무료) <button class="btn btn-ghost" onclick="import('./ui').then(m=>m.navigate('settings'))" style="font-size:11px;padding:3px 8px;margin-left:4px"><div class="ripple-container"></div>설정으로 →</button>`;
    }
  }
}

// ── 홈 AI 인사이트 ────────────────────────────────────
export async function refreshHomeInsight() {
  if (!hasGeminiKey()) return;
  const content = document.getElementById('ai-insight-content');
  const refreshBtn = document.getElementById('btn-ai-insight-refresh');
  if (!content) return;

  // 스켈레톤 로딩
  content.innerHTML = `<div class="ai-skeleton-wrap">
    <div class="ai-skeleton" style="width:88%"></div>
    <div class="ai-skeleton" style="width:70%"></div>
    <div class="ai-skeleton" style="width:80%"></div>
    <div class="ai-skeleton" style="width:62%"></div>
    <div class="ai-skeleton" style="width:75%"></div>
  </div>`;
  if (refreshBtn) refreshBtn.classList.add('spinning');

  try {
    const text = await getHomeInsight(state);
    const rendered = `<div class="ai-content">${renderMarkdown(text)}</div>`;
    content.innerHTML = rendered;
    // 전체 보기 시트에도 동일 내용 채워두기
    const fullContent = document.getElementById('ai-insight-full-content');
    if (fullContent) fullContent.innerHTML = rendered;
    // 카드 바디 클릭 시 전체 보기 시트 오픈
    content.onclick = () => openSheet('ai-insight-full-sheet');
    // 업데이트 시간 표시
    const timeEl = document.getElementById('ai-insight-time');
    if (timeEl) {
      const now = new Date();
      const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')} 업데이트`;
      timeEl.textContent = timeStr;
      const fullTimeEl = document.getElementById('ai-insight-full-time');
      if (fullTimeEl) fullTimeEl.textContent = timeStr;
    }
  } catch (e) {
    content.innerHTML = `<div class="ai-error"><span>⚠️</span><span>${e.message}</span></div>`;
  } finally {
    if (refreshBtn) refreshBtn.classList.remove('spinning');
  }
}

// ── 가계부탭 AI 소비 분석 ─────────────────────────────
export async function runLedgerAIAnalysis() {
  const { currentLedgerYear: year, currentLedgerMonth: month } = renderModule;

  if (!hasGeminiKey()) {
    openSheet('ai-analysis-sheet');
    const content = document.getElementById('ai-analysis-content');
    if (content) content.innerHTML = `
      <div style="text-align:center;padding:32px 20px">
        <div style="font-size:40px;margin-bottom:16px">🔑</div>
        <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:8px">API 키가 필요해요</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:20px">Google AI Studio에서 무료로 Gemini API 키를<br>발급받고 설정에서 입력하면 AI 분석을 사용할 수 있어요.</div>
        <button class="btn btn-primary" id="btn-goto-settings-from-ai" style="font-size:13px;padding:10px 22px"><div class="ripple-container"></div>⚙️ 설정에서 키 입력하기</button>
      </div>`;
    document.getElementById('btn-goto-settings-from-ai')?.addEventListener('click', () => {
      closeSheet('ai-analysis-sheet');
      navigate('settings');
    });
    return;
  }

  const btn = document.getElementById('btn-ledger-ai');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="ripple-container"></div><span class="ai-btn-spinner"></span> 분석 중…'; }

  // 월 라벨 업데이트
  const monthLabel = document.getElementById('ai-analysis-month-label');
  if (monthLabel) monthLabel.textContent = `${year}년 ${month + 1}월`;

  openSheet('ai-analysis-sheet');
  const content = document.getElementById('ai-analysis-content');

  if (content) content.innerHTML = `
    <div class="ai-skeleton-wrap" style="padding:4px 0">
      <div class="ai-skeleton" style="width:55%;height:18px;margin-bottom:16px"></div>
      <div class="ai-skeleton" style="width:92%"></div>
      <div class="ai-skeleton" style="width:78%"></div>
      <div class="ai-skeleton" style="width:86%;margin-bottom:16px"></div>
      <div class="ai-skeleton" style="width:50%;height:16px;margin-bottom:10px"></div>
      <div class="ai-skeleton" style="width:88%"></div>
      <div class="ai-skeleton" style="width:73%"></div>
      <div class="ai-skeleton" style="width:81%;margin-bottom:16px"></div>
      <div class="ai-skeleton" style="width:50%;height:16px;margin-bottom:10px"></div>
      <div class="ai-skeleton" style="width:66%"></div>
      <div class="ai-skeleton" style="width:74%"></div>
    </div>`;

  try {
    const text = await getLedgerAnalysis(state, year, month);
    if (content) content.innerHTML = `<div class="ai-content ai-analysis-content-inner">${renderMarkdown(text)}</div>`;
  } catch (e) {
    if (content) content.innerHTML = `<div class="ai-error"><span>⚠️</span><span>${e.message}</span></div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<div class="ripple-container"></div>🤖 AI 소비 분석'; }
  }
}

// ── 미니 채팅 ─────────────────────────────────────────
let _chatMessages = [];

export function openAIChat() {
  openSheet('ai-chat-sheet');
  if (!hasGeminiKey()) {
    const container = document.getElementById('ai-chat-messages');
    if (container) {
      container.innerHTML = `<div style="text-align:center;padding:20px;font-size:13px;color:var(--text2);line-height:1.8">🤖 AI 채팅을 사용하려면 설정 탭에서 Gemini API 키를 입력하세요. (무료)<br><br><button class="btn btn-ghost" id="btn-goto-settings-from-chat" style="font-size:12px;padding:6px 14px"><div class="ripple-container"></div>설정으로 →</button></div>`;
      document.getElementById('btn-goto-settings-from-chat')?.addEventListener('click', () => {
        closeSheet('ai-chat-sheet');
        navigate('settings');
      });
    }
    return;
  }
  _renderChatMessages();
  setTimeout(() => document.getElementById('ai-chat-input')?.focus(), 80);
}

function _renderChatMessages() {
  const container = document.getElementById('ai-chat-messages');
  if (!container) return;
  if (_chatMessages.length === 0) {
    container.innerHTML = `
      <div class="ai-chat-empty">
        <div style="font-size:36px;margin-bottom:10px">🤖</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">AI 재무 도우미</div>
        <div style="font-size:12px;color:var(--text3);line-height:1.7">재무 관련 궁금한 점을 물어보세요.<br>지출 패턴, 저축 방법, 예산 조언 등<br>무엇이든 도와드려요 😊</div>
      </div>`;
    return;
  }
  container.innerHTML = _chatMessages.map(msg => {
    const isUser = msg.role === 'user';
    const isTyping = msg.content === '답변을 생성하는 중…';
    const bodyContent = isTyping
      ? `<div class="ai-typing-dots"><span></span><span></span><span></span></div>`
      : isUser
        ? `<span>${escapeHtml(msg.content)}</span>`
        : `<div class="ai-content">${renderMarkdown(msg.content)}</div>`;
    return `
      <div class="ai-chat-row ${isUser ? 'user' : 'ai'}">
        ${!isUser ? `<div class="ai-chat-avatar">🤖</div>` : ''}
        <div class="ai-chat-bubble ${isUser ? 'user' : 'ai'}">${bodyContent}</div>
      </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

export async function sendAIChatMessage() {
  const input = document.getElementById('ai-chat-input');
  const msg = input?.value?.trim();
  if (!msg) return;
  input.value = '';

  _chatMessages.push({ role: 'user', content: msg });
  _renderChatMessages();

  const thinkingMsg = { role: 'assistant', content: '답변을 생성하는 중…' };
  _chatMessages.push(thinkingMsg);
  _renderChatMessages();

  try {
    const reply = await chatWithAI(msg, state);
    _chatMessages[_chatMessages.length - 1] = { role: 'assistant', content: reply };
  } catch (e) {
    _chatMessages[_chatMessages.length - 1] = { role: 'assistant', content: `⚠️ 오류: ${e.message}` };
  }
  _renderChatMessages();
}

// ════════════════════════════════════════════════════════
// 자산 관리
// ════════════════════════════════════════════════════════
let _editAssetId = null;

export function openAssetForm(id) {
  _editAssetId = id || null;
  const asset = id ? (state.assets || []).find(a => a.id === id) : null;

  document.getElementById('asset-form-title').textContent = asset ? '자산 수정' : '자산 추가';
  document.getElementById('asset-name').value = asset?.name || '';
  document.getElementById('asset-amount').value = asset?.amount || '';
  document.getElementById('asset-memo').value = asset?.memo || '';

  // 타입 선택
  const typeEl = document.getElementById('asset-type');
  if (typeEl) typeEl.value = asset?.type || 'bank';

  // 용도 선택
  const purposeEl = document.getElementById('asset-purpose');
  if (purposeEl) purposeEl.value = asset?.purpose || '자유';

  openSheet('asset-form-sheet');
  setTimeout(() => document.getElementById('asset-name')?.focus(), 80);
}

export function saveAsset() {
  const name    = document.getElementById('asset-name')?.value.trim();
  const amount  = Number(document.getElementById('asset-amount')?.value) || 0;
  const type    = document.getElementById('asset-type')?.value || 'bank';
  const purpose = document.getElementById('asset-purpose')?.value || '자유';
  const memo    = document.getElementById('asset-memo')?.value.trim() || '';

  if (!name)   { alert('자산명을 입력하세요'); return; }
  if (!amount) { alert('금액을 입력하세요'); return; }

  if (!state.assets) state.assets = [];

  const asset = { id: _editAssetId || uid(), name, amount, type, purpose, memo };

  if (_editAssetId) {
    state.assets = state.assets.map(a => a.id === _editAssetId ? asset : a);
  } else {
    state.assets.push(asset);
  }

  save();
  closeSheet('asset-form-sheet');
  renderModule.renderAssets();
  renderModule.renderHouseLevel();
  showBadge('✅ 자산 저장됨');
}

export function deleteAsset(id) {
  if (!confirm('자산을 삭제할까요?')) return;
  state.assets = (state.assets || []).filter(a => a.id !== id);
  save();
  renderModule.renderAssets();
  renderModule.renderHouseLevel();
  showBadge('🗑️ 자산 삭제됨');
}

// ════════════════════════════════════════════════════════
// 예산 관리
// ════════════════════════════════════════════════════════
let _budgetEditCat = null;
let _budgetYear = new Date().getFullYear();
let _budgetMonth = new Date().getMonth();

export function getBudgetYear()  { return _budgetYear; }
export function getBudgetMonth() { return _budgetMonth; }

export function changeBudgetMonth(delta) {
  _budgetMonth += delta;
  if (_budgetMonth < 0)  { _budgetMonth = 11; _budgetYear--; }
  if (_budgetMonth > 11) { _budgetMonth = 0;  _budgetYear++; }
  renderModule.renderBudget();
}

export function openBudgetEditor(cat) {
  _budgetEditCat = cat;
  const existing = getMonthBudget(state.budgets, _budgetYear, _budgetMonth)[cat] || 0;
  document.getElementById('budget-editor-cat').textContent = cat;
  document.getElementById('budget-editor-amount').value = existing || '';
  openSheet('budget-editor-sheet');
  setTimeout(() => document.getElementById('budget-editor-amount')?.focus(), 80);
}

export function saveBudgetItem() {
  const amount = Number(document.getElementById('budget-editor-amount')?.value) || 0;
  setMonthBudget(state.budgets, _budgetYear, _budgetMonth, _budgetEditCat, amount);
  save();
  closeSheet('budget-editor-sheet');
  renderModule.renderBudget();
  showBadge('✅ 예산 저장됨');
}

export function applyBudgetSuggestion() {
  import('./budget').then(({ suggestBudget }) => {
    const suggested = suggestBudget(state.ledgerData, _budgetYear, _budgetMonth);
    for (const [cat, amt] of Object.entries(suggested)) {
      setMonthBudget(state.budgets, _budgetYear, _budgetMonth, cat, amt);
    }
    save();
    renderModule.renderBudget();
    showBadge('✅ 예산 자동 추천 적용됨');
  });
}

// ════════════════════════════════════════════════════════
// 월급날 이벤트
// ════════════════════════════════════════════════════════
export function checkSalaryEvent() {
  const t = new Date();
  const todayStr = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  const lastShown = localStorage.getItem('salary_event_date');
  if (lastShown === todayStr) return;

  const salaryEntry = (state.entries || []).find(e =>
    e.type === 'income' && e.category === '월급' && e.repeat === '매월' && e.day
  );
  if (!salaryEntry) return;
  if (salaryEntry.day !== t.getDate()) return;

  localStorage.setItem('salary_event_date', todayStr);
  showCoinParticles();
  showBadge('💰 월급날이에요!');
}

function showCoinParticles() {
  const overlay = document.getElementById('coin-particle-overlay');
  if (!overlay) return;
  overlay.innerHTML = '';
  overlay.style.display = 'block';
  for (let i = 0; i < 30; i++) {
    const coin = document.createElement('div');
    coin.className = 'coin-particle';
    coin.textContent = '💰';
    coin.style.left = Math.random() * 100 + '%';
    coin.style.animationDelay = Math.random() * 1.5 + 's';
    coin.style.fontSize = (14 + Math.random() * 14) + 'px';
    overlay.appendChild(coin);
  }
  setTimeout(() => { overlay.style.display = 'none'; overlay.innerHTML = ''; }, 3500);
}

// ════════════════════════════════════════════════════════
// 배지 체크 & 목표 공유
// ════════════════════════════════════════════════════════
export function runBadgeCheck() {
  const newBadges = checkBadges(state);
  if (newBadges.length > 0) {
    if (!state.badges) state.badges = [];
    state.badges.push(...newBadges);
    save();
    for (const bid of newBadges) {
      const def = BADGE_DEFS.find(b => b.id === bid);
      if (def) showBadge(`${def.icon} ${def.label} 배지 획득!`);
    }
  }
}

// ── 목표 공유 코드 ─────────────────────────────────────
export function openGoalJoinSheet() {
  document.getElementById('goal-join-code-input').value = '';
  openSheet('goal-join-sheet');
  setTimeout(() => document.getElementById('goal-join-code-input')?.focus(), 80);
}

export async function joinGoalByCode() {
  const code = document.getElementById('goal-join-code-input')?.value.trim().toUpperCase();
  if (!code || code.length < 6) { alert('6자리 초대 코드를 입력하세요'); return; }

  // 1) 내 로컬 목표에서 먼저 검색
  const localMatch = (state.goals || []).find(g => g.sharedCode === code);
  if (localMatch) { showBadge('ℹ️ 이미 보유 중인 목표 코드입니다'); closeSheet('goal-join-sheet'); return; }

  // 2) Firebase 전역 공유 컬렉션에서 검색
  const joinBtn = document.getElementById('btn-goal-join-confirm');
  if (joinBtn) { joinBtn.disabled = true; joinBtn.textContent = '검색 중…'; }

  try {
    const sharedData = await fetchSharedGoalByCode(code);
    if (!sharedData) {
      alert('해당 코드를 찾을 수 없습니다.\n코드를 다시 확인해주세요.');
      return;
    }

    // 내 목표 목록에 추가
    if (!state.goals) state.goals = [];
    const newGoal = {
      id: uid(),
      name: sharedData.name,
      emoji: sharedData.emoji || '🎯',
      targetAmount: sharedData.targetAmount || 0,
      targetDate: sharedData.targetDate || '',
      savedAmount: 0,
      sharedCode: code,
      sharedFrom: sharedData.publisherName || '알 수 없음',
    };
    state.goals.push(newGoal);
    save();
    closeSheet('goal-join-sheet');
    renderModule.renderGoals();
    showBadge(`✅ "${sharedData.name}" 목표에 참여했어요!`);
  } finally {
    if (joinBtn) { joinBtn.disabled = false; joinBtn.textContent = '참여하기'; }
  }
}

export async function generateGoalShareCode(goalId) {
  const goal = (state.goals || []).find(g => g.id === goalId);
  if (!goal) return;

  if (!goal.sharedCode) {
    goal.sharedCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    save();
  }

  // Firebase에 공유 목표 등록
  const published = await publishSharedGoal(goal.sharedCode, {
    name: goal.name,
    emoji: goal.emoji,
    targetAmount: goal.targetAmount,
    targetDate: goal.targetDate,
  });

  const codeEl = document.getElementById(`goal-share-code-${goalId}`);
  if (codeEl) codeEl.textContent = goal.sharedCode;

  // 클립보드 복사
  try {
    await navigator.clipboard.writeText(goal.sharedCode);
    showBadge(`📋 코드 복사됨: ${goal.sharedCode}`);
  } catch {
    showBadge(`📋 공유 코드: ${goal.sharedCode}`);
  }
}

// ════════════════════════════════════════════════════════
// 카드 관리 CRUD
// ════════════════════════════════════════════════════════
let _editCardId = null;

export function openCardForm(id) {
  _editCardId = id || null;
  const cards = (state.cards && state.cards.length > 0) ? state.cards : DEFAULT_CARDS;
  const card = id ? cards.find(c => c.id === id) : null;

  document.getElementById('card-form-title').textContent = card ? '카드 수정' : '카드 추가';
  document.getElementById('cf-name').value = card?.name || '';
  document.getElementById('cf-color').value = card?.color || '#3b82f6';
  document.getElementById('cf-payday').value = card?.payDay || 1;
  openSheet('card-form-overlay');
}

export function hideCardForm() {
  closeSheet('card-form-overlay');
  _editCardId = null;
}

export function saveCard() {
  const name = document.getElementById('cf-name').value.trim();
  const color = document.getElementById('cf-color').value;
  const payDay = parseInt(document.getElementById('cf-payday').value, 10) || 1;

  if (!name) { alert('카드명을 입력해주세요'); return; }
  if (payDay < 1 || payDay > 31) { alert('결제일은 1~31일 사이여야 합니다'); return; }

  if (!state.cards || state.cards.length === 0) {
    state.cards = JSON.parse(JSON.stringify(DEFAULT_CARDS));
  }

  if (_editCardId) {
    const idx = state.cards.findIndex(c => c.id === _editCardId);
    if (idx >= 0) {
      state.cards[idx] = { ...state.cards[idx], name, color, payDay };
    }
  } else {
    state.cards.push({ id: uid(), name, color, payDay });
  }

  save();
  hideCardForm();
  renderModule.renderCards();
  // 고정항목 폼의 카드 드롭다운도 갱신
  const cardSel = document.getElementById('f-card');
  if (cardSel) {
    const allCards = state.cards;
    cardSel.innerHTML = '<option value="">없음</option>' +
      allCards.map(c => `<option value="${c.id}">${c.name} (${c.payDay}일)</option>`).join('');
  }
}

export function deleteCard(id) {
  if (!confirm('카드를 삭제하면 해당 카드의 변동 지출 데이터도 사라집니다.\n계속할까요?')) return;
  if (!state.cards) state.cards = JSON.parse(JSON.stringify(DEFAULT_CARDS));
  state.cards = state.cards.filter(c => c.id !== id);
  // 해당 카드 데이터도 정리
  for (const ym of Object.keys(state.cardData)) {
    delete state.cardData[ym][id];
  }
  save();
  renderModule.renderCards();
}

// ════════════════════════════════════════════════════════
// 위시리스트 CRUD
// ════════════════════════════════════════════════════════
let _editWishId = null;

export function openWishForm(id) {
  _editWishId = id || null;
  const wish = id ? (state.wishlist || []).find(w => w.id === id) : null;

  document.getElementById('wish-form-title').textContent = wish ? '아이템 수정' : '위시 아이템 추가';
  document.getElementById('wf-name').value = wish?.name || '';
  document.getElementById('wf-price').value = wish?.price || '';
  document.getElementById('wf-priority').value = wish?.priority || 'want';
  document.getElementById('wf-category').value = wish?.category || '기타';
  document.getElementById('wf-date').value = wish?.targetDate || '';
  document.getElementById('wf-url').value = wish?.url || '';
  document.getElementById('wf-notes').value = wish?.notes || '';
  openSheet('wish-form-overlay');
}

export function hideWishForm() {
  closeSheet('wish-form-overlay');
  _editWishId = null;
}

export function saveWishItem() {
  const name = document.getElementById('wf-name').value.trim();
  const price = Number(document.getElementById('wf-price').value) || 0;
  if (!name) { alert('아이템명을 입력해주세요'); return; }

  const item = {
    id: _editWishId || uid(),
    name,
    price,
    priority: document.getElementById('wf-priority').value,
    category: document.getElementById('wf-category').value,
    targetDate: document.getElementById('wf-date').value || null,
    url: document.getElementById('wf-url').value.trim() || null,
    notes: document.getElementById('wf-notes').value.trim() || null,
    bought: false,
  };

  if (!state.wishlist) state.wishlist = [];
  if (_editWishId) {
    const idx = state.wishlist.findIndex(w => w.id === _editWishId);
    if (idx >= 0) item.bought = state.wishlist[idx].bought;
    state.wishlist = state.wishlist.map(w => w.id === _editWishId ? item : w);
  } else {
    state.wishlist.push(item);
  }

  save();
  hideWishForm();
  renderModule.renderWishlist();
}

export function deleteWishItem(id) {
  if (!confirm('위시 아이템을 삭제할까요?')) return;
  state.wishlist = (state.wishlist || []).filter(w => w.id !== id);
  save();
  renderModule.renderWishlist();
}

export function toggleWishBought(id) {
  const item = (state.wishlist || []).find(w => w.id === id);
  if (!item) return;
  item.bought = !item.bought;
  save();
  renderModule.renderWishlist();
}

// ════════════════════════════════════════════════════════
// 워치리스트 CRUD
// ════════════════════════════════════════════════════════
let _editWatchSymbol = null;

export function openWatchlistForm(symbol) {
  _editWatchSymbol = symbol || null;
  const item = symbol ? (state.watchlist || []).find(w => w.symbol === symbol) : null;

  document.getElementById('wl-symbol').value = item?.symbol || '';
  document.getElementById('wl-name').value = item?.name || '';
  document.getElementById('wl-market').value = item?.market || 'KRX';
  document.getElementById('wl-buyprice').value = item?.buyPrice || '';
  document.getElementById('wl-qty').value = item?.quantity || '';
  document.getElementById('wl-note').value = item?.note || '';
  openSheet('watchlist-form-overlay');
}

export function hideWatchlistForm() {
  closeSheet('watchlist-form-overlay');
  _editWatchSymbol = null;
}

export async function saveWatchlistItem() {
  const symbol = document.getElementById('wl-symbol').value.trim().toUpperCase();
  if (!symbol) { alert('종목코드를 입력해주세요'); return; }

  const item = {
    id: _editWatchSymbol ? ((state.watchlist || []).find(w => w.symbol === _editWatchSymbol)?.id || uid()) : uid(),
    symbol,
    name: document.getElementById('wl-name').value.trim() || symbol,
    market: document.getElementById('wl-market').value,
    buyPrice: Number(document.getElementById('wl-buyprice').value) || null,
    quantity: Number(document.getElementById('wl-qty').value) || null,
    note: document.getElementById('wl-note').value.trim() || null,
  };

  if (!state.watchlist) state.watchlist = [];
  if (_editWatchSymbol) {
    state.watchlist = state.watchlist.map(w => w.symbol === _editWatchSymbol ? item : w);
  } else {
    if (state.watchlist.some(w => w.symbol === symbol)) {
      alert('이미 추가된 종목입니다');
      return;
    }
    state.watchlist.push(item);
  }

  save();
  hideWatchlistForm();
  renderModule.renderFinance();
  // 가격 데이터 불러오기
  renderModule.fetchStockPrice(item).then(() => renderModule.renderFinance());
}

export function deleteWatchlistItem(symbol) {
  if (!confirm(`${symbol}을 관심종목에서 삭제할까요?`)) return;
  state.watchlist = (state.watchlist || []).filter(w => w.symbol !== symbol);
  save();
  renderModule.renderFinance();
}

// ── 가계 공유 (커플/가족) ────────────────────────────────
export async function createHouseholdUI() {
  const btn = document.getElementById('btn-create-household');
  if (btn) { btn.disabled = true; btn.textContent = '생성 중...'; }
  try {
    const code = await createHousehold({ ...state });
    if (!code) { alert('가계 생성에 실패했어요. 다시 시도해주세요.'); return; }
    showBadge(`🏠 공유 코드: ${code}`);
    await renderModule.renderHouseholdSection();
  } finally {
    if (btn) { btn.disabled = false; }
  }
}

export async function joinHouseholdUI() {
  const input = document.getElementById('household-join-code');
  const code = input?.value.trim().toUpperCase();
  if (!code || code.length !== 6) { alert('6자리 코드를 입력해주세요'); return; }
  const btn = document.getElementById('btn-join-household');
  if (btn) { btn.disabled = true; btn.textContent = '참여 중...'; }
  try {
    const data = await joinHousehold(code);
    if (data === null) { alert('코드를 찾을 수 없어요. 다시 확인해주세요.'); return; }
    if (Object.keys(data).length > 0) {
      Object.assign(state, data);
      renderModule.renderAll();
    }
    showBadge('🏠 가계에 참여했어요');
    await renderModule.renderHouseholdSection();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '참여'; }
  }
}

export async function leaveHouseholdUI() {
  const code = getCurrentHouseholdCode();
  if (!confirm(`공유 모드(${code})를 종료할까요? 내 개인 데이터로 돌아갑니다.`)) return;
  await leaveHousehold();
  showBadge('🚪 공유 모드 종료됨');
  await renderModule.renderHouseholdSection();
}

export function copyHouseholdCode() {
  const code = getCurrentHouseholdCode();
  if (!code) return;
  navigator.clipboard?.writeText(code).then(() => showBadge('📋 코드 복사됨'));
}

// ════════════════════════════════════════════════════════
// 즐겨찾기 템플릿
// ════════════════════════════════════════════════════════
export function renderLedgerTemplates() {
  const row = document.getElementById('ledger-templates-row');
  const chips = document.getElementById('ledger-templates-chips');
  if (!row || !chips) return;
  const templates = state.ledgerTemplates || [];
  if (!templates.length) { row.style.display = 'none'; return; }
  row.style.display = '';
  chips.innerHTML = templates.map(t => `
    <button class="template-chip" data-tpl-id="${escapeHtml(t.id)}" title="${escapeHtml(t.memo || t.category)}">
      <span style="font-size:10px;color:var(--text3)">${escapeHtml(t.category)}</span>
      <span style="font-size:12px;font-weight:700;font-family:var(--mono)">${fmtShort(t.amount)}</span>
      ${t.memo ? `<span style="font-size:10px;color:var(--text2);max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.memo)}</span>` : ''}
    </button>
  `).join('');
}

export function useTemplate(tplId) {
  const tpl = (state.ledgerTemplates || []).find(t => t.id === tplId);
  if (!tpl) return;
  _ledgerItemType = tpl.type || 'expense';
  _ledgerCategory = tpl.category;
  for (const [grp, cats] of Object.entries(LEDGER_CATEGORIES)) {
    if (cats.includes(tpl.category)) { _ledgerCatGroup = grp; break; }
  }
  const amtEl = document.getElementById('ledger-item-amount');
  const memoEl = document.getElementById('ledger-item-memo');
  if (amtEl) amtEl.value = tpl.amount || '';
  if (memoEl) memoEl.value = tpl.memo || '';
  _ledgerItemTag = tpl.tag || null;
  _renderTagButtons();
  _renderItemFormType();
}

export function saveCurrentAsTemplate() {
  const amtEl = document.getElementById('ledger-item-amount');
  const memoEl = document.getElementById('ledger-item-memo');
  const amount = parseInt(amtEl?.value || '0', 10);
  if (!amount || amount <= 0) { showBadge('⚠️ 금액을 먼저 입력하세요'); return; }
  if (!state.ledgerTemplates) state.ledgerTemplates = [];
  const isDupe = state.ledgerTemplates.some(t =>
    t.type === _ledgerItemType && t.category === _ledgerCategory && t.amount === amount
  );
  if (isDupe) { showBadge('이미 저장된 즐겨찾기예요'); return; }
  state.ledgerTemplates.push({
    id: uid(), type: _ledgerItemType, category: _ledgerCategory,
    amount, memo: memoEl?.value?.trim() || '', tag: _ledgerItemTag || null,
  });
  save();
  renderLedgerTemplates();
  showBadge('⭐ 즐겨찾기에 저장됐어요');
}

export function deleteTemplate(tplId) {
  state.ledgerTemplates = (state.ledgerTemplates || []).filter(t => t.id !== tplId);
  save();
  renderLedgerTemplates();
}

// ════════════════════════════════════════════════════════
// 영수증 OCR
// ════════════════════════════════════════════════════════
function _showOcrOverlay(dataUrl: string) {
  let ov = document.getElementById('ocr-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'ocr-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px';
    document.body.appendChild(ov);
  }
  ov.innerHTML = `
    <img src="${dataUrl}" style="max-width:280px;max-height:360px;border-radius:12px;object-fit:contain;opacity:0.7;border:1px solid rgba(255,255,255,0.15)"/>
    <div style="display:flex;align-items:center;gap:10px;color:#fff">
      <div style="width:18px;height:18px;border:2px solid rgba(165,180,252,0.6);border-top-color:#a5b4fc;border-radius:50%;animation:spin 0.8s linear infinite"></div>
      <span style="font-size:13px;font-weight:600">영수증 분석 중…</span>
    </div>`;
}
function _hideOcrOverlay() {
  document.getElementById('ocr-overlay')?.remove();
}

export async function handleReceiptOCR(file) {
  if (!file) return;
  const { analyzeReceipt, hasGeminiKey } = await import('./ai');
  if (!hasGeminiKey()) { alert('영수증 분석을 사용하려면 Gemini API 키가 필요합니다.\n설정 탭에서 키를 등록해주세요.'); return; }

  const btn = document.getElementById('btn-receipt-ocr');
  const origText = btn?.innerHTML || '';

  try {
    // 이미지 미리보기 + 로딩 오버레이
    const dataUrl: string = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

    _showOcrOverlay(dataUrl);
    if (btn) btn.innerHTML = '<span style="animation:spin 0.8s linear infinite;display:inline-block">⏳</span>';

    const base64 = dataUrl.split(',')[1];
    const result = await analyzeReceipt(base64, file.type || 'image/jpeg');

    if (result.amount > 0) {
      _calcAmountStr = String(result.amount);
      _updateCalcDisplay();
      const amtEl = document.getElementById('ledger-item-amount') as HTMLInputElement;
      if (amtEl) amtEl.value = String(result.amount);
    }
    if (result.memo) {
      const memoEl = document.getElementById('ledger-item-memo') as HTMLInputElement;
      if (memoEl) memoEl.value = result.memo;
    }
    // 날짜 자동 설정 (영수증에서 추출된 경우)
    if (result.date) {
      const dateEl = document.getElementById('ledger-item-date') as HTMLInputElement;
      if (dateEl) dateEl.value = result.date;
    }
    if (result.category) {
      for (const [grp, cats] of Object.entries(LEDGER_CATEGORIES)) {
        if (cats.some(c => result.category.includes(c) || c.includes(result.category))) {
          _ledgerCatGroup = grp;
          _ledgerCategory = cats.find(c => result.category.includes(c) || c.includes(result.category)) || cats[0];
          break;
        }
      }
      _renderItemFormType();
    }

    const filled = [result.amount > 0 ? '금액' : '', result.memo ? '메모' : '', result.date ? '날짜' : ''].filter(Boolean);
    showBadge(`📷 인식 완료 — ${filled.join(', ')} 자동입력`);
  } catch (err) {
    showBadge(`❌ ${err.message || 'OCR 실패'}`);
  } finally {
    _hideOcrOverlay();
    if (btn) btn.innerHTML = origText;
  }
}

// 메모 자동완성 칩 클릭 시 폼에 적용
export function applyMemoSuggestion({ memo, category, type }) {
  const memoEl = document.getElementById('ledger-item-memo');
  if (memoEl) memoEl.value = memo;

  if (type && type !== _ledgerItemType) {
    _ledgerItemType = type;
    _renderItemFormType();
  }
  if (category) {
    if (type === 'income') {
      if (LEDGER_INCOME_CATEGORIES.includes(category)) _ledgerCategory = category;
    } else {
      for (const [grp, cats] of Object.entries(LEDGER_CATEGORIES)) {
        if (cats.includes(category)) {
          _ledgerCatGroup = grp;
          _ledgerCategory = category;
          break;
        }
      }
    }
    _renderItemFormType();
  }

  // 추천 패널 닫기
  const sug = document.getElementById('memo-suggestions');
  if (sug) sug.innerHTML = '';
}

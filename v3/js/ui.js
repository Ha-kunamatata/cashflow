// ════════════════════════════════════════════════════════
// ui.js — 폼 / 시트 / 네비게이션 / 인터랙션
// ════════════════════════════════════════════════════════
import { INCOME_CATS, EXPENSE_CATS, LEDGER_CATEGORIES, LEDGER_INCOME_CATEGORIES, LEDGER_CAT_COLORS } from './config.js';
import { uid, today, dateKey, fmtFull, fmtShort, fmtSigned, escapeHtml, showBadge, openSheet, closeSheet } from './utils.js';
import { publishSharedGoal, fetchSharedGoalByCode } from './firebase.js';
import { state, save, syncLedgerToBalance, DEFAULT_CARDS } from './state.js';
import * as renderModule from './render.js';
import { getGeminiKey, setGeminiKey, hasGeminiKey, getHomeInsight, getLedgerAnalysis, chatWithAI } from './ai.js';
import { ASSET_TYPES, ASSET_PURPOSES, PURPOSE_COLORS } from './assets.js';
import { setMonthBudget, getMonthBudget } from './budget.js';
import { computeStreak, checkBadges, BADGE_DEFS } from './streak.js';

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
  settings: 'page-settings',
};

export function navigate(page, btn) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.getElementById(PAGE_MAP[page])?.classList.add('active');

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

function updateCatOptions(type, selected) {
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  document.getElementById('f-category').innerHTML = cats
    .map((c) => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`)
    .join('');
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

  list.innerHTML = items.map(item => {
    const col  = LEDGER_CAT_COLORS[item.category] || '#64748b';
    const sign = item.type === 'expense' ? '-' : '+';
    const cls  = item.type === 'expense' ? 'red' : 'green';
    return `
      <div class="lday-item" data-id="${item.id}">
        <span class="lday-item-dot" style="background:${col}"></span>
        <div class="lday-item-info">
          <span class="lday-item-cat">${escapeHtml(item.category)}</span>
          ${item.memo ? `<span class="lday-item-memo">${escapeHtml(item.memo)}</span>` : ''}
        </div>
        <span class="lday-item-amt ${cls}">${sign}${fmtShort(item.amount)}</span>
        <button class="icon-btn edit lday-edit-btn" data-id="${item.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
        </button>
        <button class="icon-btn del lday-del-btn" data-id="${item.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
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

  // 기존 값 복원 또는 기본값
  _ledgerItemType  = existing?.type     || 'expense';
  _ledgerCategory  = existing?.category || LEDGER_CATEGORIES[_ledgerCatGroup]?.[0] || '기타';
  // 카테고리 그룹 찾기
  for (const [grp, cats] of Object.entries(LEDGER_CATEGORIES)) {
    if (cats.includes(_ledgerCategory)) { _ledgerCatGroup = grp; break; }
  }

  const titleEl = document.getElementById('ledger-item-sheet-title');
  if (titleEl) {
    const d = new Date(_ledgerItemDate);
    titleEl.textContent = `${d.getMonth() + 1}/${d.getDate()} ${existing ? '항목 수정' : '항목 추가'}`;
  }

  const amtEl  = document.getElementById('ledger-item-amount');
  const memoEl = document.getElementById('ledger-item-memo');
  if (amtEl)  amtEl.value  = existing?.amount || '';
  if (memoEl) memoEl.value = existing?.memo   || '';

  _renderItemFormType();
  openSheet('ledger-item-sheet');
  setTimeout(() => amtEl?.focus(), 120);
}

export function closeLedgerItemForm() {
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

export function selectLedgerCatGroup(groupName) {
  _ledgerCatGroup = groupName;
  _ledgerCategory = LEDGER_CATEGORIES[groupName]?.[0] || '기타';
  _renderCatChips();
  _renderCatGroupTabs();
}

export function selectLedgerCat(catName) {
  _ledgerCategory = catName;
  _renderCatChips();
}

function _renderItemFormType() {
  const expBtn = document.getElementById('ledger-type-expense');
  const incBtn = document.getElementById('ledger-type-income');
  if (expBtn) expBtn.className = `type-btn ${_ledgerItemType === 'expense' ? 'expense-active' : 'inactive'}`;
  if (incBtn) incBtn.className = `type-btn ${_ledgerItemType === 'income'  ? 'income-active'  : 'inactive'}`;

  const groupWrap = document.getElementById('ledger-cat-group-wrap');
  if (groupWrap) groupWrap.style.display = _ledgerItemType === 'expense' ? '' : 'none';

  _renderCatGroupTabs();
  _renderCatChips();
}

function _renderCatGroupTabs() {
  const el = document.getElementById('ledger-cat-groups');
  if (!el) return;
  if (_ledgerItemType === 'income') { el.innerHTML = ''; return; }
  el.innerHTML = Object.keys(LEDGER_CATEGORIES).map(grp => `
    <button class="ledger-cat-group-btn ${grp === _ledgerCatGroup ? 'active' : ''}" data-group="${escapeHtml(grp)}">${grp}</button>
  `).join('');
}

function _renderCatChips() {
  const el = document.getElementById('ledger-cat-chips');
  if (!el) return;
  const cats = _ledgerItemType === 'income'
    ? LEDGER_INCOME_CATEGORIES
    : (LEDGER_CATEGORIES[_ledgerCatGroup] || []);

  el.innerHTML = cats.map(cat => {
    const col = LEDGER_CAT_COLORS[cat] || '#64748b';
    const sel = cat === _ledgerCategory;
    return `
      <button class="ledger-cat-chip ${sel ? 'active' : ''}" data-cat="${escapeHtml(cat)}"
        style="${sel ? `background:${col}22;border-color:${col};color:${col}` : ''}">
        ${cat}
      </button>`;
  }).join('');
}

export function saveLedgerItem() {
  const amt  = Number(document.getElementById('ledger-item-amount')?.value) || 0;
  const memo = document.getElementById('ledger-item-memo')?.value.trim() || '';

  if (!amt) { alert('금액을 입력해주세요'); return; }
  if (!_ledgerItemDate) return;

  if (!state.ledgerData) state.ledgerData = {};
  if (!state.ledgerData[_ledgerItemDate]) state.ledgerData[_ledgerItemDate] = [];

  const item = {
    id:       _ledgerItemId || uid(),
    type:     _ledgerItemType,
    category: _ledgerCategory,
    amount:   amt,
    memo,
  };

  if (_ledgerItemId) {
    state.ledgerData[_ledgerItemDate] = state.ledgerData[_ledgerItemDate].map(i =>
      i.id === _ledgerItemId ? item : i
    );
  } else {
    state.ledgerData[_ledgerItemDate].push(item);
  }

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
      content.innerHTML = `🤖 AI 인사이트를 사용하려면 설정 탭에서 Gemini API 키를 입력하세요. (무료) <button class="btn btn-ghost" onclick="import('./ui.js').then(m=>m.navigate('settings'))" style="font-size:11px;padding:3px 8px;margin-left:4px"><div class="ripple-container"></div>설정으로 →</button>`;
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
      content.innerHTML = `🤖 AI 인사이트를 사용하려면 설정 탭에서 Gemini API 키를 입력하세요. (무료) <button class="btn btn-ghost" onclick="import('./ui.js').then(m=>m.navigate('settings'))" style="font-size:11px;padding:3px 8px;margin-left:4px"><div class="ripple-container"></div>설정으로 →</button>`;
    }
  }
}

// ── 홈 AI 인사이트 ────────────────────────────────────
export async function refreshHomeInsight() {
  if (!hasGeminiKey()) return;
  const content = document.getElementById('ai-insight-content');
  if (!content) return;
  content.textContent = '분석 중…';
  try {
    const text = await getHomeInsight(state);
    content.textContent = text;
  } catch (e) {
    content.textContent = `⚠️ 오류: ${e.message}`;
  }
}

// ── 통계 탭 AI 분석 ───────────────────────────────────
export async function runLedgerAIAnalysis() {
  if (!hasGeminiKey()) {
    openSheet('ai-analysis-sheet');
    const content = document.getElementById('ai-analysis-content');
    if (content) content.innerHTML = `🤖 AI 분석을 사용하려면 설정 탭에서 Gemini API 키를 입력하세요. (무료)<br><br><button class="btn btn-ghost" id="btn-goto-settings-from-ai" style="font-size:12px;padding:6px 14px"><div class="ripple-container"></div>설정으로 →</button>`;
    document.getElementById('btn-goto-settings-from-ai')?.addEventListener('click', () => {
      closeSheet('ai-analysis-sheet');
      navigate('settings');
    });
    return;
  }
  const { currentLedgerYear: year, currentLedgerMonth: month } = renderModule;
  const btn = document.getElementById('btn-ledger-ai');
  if (btn) btn.textContent = '🤖 분석 중…';

  openSheet('ai-analysis-sheet');
  const content = document.getElementById('ai-analysis-content');
  if (content) content.textContent = '분석 중…';

  try {
    const text = await getLedgerAnalysis(state, year, month);
    if (content) content.textContent = text;
  } catch (e) {
    if (content) content.textContent = `⚠️ 오류: ${e.message}`;
  } finally {
    if (btn) btn.innerHTML = '<div class="ripple-container"></div>🤖 AI로 이번달 소비 분석하기';
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
    container.innerHTML = `<div style="text-align:center;color:var(--text3);font-size:12px;padding:20px">안녕하세요! 재무 관련 궁금한 점을 물어보세요 😊</div>`;
    return;
  }
  container.innerHTML = _chatMessages.map(msg => `
    <div style="display:flex;justify-content:${msg.role === 'user' ? 'flex-end' : 'flex-start'}">
      <div style="max-width:80%;padding:10px 14px;border-radius:${msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};background:${msg.role === 'user' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'var(--bg3)'};color:${msg.role === 'user' ? '#fff' : 'var(--text)'};font-size:13px;line-height:1.6;white-space:pre-wrap">${escapeHtml(msg.content)}</div>
    </div>
  `).join('');
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
  import('./budget.js').then(({ suggestBudget }) => {
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
  document.getElementById('card-form-overlay').style.display = 'flex';
}

export function hideCardForm() {
  document.getElementById('card-form-overlay').style.display = 'none';
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

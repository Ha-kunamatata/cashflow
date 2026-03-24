// ════════════════════════════════════════════════════════
// ui.js — 폼 / 시트 / 네비게이션 / 인터랙션
// ════════════════════════════════════════════════════════
import { INCOME_CATS, EXPENSE_CATS, LEDGER_CATEGORIES, LEDGER_INCOME_CATEGORIES, LEDGER_CAT_COLORS } from './config.js';
import { uid, today, dateKey, fmtFull, fmtShort, fmtSigned, escapeHtml, showBadge, openSheet, closeSheet } from './utils.js';
import { state, save, syncLedgerToBalance } from './state.js';
import * as renderModule from './render.js';
import { getGeminiKey, setGeminiKey, hasGeminiKey, getHomeInsight, getLedgerAnalysis, chatWithAI } from './ai.js';

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
  forecast: 'page-forecast',
  entries: 'page-entries',
  cards: 'page-cards',
  ledger: 'page-ledger',
  report: 'page-report',
  goals: 'page-goals',
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
  if (page === 'cards') renderModule.renderCards();
  if (page === 'ledger') renderModule.renderLedger();
  if (page === 'report') renderModule.renderReport();
  if (page === 'goals') renderModule.renderGoals();

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
  document.getElementById('f-card').value = entry?.card || '';
  document.getElementById('f-endmonth').value = entry?.endMonth || '';
  document.getElementById('f-date').value = entry?.date || '';
  document.getElementById('form-save-btn').textContent = entry ? '수정 완료' : '추가';

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

  const hasKey = hasGeminiKey();
  if (fab) fab.style.display = hasKey ? 'flex' : 'none';
  if (insightCard) insightCard.style.display = hasKey ? 'block' : 'none';
}

export function saveGeminiKey() {
  const input = document.getElementById('gemini-api-key-input');
  const status = document.getElementById('gemini-key-status');
  const val = input?.value?.trim() || '';

  // 마스킹된 값은 그대로 유지
  if (val === '••••••••••••••••••••') { showBadge('ℹ️ 변경사항 없음'); return; }

  setGeminiKey(val);
  const fab = document.getElementById('btn-ai-chat-fab');
  const insightCard = document.getElementById('ai-insight-card');
  const hasKey = hasGeminiKey();

  if (fab) fab.style.display = hasKey ? 'flex' : 'none';
  if (insightCard) insightCard.style.display = hasKey ? 'block' : 'none';
  if (input) input.value = hasKey ? '••••••••••••••••••••' : '';
  if (status) status.textContent = hasKey ? '✅ API 키가 저장되었습니다' : 'API 키가 삭제되었습니다';
  showBadge(hasKey ? '✅ API 키 저장됨' : '🗑️ API 키 삭제됨');

  if (hasKey) refreshHomeInsight();
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
    alert('설정 탭에서 Gemini API 키를 먼저 입력해주세요.');
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
  if (!hasGeminiKey()) {
    alert('설정 탭에서 Gemini API 키를 먼저 입력해주세요.');
    return;
  }
  openSheet('ai-chat-sheet');
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

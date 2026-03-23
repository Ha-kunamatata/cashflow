// ════════════════════════════════════════════════════════
// ui.js — 폼 / 시트 / 네비게이션 / 인터랙션
// ════════════════════════════════════════════════════════
import { INCOME_CATS, EXPENSE_CATS } from './config.js';
import { uid, today, dateKey, fmtFull, showBadge, openSheet, closeSheet } from './utils.js';
import { state, save, syncCheckDataToBalance } from './state.js';
import * as renderModule from './render.js';

// ── 네비게이션 ─────────────────────────────────────────
const PAGE_MAP = {
  home: 'page-home',
  forecast: 'page-forecast',
  entries: 'page-entries',
  cards: 'page-cards',
  ledger: 'page-ledger',
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
  state.balance = parseFloat(document.getElementById('balance-sheet-input')?.value) || 0;

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
  state.dangerLine = parseFloat(document.getElementById('danger-line-input')?.value) || 0;

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
    state.dangerLine = parseFloat(val) || 0;

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
  const amount = parseFloat(document.getElementById('f-amount').value);

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
  state.cardData[ym][card] = parseFloat(val) || 0;

  save();
  renderModule.renderHome();

  if (document.getElementById('page-forecast')?.classList.contains('active')) {
    renderModule.renderForecast();
  }
}

// ── 가계부 ─────────────────────────────────────────────
let selectedLedgerDate = null;

export function openLedgerEditor(dateStr) {
  selectedLedgerDate = dateStr;

  renderModule.setSelectedLedgerDate(dateStr);
  renderModule.renderLedger();

  const card = document.getElementById('ledger-editor-card');
  const label = document.getElementById('ledger-selected-date');
  const input = document.getElementById('ledger-amount-input');
  const d = new Date(dateStr);

  if (isNaN(d.getTime())) return;

  label.textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 소비 입력`;
  input.value = state.checkData?.[dateStr] || '';
  card.style.display = 'block';

  setTimeout(() => input.focus(), 80);
}

export function closeLedgerEditor() {
  document.getElementById('ledger-editor-card').style.display = 'none';
}

export function saveLedgerExpense() {
  if (!selectedLedgerDate) return;

  const amt = parseFloat(document.getElementById('ledger-amount-input').value) || 0;

  if (!state.checkData) state.checkData = {};

  if (amt > 0) {
    state.checkData[selectedLedgerDate] = amt;
  } else {
    delete state.checkData[selectedLedgerDate];
  }

  syncCheckDataToBalance();
  save();
  renderModule.renderLedger();
  renderModule.renderHome();

  if (document.getElementById('page-forecast')?.classList.contains('active')) {
    renderModule.renderForecast();
  }

  showBadge('✅ 가계부 저장됨');
}

export function clearLedgerExpense() {
  if (!selectedLedgerDate) return;

  if (state.checkData) {
    delete state.checkData[selectedLedgerDate];
  }

  syncCheckDataToBalance();
  save();

  document.getElementById('ledger-amount-input').value = '';

  renderModule.renderLedger();
  renderModule.renderHome();
  showBadge('🗑️ 가계부 삭제됨');
}

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
  state.appliedCheckData = {};
  state.balance = 0;

  save();
  applyTheme();
  renderModule.renderAll();
}

// ════════════════════════════════════════════════════════
// app.js — 진입점. 이벤트 바인딩 & Firebase 초기화
// ════════════════════════════════════════════════════════
import {
  initAuth,
  signInWithGoogle,
  signOutUser,
  loadFromFirebase,
  startSync
} from './firebase.js';

import {
  state,
  load,
  save,
  syncCheckDataToBalance,
  initDefaultData
} from './state.js';

import {
  renderAll,
  renderForecast,
  renderCards,
  renderLedger,
  setChartPeriod,
  setForecastFilter,
  setEntryFilter,
  changeLedgerMonth
} from './render.js';

import {
  navigate,
  applyTheme,
  toggleTheme,
  openBalanceSheet,
  submitBalanceSheet,
  openProfileSheet,
  confirmSignOut,
  showForm,
  hideForm,
  closeFormIfOutside,
  setFormType,
  onRepeatChange,
  saveEntry,
  editEntry,
  deleteEntry,
  updateCardData,
  openLedgerEditor,
  closeLedgerEditor,
  saveLedgerExpense,
  clearLedgerExpense,
  saveSetting,
  onDangerLineChange,
  exportData,
  importDataClick,
  importData,
  resetAll
} from './ui.js';

import {
  initRipple,
  showBadge,
  openSheet,
  closeSheet,
  closeSheetOutside,
  showLoading,
  hideLoading
} from './utils.js';

// ── 리플 초기화 ────────────────────────────────────────
initRipple();

// ── Firebase 인증 상태 감지 ────────────────────────────
initAuth(
  async (user) => {
    // 로그인 성공
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('topbar').style.display = 'flex';
    document.getElementById('bottom-nav').style.display = 'flex';

    // 아바타
    const img = document.getElementById('user-avatar-img');
    const txt = document.getElementById('user-avatar-text');

    if (user.photoURL) {
      img.src = user.photoURL;
      img.style.display = 'block';
      txt.style.display = 'none';
    } else {
      txt.textContent = (user.displayName || user.email || '?')[0].toUpperCase();
      img.style.display = 'none';
      txt.style.display = 'flex';
    }

    document.getElementById('user-menu-name').textContent = user.displayName || user.email;

    // 설정 프로필 카드 업데이트
    const settingsAvatar = document.getElementById('settings-profile-avatar');
    const settingsName = document.getElementById('settings-profile-name');
    const settingsEmail = document.getElementById('settings-profile-email');
    if (settingsName) settingsName.textContent = user.displayName || '사용자';
    if (settingsEmail) settingsEmail.textContent = user.email || '-';
    if (settingsAvatar) {
      settingsAvatar.innerHTML = user.photoURL
        ? `<img src="${user.photoURL}" referrerpolicy="no-referrer">`
        : (user.displayName || user.email || '?')[0].toUpperCase();
    }

    // 데이터 로드
    load();
    const cloud = await loadFromFirebase();

    if (cloud) {
      Object.assign(state, cloud);
      localStorage.setItem('cashflow_v21', JSON.stringify(state));
      showBadge('☁️ 동기화됨');
    }

    initDefaultData();
    syncCheckDataToBalance();

    document.getElementById('setting-danger').value = state.dangerLine;
    document.getElementById('danger-line-input').value = state.dangerLine;

    applyTheme();
    renderAll();

    // 실시간 동기화
    startSync((cloudData) => {
      const localTheme = state.theme; // 테마는 기기별 설정 유지
      Object.assign(state, cloudData);
      state.theme = localTheme;
      localStorage.setItem('cashflow_v21', JSON.stringify(state));
      applyTheme();
      renderAll();
      showBadge('🔄 다른 기기에서 업데이트됨');
    });
  },
  () => {
    // 로그아웃
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('topbar').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'none';
    hideLoading();
    closeSheet('profile-sheet');
    closeSheet('signout-sheet');
    closeSheet('balance-sheet');
  }
);

// ══════════════════════════════════════════════════════
// 이벤트 바인딩
// ══════════════════════════════════════════════════════

// 로그인
document.getElementById('btn-google-login')?.addEventListener('click', signInWithGoogle);

// 탑바
document.getElementById('btn-open-profile')?.addEventListener('click', openProfileSheet);
document.getElementById('btn-open-balance')?.addEventListener('click', openBalanceSheet);

// 바텀 탭
document.querySelectorAll('.nav-btn[data-page]').forEach((btn) => {
  btn.addEventListener('click', () => navigate(btn.dataset.page, btn));
});

// 예측 탭
document.getElementById('period-30')?.addEventListener('click', (e) => setChartPeriod(30, e.target));
document.getElementById('period-90')?.addEventListener('click', (e) => setChartPeriod(90, e.target));
document.getElementById('period-180')?.addEventListener('click', (e) => setChartPeriod(180, e.target));
document.getElementById('period-365')?.addEventListener('click', (e) => setChartPeriod(365, e.target));

document.querySelectorAll('[data-forecast-filter]').forEach((btn) => {
  btn.addEventListener('click', () => setForecastFilter(btn.dataset.forecastFilter, btn));
});

document.getElementById('danger-line-input')?.addEventListener('input', onDangerLineChange);

// 수입지출 탭
document.getElementById('btn-add-entry')?.addEventListener('click', () => showForm());

document.querySelectorAll('[data-entry-filter]').forEach((btn) => {
  btn.addEventListener('click', () => setEntryFilter(btn.dataset.entryFilter, btn));
});

document.getElementById('type-income-btn')?.addEventListener('click', () => setFormType('income'));
document.getElementById('type-expense-btn')?.addEventListener('click', () => setFormType('expense'));
document.getElementById('f-repeat')?.addEventListener('change', onRepeatChange);
document.getElementById('form-save-btn')?.addEventListener('click', saveEntry);
document.getElementById('form-cancel-btn')?.addEventListener('click', hideForm);
document.getElementById('form-overlay')?.addEventListener('click', closeFormIfOutside);

// 수입/지출 목록 이벤트 위임
document.getElementById('entries-list')?.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.icon-btn.edit');
  const delBtn = e.target.closest('.icon-btn.del');
  if (editBtn?.dataset.id) editEntry(editBtn.dataset.id);
  if (delBtn?.dataset.id) deleteEntry(delBtn.dataset.id);
});

// 카드 데이터 이벤트 위임
document.getElementById('card-months-list')?.addEventListener('input', (e) => {
  const input = e.target.closest('.card-num-input[data-ym]');
  if (input) updateCardData(input.dataset.ym, input.dataset.card, input.value);
});

// 가계부 달력 이벤트 위임
document.getElementById('ledger-calendar-grid')?.addEventListener('click', (e) => {
  const day = e.target.closest('.ledger-day:not(.empty)');
  if (day?.dataset.dk) openLedgerEditor(day.dataset.dk);
});

// 가계부 탭
document.getElementById('btn-ledger-prev')?.addEventListener('click', () => changeLedgerMonth(-1));
document.getElementById('btn-ledger-next')?.addEventListener('click', () => changeLedgerMonth(1));
document.getElementById('btn-ledger-save')?.addEventListener('click', saveLedgerExpense);
document.getElementById('btn-ledger-clear')?.addEventListener('click', clearLedgerExpense);
document.getElementById('btn-ledger-close')?.addEventListener('click', closeLedgerEditor);

// 설정 탭
document.getElementById('btn-settings-signout')?.addEventListener('click', () => openSheet('signout-sheet'));
document.getElementById('setting-danger')?.addEventListener('change', (e) => saveSetting('dangerLine', e.target.value));
document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);
document.getElementById('btn-export')?.addEventListener('click', exportData);
document.getElementById('btn-import')?.addEventListener('click', importDataClick);
document.getElementById('import-file')?.addEventListener('change', importData);
document.getElementById('btn-reset')?.addEventListener('click', () => {
  if (confirm('모든 데이터를 초기화할까요?')) resetAll();
});

// 잔고 시트
document.getElementById('btn-balance-submit')?.addEventListener('click', submitBalanceSheet);
document.getElementById('btn-balance-cancel')?.addEventListener('click', () => closeSheet('balance-sheet'));
document.getElementById('balance-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'balance-sheet'));
document.getElementById('balance-sheet-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitBalanceSheet();
});

// 프로필 시트
document.getElementById('btn-close-profile')?.addEventListener('click', () => closeSheet('profile-sheet'));
document.getElementById('btn-profile-settings')?.addEventListener('click', () => {
  closeSheet('profile-sheet');
  navigate('settings');
});
document.getElementById('btn-confirm-signout')?.addEventListener('click', confirmSignOut);
document.getElementById('profile-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'profile-sheet'));

// 로그아웃 시트
document.getElementById('btn-signout-cancel')?.addEventListener('click', () => closeSheet('signout-sheet'));
document.getElementById('btn-signout-confirm')?.addEventListener('click', async () => {
  closeSheet('signout-sheet');
  showLoading('로그아웃 중…');
  await signOutUser();
  hideLoading();
  showBadge('👋 로그아웃되었습니다');
});
document.getElementById('signout-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'signout-sheet'));

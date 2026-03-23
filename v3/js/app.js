// ════════════════════════════════════════════════════════
// app.js — 진입점. 모든 이벤트 바인딩
// ════════════════════════════════════════════════════════
import { signInWithGoogle, proceedSignOut } from ‘./firebase.js’;
import { state, save }                      from ‘./state.js’;
import { renderAll, renderForecast, renderCards, renderLedger,
setChartPeriod, setForecastFilter, setEntryFilter,
changeLedgerMonth }                from ‘./render.js’;
import { navigate, applyTheme, toggleTheme,
openBalanceSheet, submitBalanceSheet,
openProfileSheet, confirmSignOut,
showForm, hideForm, closeFormIfOutside,
setFormType, onRepeatChange, saveEntry,
editEntry, deleteEntry,
updateCardData, openLedgerEditor,
closeLedgerEditor, saveLedgerExpense, clearLedgerExpense,
saveSetting, exportData, importDataClick, importData, resetAll,
onDangerLineChange }               from ‘./ui.js’;
import { initRipple, showBadge, openSheet, closeSheet, closeSheetOutside } from ‘./utils.js’;

// ── 전역 노출 (render.js 인라인 onclick 대응) ──────────
window._ui = { editEntry, deleteEntry, updateCardData, openLedgerEditor };

// ── 리플 이펙트 초기화 ─────────────────────────────────
initRipple();

// ══════════════════════════════════════════════════════
// 로그인
// ══════════════════════════════════════════════════════
document.getElementById(‘btn-google-login’)?.addEventListener(‘click’, signInWithGoogle);

// ══════════════════════════════════════════════════════
// 탑바 / 아바타
// ══════════════════════════════════════════════════════
document.getElementById(‘btn-open-profile’)?.addEventListener(‘click’, openProfileSheet);
document.getElementById(‘btn-open-balance’)?.addEventListener(‘click’, openBalanceSheet);

// ══════════════════════════════════════════════════════
// 바텀 탭 네비게이션
// ══════════════════════════════════════════════════════
document.querySelectorAll(’.nav-btn[data-page]’).forEach(btn => {
btn.addEventListener(‘click’, () => navigate(btn.dataset.page, btn));
});

// ══════════════════════════════════════════════════════
// 예측 탭
// ══════════════════════════════════════════════════════
document.getElementById(‘period-30’)?.addEventListener(‘click’,  e => setChartPeriod(30,  e.target));
document.getElementById(‘period-90’)?.addEventListener(‘click’,  e => setChartPeriod(90,  e.target));
document.getElementById(‘period-180’)?.addEventListener(‘click’, e => setChartPeriod(180, e.target));
document.getElementById(‘period-365’)?.addEventListener(‘click’, e => setChartPeriod(365, e.target));

document.querySelectorAll(’[data-forecast-filter]’).forEach(btn => {
btn.addEventListener(‘click’, () => setForecastFilter(btn.dataset.forecastFilter, btn));
});

document.getElementById(‘danger-line-input’)?.addEventListener(‘input’, onDangerLineChange);

// ══════════════════════════════════════════════════════
// 수입지출 탭
// ══════════════════════════════════════════════════════
document.getElementById(‘btn-add-entry’)?.addEventListener(‘click’, () => showForm());

document.querySelectorAll(’[data-entry-filter]’).forEach(btn => {
btn.addEventListener(‘click’, () => setEntryFilter(btn.dataset.entryFilter, btn));
});

// 폼
document.getElementById(‘type-income-btn’)?.addEventListener(‘click’,  () => setFormType(‘income’));
document.getElementById(‘type-expense-btn’)?.addEventListener(‘click’, () => setFormType(‘expense’));
document.getElementById(‘f-repeat’)?.addEventListener(‘change’, onRepeatChange);
document.getElementById(‘form-save-btn’)?.addEventListener(‘click’, saveEntry);
document.getElementById(‘form-cancel-btn’)?.addEventListener(‘click’, hideForm);
document.getElementById(‘form-overlay’)?.addEventListener(‘click’, closeFormIfOutside);

// ══════════════════════════════════════════════════════
// 가계부 탭
// ══════════════════════════════════════════════════════
document.getElementById(‘btn-ledger-prev’)?.addEventListener(‘click’, () => changeLedgerMonth(-1));
document.getElementById(‘btn-ledger-next’)?.addEventListener(‘click’, () => changeLedgerMonth(1));
document.getElementById(‘btn-ledger-save’)?.addEventListener(‘click’, saveLedgerExpense);
document.getElementById(‘btn-ledger-clear’)?.addEventListener(‘click’, clearLedgerExpense);
document.getElementById(‘btn-ledger-close’)?.addEventListener(‘click’, closeLedgerEditor);

// ══════════════════════════════════════════════════════
// 설정 탭
// ══════════════════════════════════════════════════════
document.getElementById(‘setting-danger’)?.addEventListener(‘change’, e => saveSetting(‘dangerLine’, e.target.value));
document.getElementById(‘theme-toggle-btn’)?.addEventListener(‘click’, toggleTheme);
document.getElementById(‘btn-export’)?.addEventListener(‘click’, exportData);
document.getElementById(‘btn-import’)?.addEventListener(‘click’, importDataClick);
document.getElementById(‘import-file’)?.addEventListener(‘change’, importData);
document.getElementById(‘btn-reset’)?.addEventListener(‘click’, () => { if (confirm(‘모든 데이터를 초기화할까요?’)) resetAll(); });

// ══════════════════════════════════════════════════════
// 시트들
// ══════════════════════════════════════════════════════
// 잔고 시트
document.getElementById(‘btn-balance-submit’)?.addEventListener(‘click’, submitBalanceSheet);
document.getElementById(‘btn-balance-cancel’)?.addEventListener(‘click’, () => closeSheet(‘balance-sheet’));
document.getElementById(‘balance-sheet’)?.addEventListener(‘click’, e => closeSheetOutside(e, ‘balance-sheet’));
document.getElementById(‘balance-sheet-input’)?.addEventListener(‘keydown’, e => { if (e.key===‘Enter’) submitBalanceSheet(); });

// 프로필 시트
document.getElementById(‘btn-close-profile’)?.addEventListener(‘click’,    () => closeSheet(‘profile-sheet’));
document.getElementById(‘btn-profile-settings’)?.addEventListener(‘click’, () => { closeSheet(‘profile-sheet’); navigate(‘settings’); });
document.getElementById(‘btn-confirm-signout’)?.addEventListener(‘click’,  confirmSignOut);
document.getElementById(‘profile-sheet’)?.addEventListener(‘click’, e => closeSheetOutside(e, ‘profile-sheet’));

// 로그아웃 시트
document.getElementById(‘btn-signout-cancel’)?.addEventListener(‘click’,  () => closeSheet(‘signout-sheet’));
document.getElementById(‘btn-signout-confirm’)?.addEventListener(‘click’, proceedSignOut);
document.getElementById(‘signout-sheet’)?.addEventListener(‘click’, e => closeSheetOutside(e, ‘signout-sheet’));

// ════════════════════════════════════════════════════════
// ui.js — 폼 / 시트 / 네비게이션 / 인터랙션
// ════════════════════════════════════════════════════════
import { INCOME_CATS, EXPENSE_CATS } from ‘./config.js’;
import { uid, today, dateKey, yyyymm, fmtFull, showBadge, openSheet, closeSheet } from ‘./utils.js’;
import { state, save, syncCheckDataToBalance } from ‘./state.js’;
import { renderAll, renderHome, renderEntries, renderForecast, renderCards, renderLedger, renderCardMonths, selectedLedgerDate } from ‘./render.js’;
import * as renderModule from ‘./render.js’;
import { proceedSignOut } from ‘./firebase.js’;

// ── 네비게이션 ─────────────────────────────────────────
const PAGE_MAP = {
home:     ‘page-home’,
forecast: ‘page-forecast’,
entries:  ‘page-entries’,
cards:    ‘page-cards’,
ledger:   ‘page-ledger’,
settings: ‘page-settings’,
};

export function navigate(page, btn) {
document.querySelectorAll(’.page’).forEach(p=>p.classList.remove(‘active’));
document.getElementById(PAGE_MAP[page])?.classList.add(‘active’);
document.querySelectorAll(’.nav-btn’).forEach(b=>b.classList.remove(‘active’));
if (btn) btn.classList.add(‘active’);
else { const idx=Object.keys(PAGE_MAP).indexOf(page); document.querySelectorAll(’.nav-btn’)[idx]?.classList.add(‘active’); }
if (page===‘forecast’) renderForecast();
if (page===‘cards’)    renderCards();
if (page===‘ledger’)   renderLedger();
window.scrollTo({ top:0, behavior:‘smooth’ });
}

// ── 테마 ───────────────────────────────────────────────
export function applyTheme() {
const mode = state.theme || ‘dark’;
document.body.classList.toggle(‘light-theme’, mode===‘light’);
const btn = document.getElementById(‘theme-toggle-btn’);
if (btn) btn.textContent = mode===‘light’ ? ‘라이트 모드’ : ‘다크 모드’;
}

export function toggleTheme() {
state.theme = state.theme===‘light’ ? ‘dark’ : ‘light’;
applyTheme(); save();
showBadge(state.theme===‘light’ ? ‘☀️ 라이트 모드’ : ‘🌙 다크 모드’);
}

// ── 잔고 시트 ──────────────────────────────────────────
export function openBalanceSheet() {
const cur = document.getElementById(‘balance-sheet-current’);
const inp = document.getElementById(‘balance-sheet-input’);
if (cur) cur.textContent = fmtFull(state.balance);
if (inp) inp.value = state.balance || ‘’;
openSheet(‘balance-sheet’);
setTimeout(() => inp?.focus(), 80);
}

export function submitBalanceSheet() {
const v = parseFloat(document.getElementById(‘balance-sheet-input’)?.value) || 0;
state.balance = v;
save(); renderHome();
if (document.getElementById(‘page-forecast’).classList.contains(‘active’)) renderForecast();
closeSheet(‘balance-sheet’);
showBadge(‘✅ 잔고가 수정됐어요’);
}

// ── 프로필 시트 ────────────────────────────────────────
export function openProfileSheet() {
const user = window.currentUser;
const avatar = document.getElementById(‘profile-sheet-avatar’);
const name   = document.getElementById(‘profile-sheet-name’);
const email  = document.getElementById(‘profile-sheet-email’);
if (name)  name.textContent  = user?.displayName || ‘사용자’;
if (email) email.textContent = user?.email || ‘-’;
if (avatar) {
avatar.innerHTML = user?.photoURL
? `<img src="${user.photoURL}" referrerpolicy="no-referrer" alt="profile">`
: (user?.displayName||user?.email||’?’)[0].toUpperCase();
}
openSheet(‘profile-sheet’);
}

export function confirmSignOut() {
closeSheet(‘profile-sheet’);
openSheet(‘signout-sheet’);
}

export { proceedSignOut };

// ── 위험선 ─────────────────────────────────────────────
export function onDangerLineChange() {
state.dangerLine = parseFloat(document.getElementById(‘danger-line-input’).value)||0;
document.getElementById(‘setting-danger’).value = state.dangerLine;
save(); renderHome();
if (document.getElementById(‘page-forecast’).classList.contains(‘active’)) renderForecast();
}

export function saveSetting(key, val) {
if (key===‘dangerLine’) {
state.dangerLine = parseFloat(val)||0;
document.getElementById(‘danger-line-input’).value = state.dangerLine;
save(); renderHome();
}
}

// ── 항목 폼 ────────────────────────────────────────────
export function showForm(entry) {
document.getElementById(‘form-overlay’).style.display = ‘flex’;
document.body.style.overflow = ‘hidden’;
state.editId   = entry ? entry.id : null;
state.formType = entry ? entry.type : ‘income’;
_updateTypeButtons(state.formType);
document.getElementById(‘form-sheet-title’).textContent = entry ? ‘항목 수정’ : ‘항목 추가’;
document.getElementById(‘f-name’).value     = entry?.name     || ‘’;
document.getElementById(‘f-amount’).value   = entry?.amount   || ‘’;
document.getElementById(‘f-repeat’).value   = entry?.repeat   || ‘매월’;
document.getElementById(‘f-day’).value      = entry?.day      || ‘’;
document.getElementById(‘f-card’).value     = entry?.card     || ‘’;
document.getElementById(‘f-endmonth’).value = entry?.endMonth || ‘’;
document.getElementById(‘f-date’).value     = entry?.date     || ‘’;
document.getElementById(‘form-save-btn’).textContent = entry ? ‘수정 완료’ : ‘추가’;
_updateCatOptions(state.formType, entry?.category);
onRepeatChange();
}

export function hideForm() {
document.getElementById(‘form-overlay’).style.display = ‘none’;
document.body.style.overflow = ‘’;
state.editId = null;
}

export function closeFormIfOutside(e) {
if (e.target===document.getElementById(‘form-overlay’)) hideForm();
}

export function setFormType(t) {
state.formType = t;
_updateTypeButtons(t);
_updateCatOptions(t);
}

function _updateTypeButtons(t) {
document.getElementById(‘type-income-btn’).className  = `type-btn ${t==='income'?'income-active':'inactive'}`;
document.getElementById(‘type-expense-btn’).className = `type-btn ${t==='expense'?'expense-active':'inactive'}`;
}

function _updateCatOptions(t, selected) {
const cats = t===‘income’ ? INCOME_CATS : EXPENSE_CATS;
document.getElementById(‘f-category’).innerHTML =
cats.map(c=>`<option value="${c}" ${c===selected?'selected':''}>${c}</option>`).join(’’);
}

export function onRepeatChange() {
const rep = document.getElementById(‘f-repeat’).value;
const dl  = document.getElementById(‘day-label’);
const dw  = document.getElementById(‘date-wrap’);
if (rep===‘1회성’) { dl.textContent=‘기준일’; dw.style.display=‘block’; }
else if (rep===‘격주’) { dl.textContent=‘시작일’; dw.style.display=‘block’; }
else { dl.textContent=‘기준일 (매월 며칠)’; dw.style.display=‘none’; }
}

export function saveEntry() {
const name   = document.getElementById(‘f-name’).value.trim();
const amount = parseFloat(document.getElementById(‘f-amount’).value);
if (!name||!amount) { alert(‘항목명과 금액을 입력해주세요’); return; }
const entry = {
id:       state.editId || uid(),
type:     state.formType,
name, amount,
category: document.getElementById(‘f-category’).value,
repeat:   document.getElementById(‘f-repeat’).value,
day:      parseInt(document.getElementById(‘f-day’).value)||null,
card:     document.getElementById(‘f-card’).value,
endMonth: document.getElementById(‘f-endmonth’).value.trim()||null,
date:     document.getElementById(‘f-date’).value||null,
};
if (state.editId) state.entries = state.entries.map(e=>e.id===state.editId?entry:e);
else state.entries.push(entry);
hideForm(); save(); renderAll();
showBadge(‘✅ 저장됨’);
}

export function editEntry(id) {
const e = state.entries.find(x=>x.id===id);
if (e) showForm(e);
}

export function deleteEntry(id) {
if (!confirm(‘삭제할까요?’)) return;
state.entries = state.entries.filter(e=>e.id!==id);
save(); renderAll();
}

// ── 카드 데이터 ────────────────────────────────────────
export function updateCardData(ym, card, val) {
if (!state.cardData[ym]) state.cardData[ym]={};
state.cardData[ym][card] = parseFloat(val)||0;
save(); renderHome();
if (document.getElementById(‘page-forecast’).classList.contains(‘active’)) renderForecast();
}

// ── 가계부 ─────────────────────────────────────────────
export function openLedgerEditor(dateStr) {
renderModule.selectedLedgerDate = dateStr; // 주의: const → 직접 변경 불가, 아래 우회
_setSelectedLedgerDate(dateStr);
renderLedger();
const card  = document.getElementById(‘ledger-editor-card’);
const label = document.getElementById(‘ledger-selected-date’);
const input = document.getElementById(‘ledger-amount-input’);
const d     = new Date(dateStr);
const existing = state.checkData?.[dateStr] || ‘’;
label.textContent = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 소비 입력`;
input.value = existing;
card.style.display = ‘block’;
setTimeout(()=>input.focus(), 80);
}

export function closeLedgerEditor() {
document.getElementById(‘ledger-editor-card’).style.display = ‘none’;
}

export function saveLedgerExpense() {
const dk  = renderModule._selectedLedgerDate || _currentSelectedLedgerDate;
if (!dk) return;
const amt = parseFloat(document.getElementById(‘ledger-amount-input’).value)||0;
if (!state.checkData) state.checkData={};
if (amt>0) state.checkData[dk]=amt;
else delete state.checkData[dk];
syncCheckDataToBalance(); save(); renderLedger(); renderHome();
if (document.getElementById(‘page-forecast’).classList.contains(‘active’)) renderForecast();
showBadge(‘✅ 가계부 저장됨’);
}

export function clearLedgerExpense() {
const dk = _currentSelectedLedgerDate;
if (!dk) return;
delete state.checkData?.[dk];
syncCheckDataToBalance(); save();
document.getElementById(‘ledger-amount-input’).value = ‘’;
renderLedger(); renderHome();
showBadge(‘🗑️ 가계부 삭제됨’);
}

// 내부 상태 (render.js와 공유 - 단순 변수)
let _currentSelectedLedgerDate = null;
function _setSelectedLedgerDate(dk) {
_currentSelectedLedgerDate = dk;
renderModule.selectedLedgerDate = dk;
}

// ── 데이터 관리 ────────────────────────────────────────
export function exportData() {
const blob = new Blob([JSON.stringify(state,null,2)],{type:‘application/json’});
const a = document.createElement(‘a’);
a.href = URL.createObjectURL(blob);
a.download = `cashflow_${dateKey(today())}.json`;
a.click();
}

export function importDataClick() { document.getElementById(‘import-file’).click(); }

export function importData(e) {
const file = e.target.files[0]; if (!file) return;
const reader = new FileReader();
reader.onload = ev => {
try { Object.assign(state, JSON.parse(ev.target.result)); save(); renderAll(); showBadge(‘✅ 가져오기 완료’); }
catch { alert(‘파일 형식 오류’); }
};
reader.readAsText(file);
}

export function resetAll() {
state.entries=[]; state.cardData={}; state.checkData={}; state.appliedCheckData={}; state.balance=0;
save(); applyTheme(); renderAll();
}

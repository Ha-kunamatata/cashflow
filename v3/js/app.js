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
  syncLedgerToBalance,
  migrateLedger,
  initDefaultData,
  ensureStateFields,
} from './state.js';

import {
  renderAll,
  renderForecast,
  renderCards,
  renderLedger,
  renderReport,
  renderGoals,
  renderAssets,
  renderBudget,
  renderReportCatModal,
  renderLedgerForecast,
  setLedgerForecastPeriod,
  shiftLedgerForecastMonth,
  setChartPeriod,
  setForecastFilter,
  setEntryFilter,
  changeLedgerMonth,
  setLedgerSubTab,
  setLedgerStatsTab,
  renderLedgerStats,
  renderHouseLevel,
  currentLedgerYear,
  currentLedgerMonth,
  renderWishlist,
  setWishFilter,
  renderFinance,
  refreshAllStocks,
  renderCardDefs,
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
  openLedgerDaySheet,
  closeLedgerDaySheet,
  openLedgerItemForm,
  closeLedgerItemForm,
  setLedgerItemType,
  selectLedgerCatGroup,
  selectLedgerCat,
  saveLedgerItem,
  deleteLedgerItem,
  deleteLedgerCurrentDayItem,
  saveSetting,
  onDangerLineChange,
  exportData,
  importDataClick,
  importData,
  resetAll,
  openGoalForm,
  saveGoal,
  deleteGoal,
  initGeminiKeyUI,
  saveGeminiKey,
  refreshHomeInsight,
  runLedgerAIAnalysis,
  openAIChat,
  sendAIChatMessage,
  // New functions
  openAssetForm,
  saveAsset,
  deleteAsset,
  openBudgetEditor,
  saveBudgetItem,
  changeBudgetMonth,
  getBudgetYear,
  getBudgetMonth,
  applyBudgetSuggestion,
  checkSalaryEvent,
  runBadgeCheck,
  openGoalJoinSheet,
  joinGoalByCode,
  generateGoalShareCode,
  // 카드 관리
  openCardForm,
  hideCardForm,
  saveCard,
  deleteCard,
  // 위시리스트
  openWishForm,
  hideWishForm,
  saveWishItem,
  deleteWishItem,
  toggleWishBought,
  // 워치리스트
  openWatchlistForm,
  hideWatchlistForm,
  saveWatchlistItem,
  deleteWatchlistItem,
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
    ensureStateFields();
    migrateLedger();
    syncLedgerToBalance();

    document.getElementById('setting-danger').value = state.dangerLine;
    document.getElementById('danger-line-input').value = state.dangerLine;

    applyTheme();
    renderAll();

    // AI 초기화
    initGeminiKeyUI();
    refreshHomeInsight();

    // 월급날 이벤트 & 배지 체크
    checkSalaryEvent();
    runBadgeCheck();

    // 예산 모듈 참조 등록 (render.js에서 year/month 접근용)
    window._budgetUiRef = { getBudgetYear, getBudgetMonth };

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
document.getElementById('btn-open-settings-page')?.addEventListener('click', () => navigate('settings'));

// 홈 예측 바로가기
document.getElementById('btn-home-forecast-link')?.addEventListener('click', () => navigate('forecast'));

// 잔고 숨기기/보이기 토글
// 기본값: 숨김 (명시적으로 '0' 저장 시에만 표시)
let _balHidden = localStorage.getItem('balanceHidden') !== '0';
function _applyBalanceVisibility() {
  const balEl = document.getElementById('balance-display');
  const maskEl = document.getElementById('balance-hidden-mask');
  const eyeOpen = document.getElementById('balance-eye-open');
  const eyeClosed = document.getElementById('balance-eye-closed');
  const topbarBal = document.getElementById('topbar-balance');
  if (!balEl) return;
  if (_balHidden) {
    balEl.style.display = 'none';
    if (maskEl) maskEl.style.display = '';
    if (eyeOpen) eyeOpen.style.display = 'none';
    if (eyeClosed) eyeClosed.style.display = '';
    if (topbarBal) topbarBal.textContent = '●●●';
  } else {
    balEl.style.display = '';
    if (maskEl) maskEl.style.display = 'none';
    if (eyeOpen) eyeOpen.style.display = '';
    if (eyeClosed) eyeClosed.style.display = 'none';
    // 잔고 복원: balEl에서 현재 텍스트 가져옴
    if (topbarBal) topbarBal.textContent = balEl.textContent || '-';
  }
}
window._applyBalanceVisibility = _applyBalanceVisibility;
document.getElementById('btn-toggle-balance')?.addEventListener('click', (e) => {
  e.stopPropagation();
  _balHidden = !_balHidden;
  localStorage.setItem('balanceHidden', _balHidden ? '1' : '0');
  _applyBalanceVisibility();
});

// 리포트 카테고리 팝업 모달
document.getElementById('report-cat-card')?.addEventListener('click', () => {
  const modal = document.getElementById('report-cat-modal');
  renderReportCatModal();
  if (modal) modal.classList.add('open');
});
document.getElementById('report-cat-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove('open');
  }
});
document.getElementById('btn-report-cat-modal-close')?.addEventListener('click', () => {
  document.getElementById('report-cat-modal')?.classList.remove('open');
});

// 바텀 탭
document.querySelectorAll('.nav-btn[data-page]').forEach((btn) => {
  btn.addEventListener('click', () => navigate(btn.dataset.page, btn));
});

// 항목 탭 서브탭 (고정항목 | 카드관리)
document.querySelectorAll('[data-entries-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-entries-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.entriesTab;
    const fixedPanel = document.getElementById('entries-panel-fixed');
    const cardsPanel = document.getElementById('entries-panel-cards');
    if (fixedPanel) fixedPanel.style.display = tab === 'fixed' ? '' : 'none';
    if (cardsPanel) cardsPanel.style.display = tab === 'cards' ? '' : 'none';
    if (tab === 'cards') renderCards();
  });
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
  if (day?.dataset.dk) openLedgerDaySheet(day.dataset.dk);
});

// 가계부 서브탭 (모두 인라인 — 예측도 페이지 이동 없이 표시)
document.querySelectorAll('#page-ledger .ledger-sub-tab').forEach(btn =>
  btn.addEventListener('click', () => setLedgerSubTab(btn.dataset.tab))
);

// 가계부 예측 뷰 기간 버튼
document.addEventListener('click', (e) => {
  const periodBtn = e.target.closest('[data-lf-period]');
  if (periodBtn && document.getElementById('ledger-view-forecast')?.contains(periodBtn)) {
    setLedgerForecastPeriod(parseInt(periodBtn.dataset.lfPeriod), periodBtn);
  }
});

// 예측 월 이동 버튼 (prev/next)
document.getElementById('btn-lf-month-prev')?.addEventListener('click', () => shiftLedgerForecastMonth(-1));
document.getElementById('btn-lf-month-next')?.addEventListener('click', () => shiftLedgerForecastMonth(1));

// 가계부 달력 월 이동
document.getElementById('btn-ledger-prev')?.addEventListener('click', () => changeLedgerMonth(-1));
document.getElementById('btn-ledger-next')?.addEventListener('click', () => changeLedgerMonth(1));

// 가계부 통계 월 이동
document.getElementById('btn-ledger-stats-prev')?.addEventListener('click', () => {
  changeLedgerMonth(-1);
  const lbl = document.getElementById('ledger-month-label-stats');
  import('./render.js').then(m => { if(lbl) lbl.textContent = document.getElementById('ledger-month-label')?.textContent || ''; });
});
document.getElementById('btn-ledger-stats-next')?.addEventListener('click', () => {
  changeLedgerMonth(1);
  const lbl = document.getElementById('ledger-month-label-stats');
  import('./render.js').then(m => { if(lbl) lbl.textContent = document.getElementById('ledger-month-label')?.textContent || ''; });
});
document.querySelectorAll('.ledger-stats-tab').forEach(btn =>
  btn.addEventListener('click', () => setLedgerStatsTab(btn.dataset.tab))
);

// 날짜 시트
document.getElementById('btn-ledger-day-close')?.addEventListener('click', closeLedgerDaySheet);
document.getElementById('ledger-day-sheet')?.addEventListener('click', (e) => {
  if (e.target?.id === 'ledger-day-sheet') closeLedgerDaySheet();
});
document.getElementById('btn-ledger-add-item')?.addEventListener('click', () =>
  openLedgerItemForm(null, null)
);
document.getElementById('ledger-day-items-list')?.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.lday-edit-btn');
  const delBtn  = e.target.closest('.lday-del-btn');
  if (editBtn?.dataset.id) openLedgerItemForm(null, editBtn.dataset.id);
  if (delBtn?.dataset.id)  deleteLedgerCurrentDayItem(delBtn.dataset.id);
});

// 항목 폼 시트
document.getElementById('ledger-type-expense')?.addEventListener('click', () => setLedgerItemType('expense'));
document.getElementById('ledger-type-income')?.addEventListener('click',  () => setLedgerItemType('income'));
document.getElementById('ledger-cat-groups')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.ledger-cat-group-btn');
  if (btn) selectLedgerCatGroup(btn.dataset.group);
});
document.getElementById('ledger-cat-chips')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.ledger-cat-chip');
  if (btn) selectLedgerCat(btn.dataset.cat);
});
document.getElementById('btn-ledger-item-save')?.addEventListener('click', saveLedgerItem);
document.getElementById('btn-ledger-item-cancel')?.addEventListener('click', closeLedgerItemForm);
document.getElementById('ledger-item-sheet')?.addEventListener('click', (e) => {
  if (e.target?.id === 'ledger-item-sheet') closeLedgerItemForm();
});

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

// 목표 탭
document.getElementById('btn-add-goal')?.addEventListener('click', () => openGoalForm(null));
document.getElementById('btn-goal-save')?.addEventListener('click', saveGoal);
document.getElementById('btn-goal-cancel')?.addEventListener('click', () => closeSheet('goal-sheet'));
document.getElementById('goal-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'goal-sheet'));

document.getElementById('goals-list')?.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.goal-edit-btn');
  const delBtn = e.target.closest('.goal-del-btn');
  const shareBtn = e.target.closest('.goal-share-btn');
  if (editBtn?.dataset.id) openGoalForm(editBtn.dataset.id);
  if (delBtn?.dataset.id) deleteGoal(delBtn.dataset.id);
  if (shareBtn?.dataset.shareId) generateGoalShareCode(shareBtn.dataset.shareId);
});

// 목표 공유
document.getElementById('btn-goal-join')?.addEventListener('click', openGoalJoinSheet);
document.getElementById('btn-goal-join-confirm')?.addEventListener('click', joinGoalByCode);
document.getElementById('btn-goal-join-cancel')?.addEventListener('click', () => closeSheet('goal-join-sheet'));
document.getElementById('goal-join-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'goal-join-sheet'));

// 자산 탭
document.getElementById('btn-add-asset')?.addEventListener('click', () => openAssetForm(null));
document.getElementById('btn-asset-save')?.addEventListener('click', saveAsset);
document.getElementById('btn-asset-cancel')?.addEventListener('click', () => closeSheet('asset-form-sheet'));
document.getElementById('asset-form-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'asset-form-sheet'));

document.getElementById('assets-page-content')?.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.asset-edit-btn');
  const delBtn  = e.target.closest('.asset-del-btn');
  if (editBtn?.dataset.id) openAssetForm(editBtn.dataset.id);
  if (delBtn?.dataset.id)  deleteAsset(delBtn.dataset.id);
});

// 예산 탭
document.getElementById('btn-budget-prev')?.addEventListener('click', () => changeBudgetMonth(-1));
document.getElementById('btn-budget-next')?.addEventListener('click', () => changeBudgetMonth(1));
document.getElementById('btn-budget-editor-save')?.addEventListener('click', saveBudgetItem);
document.getElementById('btn-budget-editor-cancel')?.addEventListener('click', () => closeSheet('budget-editor-sheet'));
document.getElementById('budget-editor-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'budget-editor-sheet'));

document.getElementById('budget-page-content')?.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.budget-cat-edit-btn');
  const suggestBtn = e.target.closest('#btn-budget-suggest');
  if (editBtn?.dataset.cat) openBudgetEditor(editBtn.dataset.cat);
  if (suggestBtn) applyBudgetSuggestion();
});

// AI 기능
document.getElementById('btn-save-gemini-key')?.addEventListener('click', saveGeminiKey);
document.getElementById('btn-ai-insight-refresh')?.addEventListener('click', refreshHomeInsight);
document.getElementById('btn-ledger-ai')?.addEventListener('click', runLedgerAIAnalysis);
document.getElementById('btn-ai-analysis-close')?.addEventListener('click', () => closeSheet('ai-analysis-sheet'));
document.getElementById('ai-analysis-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'ai-analysis-sheet'));

// 플로팅 채팅
document.getElementById('btn-ai-chat-fab')?.addEventListener('click', openAIChat);
document.getElementById('btn-ai-chat-close')?.addEventListener('click', () => closeSheet('ai-chat-sheet'));
document.getElementById('ai-chat-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'ai-chat-sheet'));
document.getElementById('btn-ai-chat-send')?.addEventListener('click', sendAIChatMessage);
document.getElementById('ai-chat-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendAIChatMessage();
});

// ══════════════════════════════════════════════════════════════
// 홈 요약 카드 클릭 → 관련 탭으로 이동
// ══════════════════════════════════════════════════════════════
document.querySelector('#page-home .summary-grid')?.addEventListener('click', (e) => {
  const item = e.target.closest('.summary-item[data-action]');
  if (!item) return;
  const action = item.dataset.action;
  if (action === 'entries-income' || action === 'entries-expense') {
    navigate('entries');
    setTimeout(() => {
      const filter = action === 'entries-income' ? '수입' : '지출';
      document.querySelector(`.filter-tab[data-entry-filter="${filter}"]`)?.click();
    }, 100);
  } else if (action === 'entries-halbu') {
    navigate('entries');
    setTimeout(() => document.querySelector('.filter-tab[data-entry-filter="할부"]')?.click(), 100);
  } else if (action === 'forecast') {
    navigate('forecast');
  } else if (action === 'ledger') {
    navigate('ledger');
  }
});

// ══════════════════════════════════════════════════════════════
// 인포 칩 클릭
// ══════════════════════════════════════════════════════════════
document.getElementById('balance-chips-row')?.addEventListener('click', (e) => {
  const chip = e.target.closest('.info-chip');
  if (!chip) return;
  const text = chip.textContent;
  if (text.includes('오늘')) {
    navigate('ledger');
  } else if (text.includes('월급')) {
    navigate('entries');
  } else if (text.includes('할부')) {
    navigate('entries');
    setTimeout(() => document.querySelector('.filter-tab[data-entry-filter="할부"]')?.click(), 100);
  }
});

// ══════════════════════════════════════════════════════════════
// 하우스 레벨 카드 상세 팝업
// ══════════════════════════════════════════════════════════════
function _renderHouseDetailSheet() {
  import('./assets.js').then(({ getTotalAssets, getHouseLevel, getAssetsByPurpose, ASSET_TYPES }) => {
    import('./utils.js').then(({ fmtFull, fmtShort }) => {
      import('./state.js').then(({ state: s }) => {
        const totalAssets = getTotalAssets(s.assets);
        const level = getHouseLevel(totalAssets);
        const pct = level.next && level.next > 0
          ? Math.min(100, Math.round((totalAssets / level.next) * 100))
          : 100;
        const byPurpose = getAssetsByPurpose(s.assets);

        const assetRows = (s.assets || []).map(a =>
          `<div class="detail-item-row">
            <div class="detail-item-label">${a.name || a.type || '자산'}</div>
            <div class="detail-item-value">${fmtFull(a.amount)}</div>
          </div>`
        ).join('');

        const purposeRows = Object.entries(byPurpose).map(([p, v]) =>
          `<div class="detail-item-row">
            <div class="detail-item-label">${p}</div>
            <div class="detail-item-value">${fmtShort(v)}</div>
          </div>`
        ).join('');

        const el = document.getElementById('house-detail-content');
        if (!el) return;
        el.innerHTML = `
          <div style="text-align:center;margin-bottom:16px">
            <div style="font-size:48px">${level.icon}</div>
            <div style="font-size:22px;font-weight:900;color:var(--text);margin-top:4px">${level.label}</div>
          </div>
          <div class="detail-item-row">
            <div class="detail-item-label">총 자산</div>
            <div class="detail-item-value" style="color:var(--green2)">${fmtFull(totalAssets)}</div>
          </div>
          ${level.next ? `
          <div class="detail-item-row">
            <div class="detail-item-label">다음 레벨</div>
            <div class="detail-item-value">${level.nextLabel} (${fmtShort(level.next)})</div>
          </div>
          <div class="detail-item-row">
            <div class="detail-item-label">달성률</div>
            <div class="detail-item-value">${pct}%</div>
          </div>
          <div style="height:8px;background:var(--bg3);border-radius:4px;margin:8px 0 16px">
            <div style="height:8px;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:4px;transition:width 0.5s"></div>
          </div>
          ` : '<div style="color:var(--yellow);text-align:center;padding:8px 0;font-weight:700">🏆 최고 레벨 달성!</div>'}
          ${purposeRows ? `<div style="font-size:12px;font-weight:700;color:var(--text2);margin:12px 0 4px">용도별 자산</div>${purposeRows}` : ''}
          ${assetRows ? `<div style="font-size:12px;font-weight:700;color:var(--text2);margin:12px 0 4px">자산 목록</div>${assetRows}` : ''}
        `;
      });
    });
  });
}

document.getElementById('page-home')?.addEventListener('click', (e) => {
  const card = e.target.closest('#house-level-card[data-house-detail]');
  if (!card) return;
  _renderHouseDetailSheet();
  openSheet('house-detail-sheet');
});
document.getElementById('btn-house-detail-close')?.addEventListener('click', () => closeSheet('house-detail-sheet'));
document.getElementById('house-detail-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'house-detail-sheet'));

// ══════════════════════════════════════════════════════════════
// 다가오는 입출금 행 클릭 → 상세 팝업
// ══════════════════════════════════════════════════════════════
function _showUpcomingDetail(row) {
  import('./forecast.js').then(({ buildForecast }) => {
    import('./state.js').then(({ state: s }) => {
      import('./utils.js').then(({ fmtFull, fmtShort, fmtSigned, p2, escapeHtml }) => {
        const fc = buildForecast(s);
        const upcoming = fc.slice(0, 30).filter(f => f.income > 0 || f.expense > 0);
        const idx = parseInt(row.dataset.forecastIdx, 10);
        const f = upcoming[idx];
        if (!f) return;

        const el = document.getElementById('upcoming-detail-content');
        if (!el) return;

        const dateStr = `${f.date.getFullYear()}년 ${f.date.getMonth() + 1}월 ${f.date.getDate()}일`;
        const eventRows = f.events.map(ev =>
          `<div class="detail-item-row">
            <div class="detail-item-label">${escapeHtml(ev.name)}</div>
            <div class="detail-item-value" style="color:${ev.type === 'income' ? 'var(--green2)' : 'var(--red2)'}">
              ${ev.type === 'income' ? '+' : '-'}${fmtFull(Math.abs(ev.amount || 0))}
            </div>
          </div>`
        ).join('');

        el.innerHTML = `
          <div class="detail-sheet-header">📅 ${dateStr}</div>
          ${f.income > 0 ? `<div class="detail-item-row"><div class="detail-item-label">총 수입</div><div class="detail-item-value" style="color:var(--green2)">+${fmtFull(f.income)}</div></div>` : ''}
          ${f.expense > 0 ? `<div class="detail-item-row"><div class="detail-item-label">총 지출</div><div class="detail-item-value" style="color:var(--red2)">-${fmtFull(f.expense)}</div></div>` : ''}
          <div class="detail-item-row"><div class="detail-item-label">예상 잔고</div><div class="detail-item-value">${fmtFull(f.balance)}</div></div>
          ${eventRows ? `<div style="font-size:12px;font-weight:700;color:var(--text2);margin:12px 0 4px">항목 상세</div>${eventRows}` : ''}
        `;
        openSheet('upcoming-detail-sheet');
      });
    });
  });
}

document.getElementById('upcoming-list')?.addEventListener('click', (e) => {
  const row = e.target.closest('.event-row[data-forecast-idx]');
  if (!row) return;
  _showUpcomingDetail(row);
});
document.getElementById('btn-upcoming-detail-close')?.addEventListener('click', () => closeSheet('upcoming-detail-sheet'));
document.getElementById('upcoming-detail-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'upcoming-detail-sheet'));

// ══════════════════════════════════════════════════════════════
// 달력 월 선택 (Month Picker)
// ══════════════════════════════════════════════════════════════
let _pickerYear = new Date().getFullYear();

function _renderMonthPicker() {
  const grid = document.getElementById('month-picker-grid');
  const yearDisplay = document.getElementById('mp-year-display');
  if (!grid || !yearDisplay) return;
  yearDisplay.textContent = _pickerYear;
  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const curYear = currentLedgerYear;
  const curMonth = currentLedgerMonth;
  grid.innerHTML = months.map((label, i) => {
    const isCurrent = _pickerYear === curYear && i === curMonth;
    return `<button class="month-picker-btn ${isCurrent ? 'current' : ''}" data-month="${i}">${label}</button>`;
  }).join('');
  grid.querySelectorAll('.month-picker-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = parseInt(btn.dataset.month, 10);
      // Navigate to chosen month in ledger
      import('./render.js').then(mod => {
        const diff = (_pickerYear - mod.currentLedgerYear) * 12 + (m - mod.currentLedgerMonth);
        changeLedgerMonth(diff);
      });
      closeSheet('month-picker-sheet');
    });
  });
}

function _openMonthPicker() {
  import('./render.js').then(mod => {
    _pickerYear = mod.currentLedgerYear;
    _renderMonthPicker();
    openSheet('month-picker-sheet');
  });
}

function _shiftPickerYear(delta) {
  _pickerYear += delta;
  _renderMonthPicker();
}

document.getElementById('btn-ledger-month-label')?.addEventListener('click', () => {
  _openMonthPicker();
});
document.getElementById('btn-month-picker-close')?.addEventListener('click', () => closeSheet('month-picker-sheet'));
document.getElementById('month-picker-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'month-picker-sheet'));
document.getElementById('btn-mp-year-prev')?.addEventListener('click', () => _shiftPickerYear(-1));
document.getElementById('btn-mp-year-next')?.addEventListener('click', () => _shiftPickerYear(1));

// ══════════════════════════════════════════════════════════════
// 카드 관리 이벤트
// ══════════════════════════════════════════════════════════════
document.getElementById('btn-add-card')?.addEventListener('click', () => openCardForm(null));
document.getElementById('card-form-save')?.addEventListener('click', saveCard);
document.getElementById('card-form-cancel')?.addEventListener('click', hideCardForm);
document.getElementById('card-form-overlay')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) hideCardForm();
});

// 카드 수정/삭제 (이벤트 위임)
document.getElementById('card-defs-list')?.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.card-def-edit-btn');
  const delBtn = e.target.closest('.card-def-del-btn');
  if (editBtn) openCardForm(editBtn.dataset.id);
  if (delBtn) deleteCard(delBtn.dataset.id);
});

// ══════════════════════════════════════════════════════════════
// 위시리스트 이벤트
// ══════════════════════════════════════════════════════════════
document.getElementById('btn-add-wish')?.addEventListener('click', () => openWishForm(null));
document.getElementById('wish-form-save')?.addEventListener('click', saveWishItem);
document.getElementById('wish-form-cancel')?.addEventListener('click', hideWishForm);
document.getElementById('wish-form-overlay')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) hideWishForm();
});

// 위시리스트 필터 탭
document.querySelectorAll('[data-wish-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-wish-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    setWishFilter(btn.dataset.wishFilter);
  });
});

// 위시 아이템 클릭 위임
document.getElementById('wish-list')?.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.wish-edit-btn');
  const delBtn = e.target.closest('.wish-del-btn');
  const buyBtn = e.target.closest('.wish-buy-btn');
  const unbuyBtn = e.target.closest('.wish-unbuy-btn');
  const linkBtn = e.target.closest('.wish-link-btn');

  if (editBtn) openWishForm(editBtn.dataset.id);
  if (delBtn) deleteWishItem(delBtn.dataset.id);
  if (buyBtn) toggleWishBought(buyBtn.dataset.id);
  if (unbuyBtn) toggleWishBought(unbuyBtn.dataset.id);
  if (linkBtn) {
    const url = linkBtn.dataset.url;
    if (url) window.open(url, '_blank', 'noopener');
  }
});

// ══════════════════════════════════════════════════════════════
// 재테크 (워치리스트) 이벤트
// ══════════════════════════════════════════════════════════════
document.getElementById('btn-add-watchlist')?.addEventListener('click', () => openWatchlistForm(null));
document.getElementById('watchlist-form-save')?.addEventListener('click', saveWatchlistItem);
document.getElementById('watchlist-form-cancel')?.addEventListener('click', hideWatchlistForm);
document.getElementById('watchlist-form-overlay')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) hideWatchlistForm();
});

document.getElementById('btn-finance-refresh')?.addEventListener('click', () => {
  refreshAllStocks();
});

// 워치리스트 카드 클릭 위임
document.getElementById('watchlist-container')?.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.watchlist-edit-btn');
  const delBtn = e.target.closest('.watchlist-del-btn');
  if (editBtn) openWatchlistForm(editBtn.dataset.symbol);
  if (delBtn) deleteWatchlistItem(delBtn.dataset.symbol);
});

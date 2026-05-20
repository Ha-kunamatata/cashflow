// ════════════════════════════════════════════════════════
// app.ts — 진입점. 이벤트 바인딩 & Firebase 초기화
// ════════════════════════════════════════════════════════
// @ts-nocheck
import './styles/style.css';

import {
  initAuth,
  signInWithGoogle,
  signOutUser,
  loadFromFirebase,
  startSync
} from './firebase';

import {
  state,
  load,
  save,
  syncLedgerToBalance,
  migrateLedger,
  initDefaultData,
  ensureStateFields,
  resetState,
} from './state';

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
  getWishSelectedIds,
  clearWishSelection,
  renderHouseholdSection,
  setSimCategory,
  updateSimResult,
  renderWeeklyCoachingCard,
  setTrendCategory,
  saveReportCard,
  renderHomeBudgetBars,
  renderHomeForecastWidget,
} from './render';

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
  selectLedgerTag,
  saveLedgerItem,
  deleteLedgerItem,
  deleteLedgerCurrentDayItem,
  saveSetting,
  onDangerLineChange,
  exportData,
  exportCsvData,
  importDataClick,
  importData,
  addQuickLedgerItem,
  resetAll,
  openGoalForm,
  saveGoal,
  deleteGoal,
  initGeminiKeyUI,
  saveGeminiKey,
  initAlphaVantageKey,
  saveAlphaVantageKey,
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
  createHouseholdUI,
  joinHouseholdUI,
  leaveHouseholdUI,
  copyHouseholdCode,
  // 빠른 입력 & OCR
  renderLedgerTemplates,
  useTemplate,
  saveCurrentAsTemplate,
  handleReceiptOCR,
  applyMemoSuggestion,
  getCatIcon,
  applyBudgetCarryover,
  convertWishToGoal,
} from './ui';

import { LEDGER_CAT_COLORS } from './config';

import {
  initRipple,
  showBadge,
  openSheet,
  closeSheet,
  closeSheetOutside,
  showLoading,
  hideLoading,
  fmtShort,
  escapeHtml,
} from './utils';

import { BADGE_DEFS, RARITY_CONFIG } from './streak';

// ── 리플 초기화 ────────────────────────────────────────
initRipple();

// ── 홈 풀-투-리프레시 ──────────────────────────────────
{
  let _ptr_startY = 0, _ptr_pulling = false, _ptr_indicator: HTMLElement | null = null;
  const _PTR_THRESHOLD = 68;

  function _getPtrEl() {
    if (!_ptr_indicator) {
      _ptr_indicator = document.createElement('div');
      _ptr_indicator.id = 'ptr-indicator';
      _ptr_indicator.innerHTML = '<div class="ptr-spinner"></div><span>새로고침</span>';
      document.body.appendChild(_ptr_indicator);
    }
    return _ptr_indicator;
  }

  document.addEventListener('touchstart', e => {
    const homePage = document.getElementById('page-home');
    if (!homePage?.classList.contains('active')) return;
    if (window.scrollY > 10) return;
    _ptr_startY = e.touches[0].clientY;
    _ptr_pulling = true;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!_ptr_pulling) return;
    const dy = e.touches[0].clientY - _ptr_startY;
    if (dy < 10) return;
    const pct = Math.min(1, dy / _PTR_THRESHOLD);
    const el = _getPtrEl();
    el.style.opacity = String(pct);
    el.style.transform = `translateY(${Math.min(dy * 0.4, 28)}px)`;
    el.classList.toggle('ready', dy >= _PTR_THRESHOLD);
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!_ptr_pulling) return;
    _ptr_pulling = false;
    const dy = e.changedTouches[0].clientY - _ptr_startY;
    const el = _getPtrEl();
    if (dy >= _PTR_THRESHOLD) {
      el.classList.add('refreshing');
      if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
      setTimeout(() => {
        renderAll();
        el.classList.remove('refreshing', 'ready');
        el.style.opacity = '0';
        el.style.transform = '';
      }, 700);
    } else {
      el.style.opacity = '0';
      el.style.transform = '';
      el.classList.remove('ready');
    }
  }, { passive: true });
}

// ══════════════════════════════════════════════════════════════
// 커스텀 테마 컬러
// ══════════════════════════════════════════════════════════════
const ACCENT_PRESETS = [
  { label: '인디고',  accent: '#6366f1', accent2: '#818cf8', key: 'indigo'  },
  { label: '블루',    accent: '#3b82f6', accent2: '#60a5fa', key: 'blue'    },
  { label: '바이올렛',accent: '#8b5cf6', accent2: '#a78bfa', key: 'violet'  },
  { label: '핑크',    accent: '#ec4899', accent2: '#f472b6', key: 'pink'    },
  { label: '에메랄드',accent: '#10b981', accent2: '#34d399', key: 'emerald' },
  { label: '앰버',    accent: '#f59e0b', accent2: '#fbbf24', key: 'amber'   },
  { label: '로즈',    accent: '#f43f5e', accent2: '#fb7185', key: 'rose'    },
  { label: '틸',      accent: '#14b8a6', accent2: '#2dd4bf', key: 'teal'    },
];

function applyAccentColor(preset) {
  document.documentElement.style.setProperty('--accent',  preset.accent);
  document.documentElement.style.setProperty('--accent2', preset.accent2);
  document.documentElement.style.setProperty('--accent3', preset.accent2 + '88');
  localStorage.setItem('accentPreset', preset.key);
  _renderAccentSwatches();
}

function _renderAccentSwatches() {
  const row = document.getElementById('accent-swatch-row');
  if (!row) return;
  const saved = localStorage.getItem('accentPreset') || 'blue';
  row.innerHTML = ACCENT_PRESETS.map(p => `
    <button class="accent-swatch ${p.key === saved ? 'active' : ''}"
      data-key="${p.key}"
      style="background:${p.accent};box-shadow:${p.key === saved ? `0 0 0 2px var(--bg), 0 0 0 4px ${p.accent}` : 'none'}"
      title="${p.label}"></button>
  `).join('');
}

{
  const saved = ACCENT_PRESETS.find(p => p.key === (localStorage.getItem('accentPreset') || 'blue'))
    || ACCENT_PRESETS.find(p => p.key === 'blue');
  if (saved) applyAccentColor(saved);
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.accent-swatch[data-key]');
  if (!btn) return;
  const preset = ACCENT_PRESETS.find(p => p.key === btn.dataset.key);
  if (preset) applyAccentColor(preset);
});

// ── 컨페티 애니메이션 ──────────────────────────────────
window.launchConfetti = function(duration = 3200) {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#a78bfa', '#34d399', '#fbbf24', '#60a5fa'];
  const particles = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 80,
    w: Math.random() * 9 + 4,
    h: Math.random() * 6 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 4 + 2,
    rot: Math.random() * 360,
    rotV: (Math.random() - 0.5) * 9,
    alpha: 1,
  }));
  const end = Date.now() + duration;
  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const now = Date.now();
    const ratio = Math.max(0, (end - now) / duration);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.rotV; p.vy += 0.06;
      p.alpha = Math.min(1, ratio * 3);
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (now < end) requestAnimationFrame(frame);
    else canvas.style.display = 'none';
  }
  requestAnimationFrame(frame);
};

// ── 로컬 알림 체크 ──────────────────────────────────────
const _NOTIF_CACHE_KEY = 'cashflow_notif_sent';
function _wasNotifSentToday(key: string): boolean {
  try {
    const d = JSON.parse(localStorage.getItem(_NOTIF_CACHE_KEY) || '{}');
    return d[key] === new Date().toDateString();
  } catch { return false; }
}
function _markNotifSent(key: string) {
  try {
    const d = JSON.parse(localStorage.getItem(_NOTIF_CACHE_KEY) || '{}');
    d[key] = new Date().toDateString();
    localStorage.setItem(_NOTIF_CACHE_KEY, JSON.stringify(d));
  } catch {}
}

async function _checkNotifications() {
  if (!('Notification' in window) || Notification.permission === 'denied') return;
  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission().catch(() => 'denied');
    if (perm !== 'granted') return;
  }
  if (Notification.permission !== 'granted') return;

  const [{ fmtShort, yyyymm, p2 }, { buildForecast }] = await Promise.all([
    import('./utils'),
    import('./forecast'),
  ]);
  const { getMonthBudget, getMonthActual } = await import('./budget');

  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);

  const send = (key: string, title: string, body: string) => {
    if (_wasNotifSentToday(key)) return;
    new Notification(title, { body, icon: '/favicon.ico' });
    _markNotifSent(key);
  };

  // 1. 월급 D-1
  const salaryEntry = state.entries.find(e => e.type === 'income' && e.repeat === '매월' && e.day);
  if (salaryEntry && tomorrow.getDate() === salaryEntry.day) {
    send('salary', '💰 내일 월급날!', `${salaryEntry.name} ${fmtShort(salaryEntry.amount)} 입금 예정`);
  }

  // 2. 예산 초과 경고 (80% 이상 소진 카테고리)
  const budget = getMonthBudget(state.budgets || {}, now.getFullYear(), now.getMonth());
  const actual = getMonthActual(state.ledgerData, now.getFullYear(), now.getMonth());
  const overCats = Object.entries(budget).filter(([cat, bgt]) => {
    const act = actual[cat] || 0;
    return bgt > 0 && act >= bgt * 0.8;
  });
  if (overCats.length > 0) {
    const names = overCats.slice(0, 2).map(([c]) => c).join(', ');
    const key = `budget_over_${now.getMonth()}`;
    const isExceeded = overCats.some(([cat, bgt]) => (actual[cat] || 0) >= bgt);
    if (isExceeded) {
      send(key + '_exceeded', '🚨 예산 초과!', `${names} 카테고리가 예산을 초과했어요`);
    } else {
      send(key + '_warn', '⚠️ 예산 80% 소진', `${names} 등 ${overCats.length}개 카테고리 주의`);
    }
  }

  // 3. 잔고 위험 예측 알림 (3일 이내)
  const fc = buildForecast(7);
  const soon = fc.slice(1, 4).find(f => f.balance < state.dangerLine && (f.income > 0 || f.expense > 0));
  if (soon) {
    const dayStr = `${soon.date.getMonth() + 1}/${p2(soon.date.getDate())}`;
    send('danger_soon', '⚠️ 잔고 위험 임박', `${dayStr} 잔고 ${fmtShort(soon.balance)} 위험선 이하 예상`);
  }

  // 4. 큰 지출 예정일 D-1 (5만원 이상)
  const bigTomorrow = fc[1];
  if (bigTomorrow && bigTomorrow.expense >= 50000) {
    const names = bigTomorrow.events.slice(0, 2).map(e => e.name).join(', ');
    send(`big_exp_${tomorrow.getDate()}`, '💳 내일 큰 지출 예정', `${fmtShort(bigTomorrow.expense)} — ${names}`);
  }

  // 5. 할부 종료 임박 (다음 달 마지막)
  const nextYm = yyyymm(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  const todayYm = yyyymm(now);
  const endingHalbu = state.entries.filter(
    e => e.type === 'expense' && e.category === '할부' && e.endMonth &&
      (parseInt(e.endMonth, 10) === todayYm || parseInt(e.endMonth, 10) === nextYm)
  );
  if (endingHalbu.length > 0) {
    send('halbu_end', '✅ 할부 종료 임박', `${endingHalbu.map(e => e.name).slice(0, 2).join(', ')} 등 ${endingHalbu.length}건 곧 종료`);
  }
}

// ── 스와이프로 항목 삭제 (가계부 날짜 시트) ────────────
(function _setupSwipeDelete() {
  let el = null, startX = 0, startY = 0, swiping = false;
  const container = document.getElementById('ledger-day-items-list');
  if (!container) return;

  container.addEventListener('touchstart', e => {
    const item = e.target.closest('.lday-item');
    if (!item) return;
    el = item; startX = e.touches[0].clientX; startY = e.touches[0].clientY; swiping = false;
    el.style.transition = 'none';
  }, { passive: true });

  container.addEventListener('touchmove', e => {
    if (!el) return;
    const dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (!swiping && dy > 10) { el = null; return; }
    if (dx < -5) swiping = true;
    if (swiping && dx < 0) {
      el.style.transform = `translateX(${Math.max(-76, dx)}px)`;
    }
  }, { passive: true });

  container.addEventListener('touchend', e => {
    if (!el) return;
    const dx = e.changedTouches[0].clientX - startX;
    el.style.transition = 'transform 0.22s ease';
    if (swiping && dx < -56) {
      const delBtn = el.querySelector('.lday-del-btn');
      el.style.transform = 'translateX(0)';
      if (delBtn) delBtn.click();
    } else {
      el.style.transform = 'translateX(0)';
    }
    el = null; swiping = false;
  });
})();

// ── Firebase 인증 상태 감지 ────────────────────────────
initAuth(
  async (user) => {
    // 로그인 성공
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('topbar').style.display = 'flex';
    document.getElementById('bottom-nav').style.display = 'flex';
    document.getElementById('fab-speed-dial').style.display = '';

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

    // 데이터 로드 (사용자 격리: 다른 계정이면 로컬 데이터 초기화)
    const prevUid = localStorage.getItem('cashflow_uid');
    if (prevUid !== user.uid) {
      // 다른 계정 → 이전 사용자의 로컬 데이터 + 메모리 상태 완전 초기화
      localStorage.removeItem('cashflow_v21');
      localStorage.removeItem('gemini_api_key');
      localStorage.setItem('cashflow_uid', user.uid);
      resetState();  // 메모리 상태도 빈 값으로 리셋
    }
    load();
    const cloud = await loadFromFirebase();

    if (cloud) {
      Object.assign(state, cloud);
      localStorage.setItem('cashflow_v21', JSON.stringify(state));
      // Gemini API 키: 클라우드 → 로컬 복원 (크로스 디바이스 동기화)
      if (state.geminiKey) localStorage.setItem('gemini_api_key', state.geminiKey);
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
    initAlphaVantageKey();
    refreshHomeInsight();

    // 월급날 이벤트 & 배지 체크
    checkSalaryEvent();
    runBadgeCheck();

    // 로컬 알림 체크 (비동기)
    _checkNotifications();

    // 예산 모듈 참조 등록 (render.js에서 year/month 접근용)
    window._budgetUiRef = { getBudgetYear, getBudgetMonth };

    // 실시간 동기화
    startSync((cloudData) => {
      const localTheme = state.theme; // 테마는 기기별 설정 유지
      Object.assign(state, cloudData);
      state.theme = localTheme;
      localStorage.setItem('cashflow_v21', JSON.stringify(state));
      if (state.geminiKey) localStorage.setItem('gemini_api_key', state.geminiKey);
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
    document.getElementById('fab-speed-dial').style.display = 'none';
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
document.getElementById('btn-topbar-home')?.addEventListener('click', () => {
  const homeBtn = document.querySelector('.nav-btn[data-page="home"]');
  navigate('home', homeBtn);
});

// 홈 예측 위젯은 renderHomeForecastWidget()에서 클릭 이벤트 등록

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
  btn.addEventListener('click', () => {
    navigate(btn.dataset.page, btn);
    if (btn.dataset.page === 'settings') { renderHouseholdSection(); _renderAccentSwatches(); }
  });
});

// 만약에 시뮬레이터
document.getElementById('sim-cat-chips')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-sim-cat]');
  if (btn) setSimCategory(btn.dataset.simCat);
});
document.getElementById('sim-slider')?.addEventListener('input', updateSimResult);

// 가계 공유 — 이벤트 위임 (내용이 동적으로 교체되므로)
document.getElementById('household-card')?.addEventListener('click', e => {
  if (e.target.id === 'btn-create-household' || e.target.closest('#btn-create-household')) createHouseholdUI();
  else if (e.target.id === 'btn-join-household' || e.target.closest('#btn-join-household')) joinHouseholdUI();
  else if (e.target.id === 'btn-leave-household' || e.target.closest('#btn-leave-household')) leaveHouseholdUI();
  else if (e.target.id === 'btn-copy-household-code') copyHouseholdCode();
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

// 홈 주간 날짜 스트립 — 날짜 탭 시 가계부로 이동
document.getElementById('home-week-strip')?.addEventListener('click', (e) => {
  const day = e.target.closest('.week-strip-day[data-dk]');
  if (!day) return;
  const dk = day.dataset.dk;
  const ledgerBtn = document.querySelector('.nav-btn[data-page="ledger"]');
  navigate('ledger', ledgerBtn);
  setTimeout(() => _toggleLedgerInlinePanel(dk), 280);
});

// 가계부 달력 이벤트 위임 — 인라인 패널 토글
document.getElementById('ledger-calendar-grid')?.addEventListener('click', (e) => {
  const day = e.target.closest('.ledger-day:not(.empty)');
  if (!day?.dataset.dk) return;
  _toggleLedgerInlinePanel(day.dataset.dk);
});

function _toggleLedgerInlinePanel(dk) {
  const panel = document.getElementById('ledger-day-inline-panel');
  if (!panel) { openLedgerDaySheet(dk); return; }

  const isSame = panel.dataset.activeDk === dk && panel.style.display !== 'none';
  if (isSame) {
    panel.style.display = 'none';
    panel.dataset.activeDk = '';
    return;
  }

  panel.dataset.activeDk = dk;
  _renderInlinePanel(dk);
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function _renderInlinePanel(dk) {
  const panel = document.getElementById('ledger-day-inline-panel');
  if (!panel) return;
  const d = new Date(dk);
  const items   = state.ledgerData?.[dk] || [];
  const expense = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
  const income  = items.filter(i => i.type === 'income' ).reduce((s, i) => s + i.amount, 0);

  const TAG_EMOJI = { '충동': '💸', '계획': '📋', '필수': '✅', '외식': '🍽️', '선물': '🎁' };
  const itemsHtml = items.length ? items.map(item => {
    const col  = LEDGER_CAT_COLORS[item.category] || '#64748b';
    const icon = getCatIcon(item.category);
    const sign = item.type === 'expense' ? '-' : '+';
    const amtCls = item.type === 'expense' ? 'red' : 'green';
    return `<div class="lday-card-wrap" data-id="${item.id}">
      <div class="lday-card-swipe-bg">🗑️ 삭제</div>
      <div class="lday-card" data-id="${item.id}">
        <div class="lday-card-icon-wrap" style="background:${col}18;border-color:${col}38;color:${col}">${icon}</div>
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
      </div>
    </div>`;
  }).join('') : `<div class="lday-empty-state">
    <div style="font-size:32px;margin-bottom:8px">📭</div>
    <div style="font-size:13px;font-weight:600;color:var(--text2);margin-bottom:4px">기록이 없어요</div>
    <div style="font-size:11px;color:var(--text3)">+ 버튼으로 추가해보세요</div>
  </div>`;

  // 카테고리 미니 요약
  const catAmts = {};
  items.forEach(item => {
    if (item.type === 'expense') catAmts[item.category] = (catAmts[item.category] || 0) + item.amount;
  });
  const topCats = Object.entries(catAmts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const catSummaryHtml = expense > 0 && topCats.length > 1 ? `
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
      ${topCats.map(([cat, amt]) => {
        const col = LEDGER_CAT_COLORS[cat] || '#64748b';
        const pct = Math.round((amt / expense) * 100);
        return `<div style="display:flex;align-items:center;gap:4px;background:${col}18;border-radius:8px;padding:3px 8px">
          <span style="width:6px;height:6px;border-radius:50%;background:${col};flex-shrink:0"></span>
          <span style="font-size:10px;font-weight:700;color:${col}">${escapeHtml(cat)}</span>
          <span style="font-size:10px;color:var(--text3)">${pct}%</span>
        </div>`;
      }).join('')}
    </div>` : '';

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0 8px;border-top:1px solid var(--border2);margin-top:10px">
      <div style="font-size:13px;font-weight:800;color:var(--text)">${d.getMonth() + 1}월 ${d.getDate()}일</div>
      <div style="display:flex;gap:12px;align-items:center">
        ${expense > 0 ? `<span style="font-size:11px;color:var(--red2);font-family:var(--mono)">-${fmtShort(expense)}</span>` : ''}
        ${income  > 0 ? `<span style="font-size:11px;color:var(--green2);font-family:var(--mono)">+${fmtShort(income)}</span>` : ''}
        <button class="icon-btn" id="btn-inline-add-item" data-dk="${dk}" style="width:28px;height:28px;background:var(--accent);border-radius:8px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>
    ${catSummaryHtml}
    <div id="inline-items-list">${itemsHtml}</div>`;

  panel.querySelector('#btn-inline-add-item')?.addEventListener('click', (e) => {
    openLedgerItemForm(e.currentTarget.dataset.dk, null);
  });
  panel.querySelectorAll('.lday-edit-btn').forEach(btn =>
    btn.addEventListener('click', () => openLedgerItemForm(dk, btn.dataset.id))
  );
  panel.querySelectorAll('.lday-del-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      if (confirm('삭제할까요?')) {
        deleteLedgerItem(dk, btn.dataset.id);
        _renderInlinePanel(dk);
      }
    })
  );

  const list = panel.querySelector('#inline-items-list');
  if (list) _initSwipeDelete(list, (id) => {
    deleteLedgerItem(dk, id);
    _renderInlinePanel(dk);
  });
}

function _initSwipeDelete(container, onDelete) {
  container.querySelectorAll('.lday-card-wrap').forEach(wrap => {
    const card = wrap.querySelector('.lday-card');
    if (!card) return;
    let startX = 0, startY = 0, dx = 0, tracking = false;

    wrap.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0; tracking = false;
      card.style.transition = 'none';
    }, { passive: true });

    wrap.addEventListener('touchmove', e => {
      const mx = e.touches[0].clientX - startX;
      const my = e.touches[0].clientY - startY;
      if (!tracking && Math.abs(my) > Math.abs(mx) + 4) return;
      tracking = true;
      dx = Math.min(0, mx);
      if (dx < 0) {
        e.preventDefault();
        const t = Math.max(-88, dx);
        card.style.transform = `translateX(${t}px)`;
        wrap.classList.toggle('swiping', t < -12);
      }
    }, { passive: false });

    wrap.addEventListener('touchend', () => {
      card.style.transition = '';
      if (dx < -52) {
        wrap.classList.add('swiped');
        wrap.classList.remove('swiping');
        if (navigator.vibrate) navigator.vibrate(50);
        setTimeout(() => onDelete(wrap.dataset.id), 380);
      } else {
        card.style.transform = '';
        wrap.classList.remove('swiping');
      }
    });
  });
}

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

// 달력 스와이프로 월 이동
{
  let _calSwipeX = 0, _calSwiping = false;
  const calView = document.getElementById('ledger-view-calendar');
  calView?.addEventListener('touchstart', e => {
    if ((e.target as Element).closest('.ledger-day[data-dk]')) return;
    _calSwipeX = e.touches[0].clientX;
    _calSwiping = true;
  }, { passive: true });
  calView?.addEventListener('touchend', e => {
    if (!_calSwiping) return;
    _calSwiping = false;
    const dx = e.changedTouches[0].clientX - _calSwipeX;
    if (Math.abs(dx) > 55) {
      changeLedgerMonth(dx < 0 ? 1 : -1);
      if (navigator.vibrate) navigator.vibrate(20);
    }
  }, { passive: true });
}

// 가계부 통계 월 이동 — renderLedgerStats() 가 내부에서 레이블을 직접 업데이트하므로 별도 조작 불필요
document.getElementById('btn-ledger-stats-prev')?.addEventListener('click', () => changeLedgerMonth(-1));
document.getElementById('btn-ledger-stats-next')?.addEventListener('click', () => changeLedgerMonth(1));
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
  const btn = e.target.closest('.calc-cat-group-tab');
  if (btn) selectLedgerCatGroup(btn.dataset.group);
});
document.getElementById('ledger-cat-chips')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.calc-cat-item');
  if (btn) selectLedgerCat(btn.dataset.cat);
});
document.getElementById('ledger-tag-row')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.ledger-tag-btn');
  if (btn) selectLedgerTag(btn.dataset.tag);
});
document.getElementById('btn-ledger-item-save')?.addEventListener('click', () => {
  saveLedgerItem();
  // 인라인 패널이 열려 있으면 갱신
  const panel = document.getElementById('ledger-day-inline-panel');
  const dk = panel?.dataset.activeDk;
  if (dk && panel?.style.display !== 'none') {
    setTimeout(() => _renderInlinePanel(dk), 80);
  }
});
document.getElementById('btn-ledger-item-cancel')?.addEventListener('click', closeLedgerItemForm);
document.getElementById('ledger-item-sheet')?.addEventListener('click', (e) => {
  if (e.target?.id === 'ledger-item-sheet') closeLedgerItemForm();
});

// 설정 탭
document.getElementById('btn-settings-signout')?.addEventListener('click', () => openSheet('signout-sheet'));
document.getElementById('setting-danger')?.addEventListener('change', (e) => saveSetting('dangerLine', e.target.value));
document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);
document.getElementById('btn-export')?.addEventListener('click', exportData);
document.getElementById('btn-export-csv')?.addEventListener('click', exportCsvData);
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
  const carryoverBtn = e.target.closest('#btn-budget-carryover');
  if (editBtn?.dataset.cat) openBudgetEditor(editBtn.dataset.cat);
  if (suggestBtn) applyBudgetSuggestion();
  if (carryoverBtn && !carryoverBtn.disabled) applyBudgetCarryover();
});

// AI 기능
document.getElementById('btn-save-report-card')?.addEventListener('click', saveReportCard);
document.getElementById('btn-coaching-refresh')?.addEventListener('click', () => renderWeeklyCoachingCard(true));
document.getElementById('btn-save-gemini-key')?.addEventListener('click', saveGeminiKey);
document.getElementById('btn-gemini-help')?.addEventListener('click', () => {
  const panel = document.getElementById('gemini-help-panel');
  const btn = document.getElementById('btn-gemini-help');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (btn) btn.style.background = open ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.28)';
});
document.getElementById('btn-save-alpha-key')?.addEventListener('click', saveAlphaVantageKey);
document.getElementById('btn-ai-insight-refresh')?.addEventListener('click', () => refreshHomeInsight(true));
document.getElementById('btn-ai-insight-expand')?.addEventListener('click', () => openSheet('ai-insight-full-sheet'));
document.getElementById('btn-ai-insight-full-close')?.addEventListener('click', () => closeSheet('ai-insight-full-sheet'));
document.getElementById('ai-insight-full-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'ai-insight-full-sheet'));
document.getElementById('btn-ledger-ai')?.addEventListener('click', runLedgerAIAnalysis);
document.getElementById('btn-ai-analysis-close')?.addEventListener('click', () => closeSheet('ai-analysis-sheet'));
document.getElementById('ai-analysis-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'ai-analysis-sheet'));

// 플로팅 채팅 (구 btn-ai-chat-fab → 스피드 다이얼로 이동)
document.getElementById('btn-ai-chat-close')?.addEventListener('click', () => closeSheet('ai-chat-sheet'));
document.getElementById('ai-chat-sheet')?.addEventListener('click', (e) => closeSheetOutside(e, 'ai-chat-sheet'));
document.getElementById('btn-ai-chat-send')?.addEventListener('click', sendAIChatMessage);
document.getElementById('ai-chat-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendAIChatMessage();
});

// ── 재정 건강 점수 카드 → 분석 탭 이동 ──────────────────────
document.getElementById('health-score-mini')?.addEventListener('click', () => {
  const btn = document.querySelector('.nav-btn[data-page="report"]');
  navigate('report', btn);
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
// 인포 칩 클릭 — 상세 시트 오픈
// ══════════════════════════════════════════════════════════════
document.getElementById('balance-chips-row')?.addEventListener('click', (e) => {
  const chip = e.target.closest('.info-chip[data-chip]');
  if (!chip) return;
  const type = chip.dataset.chip;
  if (type === 'today') _showTodayDetailSheet();
  else if (type === 'salary') _showSalaryDetailSheet();
  else if (type === 'halbu') { navigate('entries'); setTimeout(() => document.querySelector('.filter-tab[data-entry-filter="할부"]')?.click(), 100); }
  else if (type === 'space') _showSpaceDetailSheet();
});

function _showTodayDetailSheet() {
  import('./state').then(({ state: s }) => {
    import('./utils').then(({ fmtShort, dateKey }) => {
      const dk = dateKey(new Date());
      const items = s.ledgerData?.[dk] || [];
      const totalExp = items.filter(i=>i.type==='expense').reduce((a,i)=>a+i.amount,0);
      const totalInc = items.filter(i=>i.type==='income').reduce((a,i)=>a+i.amount,0);
      const rows = items.length ? items.map(i=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
          <div><div style="font-size:13px;font-weight:700;color:var(--text)">${i.memo||'(메모 없음)'}</div>
          <div style="font-size:11px;color:var(--text3)">${i.category||''}</div></div>
          <div style="font-family:var(--mono);font-size:14px;font-weight:800;color:${i.type==='income'?'var(--green2)':'var(--red2)'}">${i.type==='income'?'+':'-'}${fmtShort(i.amount)}</div>
        </div>`).join('')
        : '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">오늘 기록된 항목이 없습니다</div>';
      const el = document.getElementById('today-detail-content');
      if (!el) return;
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
          <div style="padding:10px;border-radius:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);text-align:center">
            <div style="font-size:10px;color:var(--red2);font-weight:700">오늘 지출</div>
            <div style="font-family:var(--mono);font-size:18px;font-weight:900;color:var(--text);margin-top:4px">${fmtShort(totalExp)}</div>
          </div>
          <div style="padding:10px;border-radius:10px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);text-align:center">
            <div style="font-size:10px;color:var(--green2);font-weight:700">오늘 수입</div>
            <div style="font-family:var(--mono);font-size:18px;font-weight:900;color:var(--text);margin-top:4px">${fmtShort(totalInc)}</div>
          </div>
        </div>
        ${rows}
        <button class="btn btn-ghost" onclick="window._nav?.('ledger')" style="width:100%;margin-top:12px;border-radius:10px;font-weight:700">📅 가계부로 이동 →</button>`;
      openSheet('today-detail-sheet');
    });
  });
}

function _showSalaryDetailSheet() {
  import('./state').then(({ state: s }) => {
    import('./utils').then(({ fmtShort }) => {
      const now = new Date();
      const incomeEntries = (s.entries||[]).filter(e=>e.type==='income'&&e.repeat==='매월');
      const totalMonthly = incomeEntries.reduce((a,e)=>a+e.amount,0);
      let nextSalary = '', daysLeft = 0;
      if (incomeEntries.length > 0) {
        const days = incomeEntries.map(e=>e.day).filter(Boolean).sort((a,b)=>a-b);
        const todayDay = now.getDate();
        const nextDay = days.find(d=>d>todayDay) || days[0];
        if (nextDay > todayDay) { daysLeft = nextDay - todayDay; nextSalary = `이번달 ${nextDay}일`; }
        else { const nm = new Date(now.getFullYear(),now.getMonth()+1,nextDay); daysLeft=Math.ceil((nm-now)/86400000); nextSalary=`다음달 ${nextDay}일`; }
      }
      const rows = incomeEntries.map(e=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
          <div><div style="font-size:13px;font-weight:700;color:var(--text)">${e.name}</div>
          <div style="font-size:11px;color:var(--text3)">매월 ${e.day}일 · ${e.category||'수입'}</div></div>
          <div style="font-family:var(--mono);font-size:14px;font-weight:800;color:var(--green2)">+${fmtShort(e.amount)}</div>
        </div>`).join('');
      const el = document.getElementById('salary-detail-content');
      if (!el) return;
      el.innerHTML = `
        <div style="text-align:center;padding:12px 0 16px">
          <div style="font-size:40px">💰</div>
          <div style="font-size:22px;font-weight:900;color:var(--green2);margin-top:6px">${fmtShort(totalMonthly)}</div>
          <div style="font-size:12px;color:var(--text3)">월 총 수입</div>
          ${nextSalary?`<div style="margin-top:10px;padding:8px 14px;border-radius:10px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);display:inline-block"><div style="font-size:11px;color:var(--text3)">다음 수입일</div><div style="font-size:15px;font-weight:900;color:var(--green2)">${nextSalary} · D-${daysLeft}</div></div>`:''}
        </div>
        ${rows||'<div style="text-align:center;padding:20px;color:var(--text3)">등록된 수입 항목이 없습니다</div>'}
        <button class="btn btn-ghost" onclick="window._nav?.('entries')" style="width:100%;margin-top:12px;border-radius:10px;font-weight:700">📋 항목 관리 →</button>`;
      openSheet('salary-detail-sheet');
    });
  });
}

function _showSpaceDetailSheet() {
  import('./state').then(({ state: s }) => {
    import('./utils').then(({ fmtShort }) => {
      import('./forecast').then(({ buildForecast }) => {
        const fc = buildForecast(60);
        const now = new Date();
        const monthEnd = new Date(now.getFullYear(),now.getMonth()+1,0);
        const daysLeft = Math.ceil((monthEnd-now)/86400000);
        const monthlyIncome=(s.entries||[]).filter(e=>e.type==='income'&&e.repeat==='매월').reduce((a,e)=>a+e.amount,0);
        const monthlyExpense=(s.entries||[]).filter(e=>e.type==='expense'&&e.repeat==='매월').reduce((a,e)=>a+e.amount,0);
        const remaining=monthlyIncome-monthlyExpense;
        const dangerDays=fc.filter(f=>f.balance<s.dangerLine).length;
        const minBalance=Math.min(...fc.map(f=>f.balance));
        const fcEnd=fc.find(f=>f.date.getMonth()===now.getMonth()&&f.date.getDate()===monthEnd.getDate());
        const el=document.getElementById('space-detail-content');
        if(!el) return;
        el.innerHTML=`
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
            <div style="padding:10px;border-radius:10px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);text-align:center">
              <div style="font-size:10px;color:var(--accent2);font-weight:700">월 순이익</div>
              <div style="font-family:var(--mono);font-size:16px;font-weight:900;color:${remaining>=0?'var(--green2)':'var(--red2)'};margin-top:4px">${remaining>=0?'+':''}${fmtShort(remaining)}</div>
            </div>
            <div style="padding:10px;border-radius:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);text-align:center">
              <div style="font-size:10px;color:var(--red2);font-weight:700">위험 예측일</div>
              <div style="font-family:var(--mono);font-size:16px;font-weight:900;color:var(--text);margin-top:4px">${dangerDays}일</div>
            </div>
            <div style="padding:10px;border-radius:10px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);text-align:center">
              <div style="font-size:10px;color:var(--green2);font-weight:700">이달말 잔고</div>
              <div style="font-family:var(--mono);font-size:16px;font-weight:900;color:var(--text);margin-top:4px">${fcEnd?fmtShort(fcEnd.balance):'-'}</div>
            </div>
            <div style="padding:10px;border-radius:10px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);text-align:center">
              <div style="font-size:10px;color:var(--yellow);font-weight:700">최저 예측</div>
              <div style="font-family:var(--mono);font-size:16px;font-weight:900;color:${minBalance<s.dangerLine?'var(--red2)':'var(--text)'};margin-top:4px">${fmtShort(minBalance)}</div>
            </div>
          </div>
          <div style="padding:10px 12px;border-radius:10px;background:var(--bg3);border:1px solid var(--border);margin-bottom:10px;font-size:11px;color:var(--text2);line-height:1.8">
            📅 이달 남은 기간: <strong style="color:var(--text)">${daysLeft}일</strong><br>
            💚 월 수입: <strong style="color:var(--green2)">${fmtShort(monthlyIncome)}</strong> / 💸 월 지출: <strong style="color:var(--red2)">${fmtShort(monthlyExpense)}</strong><br>
            ${dangerDays>0?`⚠️ <strong style="color:var(--orange)">${dangerDays}일</strong> 위험선 이하 예측`:`✅ 60일 내 위험선 이하 예측 없음`}
          </div>
          <button class="btn btn-ghost" onclick="window._nav?.('forecast')" style="width:100%;border-radius:10px;font-weight:700">📈 상세 예측 보기 →</button>`;
        openSheet('space-detail-sheet');
      });
    });
  });
}

// ══════════════════════════════════════════════════════════════
// 하우스 레벨 카드 상세 팝업
// ══════════════════════════════════════════════════════════════
function _renderHouseDetailSheet() {
  import('./assets').then(({ getTotalAssets, getHouseLevel, HOUSE_LEVELS }) => {
    import('./utils').then(({ fmtShort }) => {
      import('./state').then(({ state: s }) => {
        const totalAssets = getTotalAssets(s.assets);
        const level = getHouseLevel(totalAssets);
        const pct = level.next && level.next > 0
          ? Math.min(100, Math.round((totalAssets / level.next) * 100))
          : 100;

        const el = document.getElementById('house-detail-content');
        if (!el) return;

        const allLevels = HOUSE_LEVELS.map((l, i) => {
          const isActive = i === level.index;
          const isPast = i < level.index;
          const needed = l.min <= totalAssets ? '달성!' : fmtShort(l.min - totalAssets) + ' 필요';
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;margin-bottom:6px;
              background:${isActive ? l.color + '18' : isPast ? 'rgba(255,255,255,0.03)' : 'transparent'};
              border:1px solid ${isActive ? l.color + '44' : 'var(--border)'};opacity:${isPast ? 0.75 : 1}">
              <div style="font-size:${isActive ? 30 : 20}px;line-height:1;min-width:32px;text-align:center;filter:${isPast||isActive?'none':'grayscale(1) opacity(0.35)'}">${l.icon}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;flex-wrap:wrap">
                  <span style="font-size:${isActive?14:12}px;font-weight:${isActive?900:700};color:${isActive?l.color:isPast?'var(--text2)':'var(--text3)'}">${l.label}</span>
                  <span style="font-size:8px;padding:1px 5px;border-radius:4px;font-weight:800;background:${l.color}22;color:${l.color}">${l.sublabel}</span>
                  ${isPast ? '<span style="font-size:9px;color:#10b981;font-weight:700">✓ 달성</span>' : ''}
                  ${isActive ? '<span style="font-size:9px;color:var(--accent2);font-weight:800">◀ 현재</span>' : ''}
                </div>
                <div style="font-size:9px;color:var(--text3)">${l.min > -Infinity ? fmtShort(l.min) : '0'}${l.max < Infinity ? ` ~ ${fmtShort(l.max)}` : '+'} · ${needed}</div>
                ${isActive && level.next ? `<div style="margin-top:4px;height:3px;background:var(--bg3);border-radius:2px"><div style="height:3px;width:${pct}%;background:${l.color};border-radius:2px"></div></div>` : ''}
              </div>
            </div>`;
        }).join('');

        el.innerHTML = `
          <div style="text-align:center;padding:12px 0 16px">
            <div style="font-size:52px;filter:drop-shadow(0 4px 12px ${level.color}88)">${level.icon}</div>
            <div style="font-size:22px;font-weight:900;color:${level.color};margin-top:6px">${level.label}</div>
            <div style="font-size:11px;color:var(--text3)">${level.sublabel} · 순자산 ${fmtShort(totalAssets)}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:8px;line-height:1.7;white-space:pre-line;word-break:keep-all">${level.desc}</div>
            <div style="margin-top:10px;padding:8px 12px;border-radius:10px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2)">
              <div style="font-size:10px;color:var(--accent2);font-weight:700">💡 ${level.tip}</div>
            </div>
            ${level.bonus !== '없음' ? `<div style="margin-top:8px;padding:7px 12px;border-radius:10px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2)"><div style="font-size:10px;color:#10b981;font-weight:700">🏆 ${level.bonus}</div></div>` : ''}
          </div>
          <div style="font-size:12px;font-weight:900;color:var(--text);margin-bottom:8px;padding:0 2px">📊 전체 레벨 로드맵 (${level.index+1}/${HOUSE_LEVELS.length})</div>
          ${allLevels}
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
  import('./forecast').then(({ buildForecast }) => {
    import('./state').then(({ state: s }) => {
      import('./utils').then(({ fmtFull, fmtShort, fmtSigned, p2, escapeHtml }) => {
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
      import('./render').then(mod => {
        const diff = (_pickerYear - mod.currentLedgerYear) * 12 + (m - mod.currentLedgerMonth);
        changeLedgerMonth(diff);
      });
      closeSheet('month-picker-sheet');
    });
  });
}

function _openMonthPicker() {
  import('./render').then(mod => {
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
document.getElementById('wish-form-overlay')?.addEventListener('click', (e) => closeSheetOutside(e, 'wish-form-overlay'));

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
  const toGoalBtn = e.target.closest('.wish-to-goal-btn');

  if (editBtn) openWishForm(editBtn.dataset.id);
  if (delBtn) deleteWishItem(delBtn.dataset.id);
  if (buyBtn) toggleWishBought(buyBtn.dataset.id);
  if (unbuyBtn) toggleWishBought(unbuyBtn.dataset.id);
  if (toGoalBtn) convertWishToGoal(toGoalBtn.dataset.id);
  if (linkBtn) {
    const url = linkBtn.dataset.url;
    if (url) window.open(url, '_blank', 'noopener');
  }
});

// ══════════════════════════════════════════════════════════════
// 위시리스트 드래그 순서 변경 + 다중선택 분석
// ══════════════════════════════════════════════════════════════
let _dragSrcId = null;

document.getElementById('wish-list')?.addEventListener('dragstart', (e) => {
  const card = e.target.closest('.wish-card[data-id]');
  if (!card) return;
  _dragSrcId = card.dataset.id;
  card.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
});

document.getElementById('wish-list')?.addEventListener('dragend', (e) => {
  const card = e.target.closest('.wish-card[data-id]');
  if (card) card.style.opacity = '';
  _dragSrcId = null;
  document.querySelectorAll('.wish-card').forEach(c => c.classList.remove('drag-over'));
});

document.getElementById('wish-list')?.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.target.closest('.wish-card[data-id]');
  document.querySelectorAll('.wish-card').forEach(c => c.classList.remove('drag-over'));
  if (card && card.dataset.id !== _dragSrcId) card.classList.add('drag-over');
});

document.getElementById('wish-list')?.addEventListener('drop', (e) => {
  e.preventDefault();
  const targetCard = e.target.closest('.wish-card[data-id]');
  if (!targetCard || !_dragSrcId || targetCard.dataset.id === _dragSrcId) return;
  targetCard.classList.remove('drag-over');

  const wishlist = state.wishlist || [];
  const srcIdx = wishlist.findIndex(w => w.id === _dragSrcId);
  const tgtIdx = wishlist.findIndex(w => w.id === targetCard.dataset.id);
  if (srcIdx === -1 || tgtIdx === -1) return;

  const [moved] = wishlist.splice(srcIdx, 1);
  wishlist.splice(tgtIdx, 0, moved);
  state.wishlist = wishlist;
  save();
  renderWishlist();
});

// 체크박스 변경 → 바 업데이트 (이벤트 위임)
document.getElementById('wish-list')?.addEventListener('change', (e) => {
  if (e.target.classList.contains('wish-checkbox')) {
    const bar = document.getElementById('wish-multiselect-bar');
    const checked = document.querySelectorAll('.wish-checkbox:checked');
    const count = checked.size ?? checked.length;
    const countEl = document.getElementById('wish-select-count');
    if (countEl) countEl.textContent = count > 0 ? `${count}개 선택됨` : '항목을 선택하세요';
    if (bar) bar.style.display = count > 0 ? 'flex' : 'none';
  }
});

// 다중선택 분석 버튼
document.getElementById('btn-wish-multianalyze')?.addEventListener('click', async () => {
  const checked = [...document.querySelectorAll('.wish-checkbox:checked')].map(cb => cb.dataset.id);
  if (!checked.length) return;

  const { escapeHtml, fmtShort } = await import('./utils');
  const { buildForecast } = await import('./forecast');

  const items = (state.wishlist || []).filter(w => checked.includes(w.id));
  const totalPrice = items.reduce((s, w) => s + Number(w.price || 0), 0);
  const canAffordAll = state.balance >= totalPrice;

  const fc = buildForecast(365);
  let safeDate = null;
  for (const f of fc) {
    if (f.balance >= totalPrice) { safeDate = f.date; break; }
  }
  const safeDateStr = safeDate
    ? `${safeDate.getMonth()+1}/${safeDate.getDate()} 구매 가능`
    : '1년 내 구매 불가';

  const balAfter = state.balance - totalPrice;
  const content = document.getElementById('wish-analyze-content');
  if (content) {
    content.innerHTML = `
      <div style="text-align:center;padding:16px 0;margin-bottom:16px;border-bottom:1px solid var(--border)">
        <div style="font-size:13px;color:var(--text3);margin-bottom:6px">선택한 ${items.length}개 항목 합계</div>
        <div style="font-size:30px;font-weight:900;font-family:var(--mono);color:var(--red2)">-${fmtShort(totalPrice)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div style="background:var(--bg3);border-radius:12px;padding:12px;text-align:center">
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px">현재 잔고</div>
          <div style="font-size:16px;font-weight:800;color:var(--text);font-family:var(--mono)">${fmtShort(state.balance)}</div>
        </div>
        <div style="background:var(--bg3);border-radius:12px;padding:12px;text-align:center">
          <div style="font-size:10px;color:var(--text3);margin-bottom:4px">구매 후 잔고</div>
          <div style="font-size:16px;font-weight:800;color:${balAfter >= 0 ? 'var(--green2)' : 'var(--red2)'};font-family:var(--mono)">${balAfter >= 0 ? fmtShort(balAfter) : `-${fmtShort(Math.abs(balAfter))}`}</div>
        </div>
      </div>
      <div style="background:${canAffordAll ? 'rgba(16,185,129,0.1)' : 'rgba(249,115,22,0.1)'};border:1px solid ${canAffordAll ? 'rgba(16,185,129,0.3)' : 'rgba(249,115,22,0.3)'};border-radius:12px;padding:14px;margin-bottom:16px;text-align:center">
        <div style="font-size:17px;font-weight:900;color:${canAffordAll ? 'var(--green2)' : 'var(--orange)'}">
          ${canAffordAll ? '✅ 지금 모두 구매 가능!' : '⏳ 잔고 부족'}
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px">${safeDateStr}</div>
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:8px">선택 항목 목록</div>
      ${items.map(w => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:13px;color:var(--text);flex:1">${escapeHtml(w.name)}</span>
        <span style="font-size:13px;font-weight:700;color:var(--red2);font-family:var(--mono)">${w.price ? fmtShort(Number(w.price)) : '-'}</span>
      </div>`).join('')}
    `;
  }
  openSheet('wish-analyze-sheet');
});

document.getElementById('btn-wish-clearselect')?.addEventListener('click', () => {
  document.querySelectorAll('.wish-checkbox').forEach(cb => { cb.checked = false; });
  const bar = document.getElementById('wish-multiselect-bar');
  if (bar) bar.style.display = 'none';
  clearWishSelection();
});

// ══════════════════════════════════════════════════════════════
// 재테크 (워치리스트) 이벤트
// ══════════════════════════════════════════════════════════════
document.getElementById('btn-add-watchlist')?.addEventListener('click', () => openWatchlistForm(null));
document.getElementById('watchlist-form-save')?.addEventListener('click', saveWatchlistItem);
document.getElementById('watchlist-form-cancel')?.addEventListener('click', hideWatchlistForm);
document.getElementById('watchlist-form-overlay')?.addEventListener('click', (e) => closeSheetOutside(e, 'watchlist-form-overlay'));

document.getElementById('btn-finance-refresh')?.addEventListener('click', () => {
  refreshAllStocks(true);
});

// 워치리스트 카드 클릭 위임
document.getElementById('watchlist-container')?.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.watchlist-edit-btn');
  const delBtn = e.target.closest('.watchlist-del-btn');
  if (editBtn) openWatchlistForm(editBtn.dataset.symbol);
  if (delBtn) deleteWatchlistItem(delBtn.dataset.symbol);
});

// ══════════════════════════════════════════════════════════════
// 배지 카테고리 필터
// ══════════════════════════════════════════════════════════════
document.getElementById('assets-page-content')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.badge-filter-btn');
  if (!btn) return;
  const cat = btn.dataset.cat;
  document.querySelectorAll('.badge-filter-btn').forEach(b => {
    const isActive = b.dataset.cat === cat;
    b.classList.toggle('active', isActive);
    b.style.background = isActive ? 'var(--accent)' : 'var(--bg3)';
    b.style.color = isActive ? '#fff' : 'var(--text2)';
  });
  document.querySelectorAll('#badge-grid-main .badge-item').forEach(item => {
    item.style.display = (cat === '전체' || item.dataset.badgeCat === cat) ? '' : 'none';
  });
});

// ══════════════════════════════════════════════════════════════
// 배지 도감 팝업
// ══════════════════════════════════════════════════════════════
document.getElementById('assets-page-content')?.addEventListener('click', (e) => {
  const item = e.target.closest('.badge-item[data-badge-id]');
  if (!item) return;
  openBadgeDetail(item.dataset.badgeId);
});

function openBadgeDetail(badgeId) {
  const b = BADGE_DEFS.find(x => x.id === badgeId);
  if (!b) return;
  const earned = (state.badges || []).includes(b.id);
  const r = RARITY_CONFIG[b.rarity] || RARITY_CONFIG.common;

  document.getElementById('badge-detail-icon').textContent = b.icon;
  document.getElementById('badge-detail-label').textContent = b.label;
  document.getElementById('badge-detail-desc').textContent = b.desc;
  document.getElementById('badge-detail-cat').textContent = `# ${b.category}`;

  const chip = document.getElementById('badge-detail-rarity-chip');
  chip.textContent = r.label;
  chip.style.background = r.bg;
  chip.style.color = r.color;
  chip.style.border = `1px solid ${r.border}`;

  const iconWrap = document.getElementById('badge-detail-icon-wrap');
  iconWrap.style.background = earned ? r.bg : 'rgba(100,116,139,0.12)';
  iconWrap.style.borderColor = earned ? r.border : 'rgba(100,116,139,0.2)';
  iconWrap.style.boxShadow = earned && r.glow ? `0 0 32px ${r.color}66` : 'none';
  // restart animation
  iconWrap.style.animation = 'none';
  requestAnimationFrame(() => { iconWrap.style.animation = 'badgeIconPop 0.55s cubic-bezier(0.34,1.56,0.64,1)'; });

  const statusEl = document.getElementById('badge-detail-status');
  if (earned) {
    statusEl.textContent = '✅ 획득 완료!';
    statusEl.style.background = `${r.bg}`;
    statusEl.style.color = r.color;
    statusEl.style.border = `1px solid ${r.border}`;
  } else {
    statusEl.textContent = `🔒 미획득 — ${b.desc}`;
    statusEl.style.background = 'rgba(100,116,139,0.08)';
    statusEl.style.color = 'var(--text3)';
    statusEl.style.border = '1px solid rgba(100,116,139,0.2)';
  }

  const glow = document.getElementById('badge-detail-glow');
  glow.style.background = earned ? `radial-gradient(ellipse at 50% 0%, ${r.color}22 0%, transparent 70%)` : 'none';

  // 파티클 (legendary + earned만)
  const particles = document.getElementById('badge-detail-particles');
  particles.innerHTML = '';
  if (earned && b.rarity === 'legendary') {
    _spawnBadgeParticles(particles, r.color);
  }

  openSheet('badge-detail-overlay');
}

function _spawnBadgeParticles(container, color) {
  const shapes = ['●', '★', '◆', '▲', '✦'];
  const colors = [color, '#fbbf24', '#f472b6', '#34d399', '#60a5fa'];
  for (let i = 0; i < 22; i++) {
    const el = document.createElement('div');
    const size = 8 + Math.random() * 10;
    const x = 10 + Math.random() * 80;
    const delay = Math.random() * 0.8;
    const dur = 1.0 + Math.random() * 0.8;
    const anim = Math.random() > 0.5 ? 'badgeParticleFall' : 'badgeParticleFloat';
    el.textContent = shapes[Math.floor(Math.random() * shapes.length)];
    el.style.cssText = `position:absolute;left:${x}%;top:${10 + Math.random() * 40}%;font-size:${size}px;color:${colors[i % colors.length]};opacity:0.9;animation:${anim} ${dur}s ease ${delay}s both;pointer-events:none`;
    container.appendChild(el);
  }
}

window.closeBadgeDetail = function() {
  closeSheet('badge-detail-overlay');
};

// 상세 시트 닫기 버튼
['today','salary','space'].forEach(type => {
  document.getElementById(`btn-${type}-detail-close`)?.addEventListener('click', () => closeSheet(`${type}-detail-sheet`));
  document.getElementById(`${type}-detail-sheet`)?.addEventListener('click', (e) => closeSheetOutside(e, `${type}-detail-sheet`));
});

// 시트 내부 navigate 버튼용 글로벌 핸들러
window._nav = (page) => navigate(page);

// 홈 최근 거래 빠른 추가 버튼 이벤트 델리게이션
document.getElementById('home-recent-tx')?.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest('.btn-quick-add');
  if (!btn) return;
  e.stopPropagation();
  try {
    const item = JSON.parse((btn as HTMLElement).dataset.item || '{}');
    if (item.amount) addQuickLedgerItem(item);
  } catch (_) {}
});

// ══════════════════════════════════════════════════════════════
// 스피드 다이얼 FAB
// ══════════════════════════════════════════════════════════════
(function _setupSpeedDial() {
  const dial     = document.getElementById('fab-speed-dial');
  const backdrop = document.getElementById('fab-backdrop');
  if (!dial) return;

  function _todayKey() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function openDial()  { dial.classList.add('open');    backdrop.style.display = 'block'; }
  function closeDial() { dial.classList.remove('open'); backdrop.style.display = 'none'; }
  function toggleDial() { dial.classList.contains('open') ? closeDial() : openDial(); }

  document.getElementById('btn-fab-main')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDial();
  });

  document.getElementById('btn-fab-ledger')?.addEventListener('click', () => {
    closeDial();
    openLedgerItemForm(_todayKey(), null);
  });

  document.getElementById('btn-fab-chat')?.addEventListener('click', () => {
    closeDial();
    openAIChat();
  });

  backdrop.addEventListener('click', closeDial);
})();

// ══════════════════════════════════════════════════════════════
// 가계부 항목 폼 — 템플릿 · 저장 · OCR
// ══════════════════════════════════════════════════════════════
document.getElementById('ledger-templates-chips')?.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-tpl-id]');
  if (chip) useTemplate(chip.dataset.tplId);
});

document.getElementById('btn-save-template')?.addEventListener('click', saveCurrentAsTemplate);

document.getElementById('btn-receipt-ocr')?.addEventListener('click', () => {
  document.getElementById('receipt-photo-input')?.click();
});

document.getElementById('receipt-photo-input')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleReceiptOCR(file);
  e.target.value = '';
});

// ══════════════════════════════════════════════════════════════
// 리포트 탭 — 카테고리 트렌드 칩 이벤트 위임
// ══════════════════════════════════════════════════════════════
document.getElementById('report-cat-trend-chips')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.ledger-tag-btn');
  if (btn?.dataset.cat) setTrendCategory(btn.dataset.cat);
});

// ══════════════════════════════════════════════════════════════
// 전체 검색
// ══════════════════════════════════════════════════════════════
(function _setupSearch() {
  const overlay    = document.getElementById('search-overlay');
  const input      = document.getElementById('search-input');
  const results    = document.getElementById('search-results');
  const clearBtn   = document.getElementById('btn-search-clear');
  const closeBtn   = document.getElementById('btn-search-close');
  const openBtn    = document.getElementById('btn-open-search');
  const filterBar  = document.getElementById('search-filter-bar');
  if (!overlay) return;

  let _activeFilter = 'all';

  filterBar?.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('.search-filter-chip') as HTMLElement;
    if (!chip) return;
    _activeFilter = chip.dataset.sf || 'all';
    filterBar.querySelectorAll('.search-filter-chip').forEach(c => c.classList.toggle('active', c === chip));
    _renderResults(input.value);
  });

  function openSearch() {
    overlay.style.display = 'flex';
    setTimeout(() => input.focus(), 80);
    _renderResults('');
  }
  function closeSearch() {
    overlay.style.display = 'none';
    input.value = '';
    clearBtn.style.display = 'none';
    _activeFilter = 'all';
    filterBar?.querySelectorAll('.search-filter-chip').forEach((c, i) => c.classList.toggle('active', i === 0));
  }

  function highlight(text, query) {
    if (!query) return escapeHtml(text);
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return escapeHtml(text);
    return escapeHtml(text.slice(0, idx))
      + `<mark class="search-result-mark">${escapeHtml(text.slice(idx, idx + query.length))}</mark>`
      + escapeHtml(text.slice(idx + query.length));
  }

  const TAG_FILTER_MAP = { impulse: '충동', plan: '계획', essential: '필수' };

  function _renderResults(query) {
    const q = query.trim().toLowerCase();
    const allItems = [];

    for (const [dk, entries] of Object.entries(state.ledgerData || {})) {
      for (const item of entries) {
        const catMatch  = item.category?.toLowerCase().includes(q);
        const memoMatch = item.memo?.toLowerCase().includes(q);
        const amtMatch  = String(item.amount).includes(q);
        const dateMatch = dk.includes(q);
        if (!q || catMatch || memoMatch || amtMatch || dateMatch) {
          // Apply filter
          if (_activeFilter === 'expense' && item.type !== 'expense') continue;
          if (_activeFilter === 'income' && item.type !== 'income') continue;
          const tagFilter = TAG_FILTER_MAP[_activeFilter];
          if (tagFilter && item.tag !== tagFilter) continue;
          allItems.push({ dk, item });
        }
      }
    }

    allItems.sort((a, b) => b.dk.localeCompare(a.dk));
    const slice = allItems.slice(0, 120);

    if (!slice.length) {
      results.innerHTML = `<div class="search-empty">${q ? '검색 결과가 없어요' : '가계부에 기록된 내역이 없어요'}<br><span style="font-size:20px;margin-top:8px;display:block">🔍</span></div>`;
      return;
    }

    // 날짜별 그룹
    const groups = {};
    slice.forEach(({ dk, item }) => {
      if (!groups[dk]) groups[dk] = [];
      groups[dk].push(item);
    });

    const now = new Date();
    const _p2 = n => String(n).padStart(2, '0');
    const todayDk = `${now.getFullYear()}-${_p2(now.getMonth()+1)}-${_p2(now.getDate())}`;
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    const yestDk = `${yest.getFullYear()}-${_p2(yest.getMonth()+1)}-${_p2(yest.getDate())}`;

    results.innerHTML = Object.entries(groups).map(([dk, dayItems]) => {
      const d = new Date(dk);
      const dateLabel = dk === todayDk ? '오늘' : dk === yestDk ? '어제'
        : `${d.getMonth()+1}월 ${d.getDate()}일`;
      const dayExp = dayItems.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
      const dayInc = dayItems.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);

      const cardsHtml = dayItems.map(item => {
        const col = LEDGER_CAT_COLORS[item.category] || '#64748b';
        const icon = getCatIcon(item.category);
        const sign = item.type === 'expense' ? '-' : '+';
        const amtColor = item.type === 'expense' ? 'var(--red2)' : 'var(--green2)';
        return `<div class="search-result-card" data-dk="${dk}">
          <div class="search-result-icon" style="background:${col}18;color:${col}">${icon}</div>
          <div class="search-result-info">
            <div class="search-result-cat">${highlight(item.category || '', query)}</div>
            ${item.memo ? `<div class="search-result-memo">${highlight(item.memo, query)}</div>` : ''}
          </div>
          <div class="search-result-amt" style="color:${amtColor}">${sign}${fmtShort(item.amount)}</div>
        </div>`;
      }).join('');

      return `<div class="search-date-header">
          <span class="search-date-label">${dateLabel}</span>
          <span class="search-date-total">${dayExp > 0 ? `<span style="color:var(--red2)">-${fmtShort(dayExp)}</span>` : ''}${dayInc > 0 ? `<span style="color:var(--green2)"> +${fmtShort(dayInc)}</span>` : ''}</span>
        </div>${cardsHtml}`;
    }).join('');
  }

  let _debounceTimer;
  input.addEventListener('input', () => {
    const q = input.value;
    clearBtn.style.display = q ? 'flex' : 'none';
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => _renderResults(q), 140);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    _renderResults('');
    input.focus();
  });

  results.addEventListener('click', (e) => {
    const row = e.target.closest('[data-dk]');
    if (!row) return;
    const dk = row.dataset.dk;
    closeSearch();
    // 기록 탭으로 이동 후 해당 날짜 열기
    const ledgerBtn = document.querySelector('.nav-btn[data-page="ledger"]');
    navigate('ledger', ledgerBtn);
    setTimeout(() => _toggleLedgerInlinePanel(dk), 280);
  });

  openBtn?.addEventListener('click', openSearch);
  closeBtn?.addEventListener('click', closeSearch);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.style.display !== 'none') closeSearch();
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
  });
})();

// ══════════════════════════════════════════════════════════════
// 스마트 메모 자동완성
// ══════════════════════════════════════════════════════════════
(function _setupMemoSuggestions() {
  const memoInput = document.getElementById('ledger-item-memo');
  const sugBox    = document.getElementById('memo-suggestions');
  if (!memoInput || !sugBox) return;

  function _getMemoHistory() {
    const history = [];
    const seen = new Set();
    const data = state.ledgerData || {};
    // 최근 90일 데이터에서 메모 수집 (최신순)
    const keys = Object.keys(data).sort().reverse().slice(0, 90);
    for (const dk of keys) {
      for (const item of (data[dk] || [])) {
        if (!item.memo || !item.memo.trim()) continue;
        const key = `${item.memo}::${item.category}::${item.type}`;
        if (!seen.has(key)) {
          seen.add(key);
          history.push({ memo: item.memo.trim(), category: item.category, type: item.type });
        }
        if (history.length >= 200) return history;
      }
    }
    return history;
  }

  function _showSuggestions(q) {
    const hist = _getMemoHistory();
    const query = q.trim().toLowerCase();
    const matches = query
      ? hist.filter(h => h.memo.toLowerCase().includes(query)).slice(0, 5)
      : hist.slice(0, 5);

    if (!matches.length) { sugBox.innerHTML = ''; return; }

    sugBox.innerHTML = matches.map((h, i) =>
      `<button class="memo-sug-chip" data-idx="${i}" type="button">${escapeHtml(h.memo)}<span class="memo-sug-cat">${escapeHtml(h.category || '')}</span></button>`
    ).join('');

    sugBox.querySelectorAll('.memo-sug-chip').forEach((btn, i) => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        applyMemoSuggestion(matches[i]);
        sugBox.innerHTML = '';
      });
    });
  }

  let _memoTimer;
  memoInput.addEventListener('input', () => {
    clearTimeout(_memoTimer);
    _memoTimer = setTimeout(() => _showSuggestions(memoInput.value), 120);
  });

  memoInput.addEventListener('focus', () => {
    _showSuggestions(memoInput.value);
  });

  memoInput.addEventListener('blur', () => {
    setTimeout(() => { sugBox.innerHTML = ''; }, 200);
  });
})();

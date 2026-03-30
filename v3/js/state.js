// ════════════════════════════════════════════════════════
// state.js — 앱 상태 관리 / 저장 / 로드
// ════════════════════════════════════════════════════════
import { STORAGE_KEY } from './config.js';
import { uid, isPastOrToday } from './utils.js';

// 기본 카드 정의 (커스터마이즈 가능)
export const DEFAULT_CARDS = [
  { id: 'hyundai', name: '현대카드', color: '#3b82f6', payDay: 1 },
  { id: 'kookmin', name: '국민카드', color: '#f97316', payDay: 3 },
];

export const state = {
  balance: 0,
  dangerLine: 100000,
  entries: [],
  cards: null,          // [{ id, name, color, payDay }] — null이면 DEFAULT_CARDS 사용
  cardData: {},         // { YYYYMM: { [card.id]: amount } }
  checkData: {},        // 구버전 호환용 (ledgerData로 마이그레이션됨)
  ledgerData: {},       // { YYYY-MM-DD: [{ id, type, category, amount, memo }] }
  appliedCheckData: {}, // 잔고에 이미 반영된 내역 (날짜별 순지출)
  goals: [],
  theme: 'dark',
  assets: [],           // 자산 목록
  budgets: {},          // { "YYYY-MM": { "category": amount } }
  badges: [],           // earned badge ids
  streak: { count: 0, lastDate: '' },
  wishlist: [],         // [{ id, name, price, url, priority, targetDate, notes, category, bought }]
  watchlist: [],        // [{ id, symbol, name, market, buyPrice, quantity, note }]
  geminiKey: '',        // Gemini API 키 (크로스 디바이스 동기화용)
};

// ── 상태 완전 초기화 (계정 전환 시 메모리 상태 리셋) ──
export function resetState() {
  state.balance           = 0;
  state.dangerLine        = 100000;
  state.entries           = [];
  state.cards             = null;
  state.cardData          = {};
  state.checkData         = {};
  state.ledgerData        = {};
  state.appliedCheckData  = {};
  state.goals             = [];
  state.theme             = 'dark';
  state.assets            = [];
  state.budgets           = {};
  state.badges            = [];
  state.streak            = { count: 0, lastDate: '' };
  state.wishlist          = [];
  state.watchlist         = [];
  state.geminiKey         = '';
}

// ── 저장 ──────────────────────────────────────────────
export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}

  if (window.firebaseReady && window.saveToFirebase) {
    window.saveToFirebase(JSON.parse(JSON.stringify(state)));
  }
}

// ── 상태 유효성 검사 ──────────────────────────────────
function validateState(d) {
  if (typeof d !== 'object' || d === null || Array.isArray(d)) return false;
  if ('balance'          in d && typeof d.balance !== 'number') return false;
  if ('dangerLine'       in d && typeof d.dangerLine !== 'number') return false;
  if ('entries'          in d && !Array.isArray(d.entries)) return false;
  if ('goals'            in d && !Array.isArray(d.goals)) return false;
  if ('cardData'         in d && (typeof d.cardData !== 'object' || Array.isArray(d.cardData))) return false;
  if ('ledgerData'       in d && (typeof d.ledgerData !== 'object' || Array.isArray(d.ledgerData))) return false;
  if ('appliedCheckData' in d && (typeof d.appliedCheckData !== 'object' || Array.isArray(d.appliedCheckData))) return false;
  if ('assets'   in d && !Array.isArray(d.assets))   return false;
  if ('badges'   in d && !Array.isArray(d.badges))   return false;
  if ('budgets'  in d && (typeof d.budgets  !== 'object' || Array.isArray(d.budgets)))  return false;
  if ('streak'   in d && (typeof d.streak   !== 'object' || Array.isArray(d.streak)))   return false;
  return true;
}

// ── 로드 ──────────────────────────────────────────────
export function load() {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    if (d) {
      const parsed = JSON.parse(d);
      if (validateState(parsed)) Object.assign(state, parsed);
    }
  } catch (e) {}
  // 누락 필드 보완 (구버전 데이터 호환)
  if (!state.wishlist)  state.wishlist  = [];
  if (!state.watchlist) state.watchlist = [];
}

// ── checkData → ledgerData 마이그레이션 ───────────────
export function migrateLedger() {
  if (!state.ledgerData) state.ledgerData = {};
  if (!state.checkData)  state.checkData  = {};

  const hasLedger = Object.keys(state.ledgerData).length > 0;
  if (hasLedger) return; // 이미 마이그레이션됨

  for (const [dk, amount] of Object.entries(state.checkData)) {
    const amt = Number(amount);
    if (amt > 0) {
      state.ledgerData[dk] = [{
        id: uid(),
        type: 'expense',
        category: '기타',
        amount: amt,
        memo: '',
      }];
    }
  }
}

// ── 가계부 → 잔고 반영 ────────────────────────────────
// 날짜별 (지출합계 - 수입합계) = 순지출을 잔고에 반영
// appliedCheckData[dk] = 이미 반영된 순지출
export function syncLedgerToBalance() {
  if (!state.appliedCheckData) state.appliedCheckData = {};
  if (!state.ledgerData)       state.ledgerData       = {};

  const allKeys = new Set([
    ...Object.keys(state.ledgerData),
    ...Object.keys(state.appliedCheckData),
  ]);

  for (const dk of allKeys) {
    const items   = state.ledgerData[dk] || [];
    const expense = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
    const income  = items.filter(i => i.type === 'income' ).reduce((s, i) => s + i.amount, 0);
    const raw     = expense - income; // 순지출 (양수 = 잔고 감소)

    const applied = Number(state.appliedCheckData[dk] || 0);
    const target  = isPastOrToday(dk) ? raw : 0;
    const delta   = target - applied;

    if (delta !== 0) state.balance -= delta;

    if (target !== 0) state.appliedCheckData[dk] = target;
    else              delete state.appliedCheckData[dk];
  }
}

// 구버전 호환 (app.js가 아직 이 이름을 사용하는 경우를 위한 alias)
export { syncLedgerToBalance as syncCheckDataToBalance };

// ── state 필드 초기화 (누락 필드 보완) ────────────────
export function ensureStateFields() {
  if (!state.goals)     state.goals     = [];
  if (!state.checkData) state.checkData = {};
  if (!state.ledgerData) state.ledgerData = {};
  if (!state.assets)    state.assets    = [];
  if (!state.budgets)   state.budgets   = {};
  if (!state.badges)    state.badges    = [];
  if (!state.streak)    state.streak    = { count: 0, lastDate: '' };
  if (!state.wishlist)  state.wishlist  = [];
  if (!state.watchlist) state.watchlist = [];
  if (!state.cards)     state.cards     = null; // null = DEFAULT_CARDS
}

// ── 기본 데이터 (첫 실행 시) ──────────────────────────
// 신규 유저는 완전히 빈 상태로 시작 (개인 데이터 없음)
export function initDefaultData() {
  ensureStateFields();
  // 아무것도 주입하지 않음 — 새 유저는 빈 화면에서 시작
}

// ════════════════════════════════════════════════════════
// state.ts — 앱 상태 관리 / 저장 / 로드
// ════════════════════════════════════════════════════════
import { STORAGE_KEY } from './config';
import { uid, isPastOrToday } from './utils';
import type { Entry, Card, LedgerData, LedgerItem, Goal, Asset, BudgetMap, WishItem, WatchlistItem, LedgerTemplate } from './types';

declare global {
  interface Window {
    firebaseReady?: boolean;
    saveToFirebase?: (data: unknown) => void;
    currentUser?: unknown;
  }
}

export interface StateShape {
  balance: number;
  dangerLine: number;
  entries: Entry[];
  cards: Card[] | null;
  cardData: Record<string, Record<string, number>>;
  checkData: Record<string, unknown>;
  ledgerData: LedgerData;
  appliedCheckData: Record<string, number>;
  goals: Goal[];
  theme: 'dark' | 'light';
  assets: Asset[];
  budgets: BudgetMap;
  badges: string[];
  streak: { count: number; lastDate: string };
  wishlist: WishItem[];
  watchlist: WatchlistItem[];
  geminiKey: string;
  alphaVantageKey: string;
  ledgerTemplates: LedgerTemplate[];
  netWorthHistory: { ym: number; total: number }[];
  lastSeenMonth: number;
  budgetCarryover: Record<string, number>;
}

export const DEFAULT_CARDS: Card[] = [];

export const state: StateShape = {
  balance: 0,
  dangerLine: 100000,
  entries: [],
  cards: null,
  cardData: {},
  checkData: {},
  ledgerData: {},
  appliedCheckData: {},
  goals: [],
  theme: 'dark',
  assets: [],
  budgets: {},
  badges: [],
  streak: { count: 0, lastDate: '' },
  wishlist: [],
  watchlist: [],
  geminiKey: '',
  alphaVantageKey: '',
  ledgerTemplates: [],
  netWorthHistory: [],
  lastSeenMonth: 0,
  budgetCarryover: {},
};

// ── 상태 완전 초기화 (계정 전환 시 메모리 상태 리셋) ──
export function resetState(): void {
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
  state.alphaVantageKey   = '';
  state.ledgerTemplates   = [];
  state.netWorthHistory   = [];
  state.lastSeenMonth     = 0;
  state.budgetCarryover   = {};
}

// ── 저장 ──────────────────────────────────────────────
export function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}

  if (window.firebaseReady && window.saveToFirebase) {
    window.saveToFirebase(JSON.parse(JSON.stringify(state)));
  }
}

// ── 상태 유효성 검사 ──────────────────────────────────
function validateState(d: unknown): d is Partial<StateShape> {
  if (typeof d !== 'object' || d === null || Array.isArray(d)) return false;
  const o = d as Record<string, unknown>;
  if ('balance'          in o && typeof o.balance !== 'number') return false;
  if ('dangerLine'       in o && typeof o.dangerLine !== 'number') return false;
  if ('entries'          in o && !Array.isArray(o.entries)) return false;
  if ('goals'            in o && !Array.isArray(o.goals)) return false;
  if ('cardData'         in o && (typeof o.cardData !== 'object' || Array.isArray(o.cardData))) return false;
  if ('ledgerData'       in o && (typeof o.ledgerData !== 'object' || Array.isArray(o.ledgerData))) return false;
  if ('appliedCheckData' in o && (typeof o.appliedCheckData !== 'object' || Array.isArray(o.appliedCheckData))) return false;
  if ('assets'   in o && !Array.isArray(o.assets))   return false;
  if ('badges'   in o && !Array.isArray(o.badges))   return false;
  if ('budgets'  in o && (typeof o.budgets  !== 'object' || Array.isArray(o.budgets)))  return false;
  if ('streak'   in o && (typeof o.streak   !== 'object' || Array.isArray(o.streak)))   return false;
  return true;
}

// ── 로드 ──────────────────────────────────────────────
export function load(): void {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    if (d) {
      const parsed: unknown = JSON.parse(d);
      if (validateState(parsed)) Object.assign(state, parsed);
    }
  } catch (_) {}
  if (!state.wishlist)        state.wishlist        = [];
  if (!state.watchlist)       state.watchlist       = [];
  if (!state.ledgerTemplates) state.ledgerTemplates = [];
  if (!state.netWorthHistory) state.netWorthHistory = [];
  if (!state.budgetCarryover) state.budgetCarryover = {};
  if (!state.lastSeenMonth)   state.lastSeenMonth   = 0;
}

// ── checkData → ledgerData 마이그레이션 ───────────────
export function migrateLedger(): void {
  if (!state.ledgerData) state.ledgerData = {};
  if (!state.checkData)  state.checkData  = {};

  const hasLedger = Object.keys(state.ledgerData).length > 0;
  if (hasLedger) return;

  for (const [dk, amount] of Object.entries(state.checkData)) {
    const amt = Number(amount);
    if (amt > 0) {
      state.ledgerData[dk] = [{
        id: uid(),
        type: 'expense',
        category: '기타',
        amount: amt,
        memo: '',
      } as LedgerItem];
    }
  }
}

// ── 가계부 → 잔고 반영 ────────────────────────────────
export function syncLedgerToBalance(): void {
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
    const raw     = expense - income;

    const applied = Number(state.appliedCheckData[dk] || 0);
    const target  = isPastOrToday(dk) ? raw : 0;
    const delta   = target - applied;

    if (delta !== 0) state.balance -= delta;

    if (target !== 0) state.appliedCheckData[dk] = target;
    else              delete state.appliedCheckData[dk];
  }
}

export { syncLedgerToBalance as syncCheckDataToBalance };

// ── state 필드 초기화 (누락 필드 보완) ────────────────
export function ensureStateFields(): void {
  if (!state.goals)           state.goals           = [];
  if (!state.checkData)       state.checkData       = {};
  if (!state.ledgerData)      state.ledgerData      = {};
  if (!state.assets)          state.assets          = [];
  if (!state.budgets)         state.budgets         = {};
  if (!state.badges)          state.badges          = [];
  if (!state.streak)          state.streak          = { count: 0, lastDate: '' };
  if (!state.wishlist)        state.wishlist        = [];
  if (!state.watchlist)       state.watchlist       = [];
  if (!state.cards)           state.cards           = null;
  if (!state.netWorthHistory) state.netWorthHistory = [];
  if (!state.budgetCarryover) state.budgetCarryover = {};
}

export function initDefaultData(): void {
  ensureStateFields();
}

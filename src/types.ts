// ════════════════════════════════════════════════════════
// types.ts — 앱 전체에서 사용되는 핵심 데이터 모델
// ════════════════════════════════════════════════════════

export type EntryType = 'income' | 'expense';

/** 고정 수입/지출 항목 (매월 반복 또는 1회) */
export interface Entry {
  id: string;
  type: EntryType;
  category: string;
  name: string;
  amount: number;
  date?: string; // 'YYYY-MM-DD' (1회성 항목)
  repeat?: '매월' | '1회';
  day?: number; // 매월 며칠 (repeat='매월')
  endMonth?: string; // 'YYYYMM' — 할부 종료월
  cardId?: string; // 카드 결제 항목인 경우
  memo?: string;
}

/** 가계부 일별 항목 */
export interface LedgerItem {
  id: string;
  type: EntryType;
  category: string;
  amount: number;
  memo?: string;
  tag?: string | null;
}

/** 가계부 데이터: { 'YYYY-MM-DD': LedgerItem[] } */
export type LedgerData = Record<string, LedgerItem[]>;

/** 저장된 가계부 템플릿 */
export interface LedgerTemplate {
  id: string;
  type: EntryType;
  category: string;
  amount: number;
  memo?: string;
  tag?: string | null;
}

/** 카드 정의 */
export interface Card {
  id: string;
  name: string;
  payDay: number; // 결제일 (매월 며칠)
  color?: string;
}

/** 자산 항목 */
export interface Asset {
  id: string;
  type: string; // ASSET_TYPES key
  purpose: string; // ASSET_PURPOSES key
  name: string;
  amount: number;
  symbol?: string; // 주식/코인 심볼
  shares?: number; // 보유 수량
  buyPrice?: number; // 매입가
  rate?: number; // 이자율
  maturity?: string; // 만기일 'YYYY-MM-DD'
}

/** 저축 목표 */
export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string; // 'YYYY-MM-DD'
  emoji?: string;
  shareCode?: string;
  participants?: string[];
  createdAt?: number;
}

/** 위시리스트 항목 */
export interface WishItem {
  id: string;
  name: string;
  amount: number;
  category?: string;
  url?: string;
  emoji?: string;
  bought?: boolean;
  boughtAt?: string;
  createdAt?: number;
}

/** 워치리스트(관심 종목) */
export interface WatchlistItem {
  id: string;
  symbol: string;
  name?: string;
  type?: 'stock' | 'crypto';
  exchange?: string;
}

/** 예산: { 'YYYY-MM': { category: amount } } */
export type BudgetMap = Record<string, Record<string, number>>;

/** 예측 한 행 (forecast.ts buildForecast 결과) */
export interface ForecastEvent {
  name: string;
  amt: number;
  type: EntryType;
  extra?: boolean;
}

export interface ForecastDay {
  date: Date;
  income: number;
  expense: number;
  balance: number;
  events: ForecastEvent[];
  ym: number;
  dom: number;
  dk: string;
}

export interface WishItemForecastInput {
  price?: number;
  targetDate?: string | null;
  name?: string;
}

export interface ExtraExpense {
  date: string;
  amount: number;
  name: string;
}

/** 가계부 일별 집계 */
export interface LedgerDaySummary {
  expense: number;
  income: number;
  items: LedgerItem[];
}

/** 재정 건강 점수 */
export interface HealthScore {
  score: number;
  grade: string;
  label: string;
  color: string;
  savingsRate: number;
  streak: number;
  budgetCompliance: number | null;
  halbuPct: number;
}

/** 가계 공유 정보 */
export interface Household {
  id: string;
  ownerUid: string;
  members: string[]; // uid 배열
  code: string;
  createdAt: number;
}

/** 앱 전역 상태 */
export interface AppState {
  balance: number;
  dangerLine: number;
  entries: Entry[];
  ledgerData: LedgerData;
  ledgerTemplates: LedgerTemplate[];
  cards: Card[];
  assets: Asset[];
  goals: Goal[];
  wishlist: WishItem[];
  watchlist: WatchlistItem[];
  budgets: BudgetMap;
  theme: 'dark' | 'light';
  geminiKey?: string;
  household?: Household | null;
  user?: { uid: string; email?: string; displayName?: string; photoURL?: string } | null;
}

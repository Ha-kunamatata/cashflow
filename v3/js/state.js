// ════════════════════════════════════════════════════════
// state.js — 앱 상태 관리 / 저장 / 로드
// ════════════════════════════════════════════════════════
import { STORAGE_KEY } from './config.js';
import { uid, isPastOrToday } from './utils.js';

export const state = {
  balance: 0,
  dangerLine: 100000,
  entries: [],
  cardData: {},         // { YYYYMM: { hyundai, kookmin } }
  checkData: {},        // 구버전 호환용 (ledgerData로 마이그레이션됨)
  ledgerData: {},       // { YYYY-MM-DD: [{ id, type, category, amount, memo }] }
  appliedCheckData: {}, // 잔고에 이미 반영된 내역 (날짜별 순지출)
  goals: [],
  theme: 'dark',
};

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

// ── 기본 데이터 (첫 실행 시) ──────────────────────────
export function initDefaultData() {
  if (!state.goals) state.goals = [];
  if (!state.checkData) state.checkData = {};
  if (!state.ledgerData) state.ledgerData = {};
  if (state.entries.length > 0) return;

  state.balance = 923057;
  state.goals = [
    { id: uid(), name: '신혼여행 목돈', emoji: '✈️', targetAmount: 5000000, targetDate: '202601', savedAmount: 800000 },
  ];
  state.entries = [
    { id: uid(), type: 'income',  name: '월급',             amount: 2200000, category: '월급',     repeat: '매월', day: 25, card: '',         endMonth: null, date: null },
    { id: uid(), type: 'income',  name: '수당',             amount: 200000,  category: '수당',     repeat: '매월', day: 10, card: '',         endMonth: null, date: null },
    { id: uid(), type: 'expense', name: '주택청약',         amount: 20000,   category: '기타지출', repeat: '매월', day: 2,  card: '',         endMonth: null, date: null },
    { id: uid(), type: 'expense', name: 'KT 통신요금',      amount: 19800,   category: '공과금',   repeat: '매월', day: 19, card: '',         endMonth: null, date: null },
    { id: uid(), type: 'expense', name: 'KT 통신 자동납부', amount: 18890,   category: '공과금',   repeat: '매월', day: 12, card: '',         endMonth: null, date: null },
    { id: uid(), type: 'expense', name: '메리츠통합보험',   amount: 29920,   category: '보험',     repeat: '매월', day: 5,  card: '',         endMonth: null, date: null },
    { id: uid(), type: 'expense', name: '여행 모임통장',    amount: 30000,   category: '기타지출', repeat: '매월', day: 30, card: '',         endMonth: null, date: null },
    { id: uid(), type: 'expense', name: 'KT 휴대폰 요금',   amount: 140000,  category: '공과금',   repeat: '매월', day: 22, card: '',         endMonth: null, date: null },
    { id: uid(), type: 'expense', name: '클로드 구독료',    amount: 30000,   category: '기타지출', repeat: '매월', day: 20, card: '',         endMonth: null, date: null },
    { id: uid(), type: 'expense', name: '아이클라우드',     amount: 3300,    category: '기타지출', repeat: '매월', day: 24, card: '',         endMonth: null, date: null },
    { id: uid(), type: 'expense', name: '유튜브 프리미엄',  amount: 19500,   category: '기타지출', repeat: '매월', day: 23, card: '',         endMonth: null, date: null },
    { id: uid(), type: 'expense', name: '카카오톡 클라우드',amount: 2500,    category: '기타지출', repeat: '매월', day: 17, card: '',         endMonth: null, date: null },
    { id: uid(), type: 'expense', name: '노션',             amount: 19200,   category: '기타지출', repeat: '매월', day: 29, card: '',         endMonth: null, date: null },
    { id: uid(), type: 'expense', name: '라이나 생명보험',   amount: 37400,   category: '보험',     repeat: '매월', day: 3,  card: '국민카드', endMonth: null, date: null },
    { id: uid(), type: 'expense', name: '알리 할부1',       amount: 120786,  category: '할부',     repeat: '매월', day: 1,  card: '현대카드', endMonth: '202605', date: null },
    { id: uid(), type: 'expense', name: '알리 할부2',       amount: 44688,   category: '할부',     repeat: '매월', day: 1,  card: '현대카드', endMonth: '202605', date: null },
    { id: uid(), type: 'expense', name: '네이버페이 할부1', amount: 15900,   category: '할부',     repeat: '매월', day: 1,  card: '현대카드', endMonth: '202604', date: null },
    { id: uid(), type: 'expense', name: '네이버페이 할부2', amount: 22100,   category: '할부',     repeat: '매월', day: 1,  card: '현대카드', endMonth: '202604', date: null },
    { id: uid(), type: 'expense', name: '논현신사정형외과', amount: 66400,   category: '할부',     repeat: '매월', day: 3,  card: '국민카드', endMonth: '202604', date: null },
    { id: uid(), type: 'expense', name: '구구상회',         amount: 51554,   category: '할부',     repeat: '매월', day: 3,  card: '국민카드', endMonth: '202604', date: null },
    { id: uid(), type: 'expense', name: '서울시ETEX',       amount: 31165,   category: '할부',     repeat: '매월', day: 3,  card: '국민카드', endMonth: '202608', date: null },
    { id: uid(), type: 'expense', name: '번개장터',         amount: 70000,   category: '할부',     repeat: '매월', day: 3,  card: '국민카드', endMonth: '202604', date: null },
    { id: uid(), type: 'expense', name: '쿠팡 할부1',       amount: 40256,   category: '할부',     repeat: '매월', day: 3,  card: '국민카드', endMonth: '202608', date: null },
    { id: uid(), type: 'expense', name: '쿠팡 할부2',       amount: 74650,   category: '할부',     repeat: '매월', day: 3,  card: '국민카드', endMonth: '202605', date: null },
    { id: uid(), type: 'expense', name: '쿠팡 할부3',       amount: 17450,   category: '할부',     repeat: '매월', day: 3,  card: '국민카드', endMonth: '202604', date: null },
    { id: uid(), type: 'expense', name: '이마트 할부1',     amount: 25160,   category: '할부',     repeat: '매월', day: 3,  card: '국민카드', endMonth: '202604', date: null },
  ];

  save();
}

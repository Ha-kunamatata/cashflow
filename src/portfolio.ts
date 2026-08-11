// ════════════════════════════════════════════════════════
// portfolio.ts — 포트폴리오 관제 (항아리 A/B 모델) 순수 계산 로직
// ────────────────────────────────────────────────────────
// DOM·Firebase 의존성 없음 → 그대로 유닛테스트 가능.
// 기존 앱(cashflow)에 통합 시 이 파일을 src/ 로 복사하면 됨.
// ════════════════════════════════════════════════════════

/** 항아리 B(ISA) 종목 정의 — 목표비중 고정 */
export interface IsaHoldingDef {
  code: string; // 종목코드
  name: string; // 표시명
  short: string; // 짧은 라벨(막대/그릇 층용)
  target: number; // 목표비중(%) — ISA 4종목 합계 기준
  color: string; // 시각화 색상(디자인 토큰 계열)
}

/** ISA 4종목 — 목표비중 합계 100% */
export const ISA_HOLDINGS: readonly IsaHoldingDef[] = [
  { code: '360750', name: '미국S&P500',          short: 'S&P500',  target: 30, color: '#3b82f6' },
  { code: '379810', name: '나스닥100',            short: '나스닥',  target: 20, color: '#8b5cf6' },
  { code: '458730', name: '미국배당다우존스',      short: '배당다우', target: 35, color: '#10b981' },
  { code: '0091C0', name: '미국10년국채액티브H',   short: '국채H',   target: 15, color: '#f59e0b' },
] as const;

/** 금현물 색상 & 느슨한 목표(항아리 B 전체의 약 15%, 하드 신호 없음) */
export const GOLD_COLOR = '#eab308';
export const GOLD_TARGET_PCT = 15;

/** 리밸런싱 신호 임계값(±%p) */
export const REBALANCE_THRESHOLD = 5;

/** 사용자별 저장 데이터 (Firestore users/{uid}/data/main 의 portfolio 필드) */
export interface PortfolioData {
  jarA: number; // 항아리 A(유동성): 단일 금액
  gold: number; // 금현물 금액
  isa: Record<string, number>; // { 종목코드: 현재 평가금액 }
}

export type RebalanceAction = 'sell' | 'buy' | null;

/** 종목별 계산 결과 */
export interface HoldingResult extends IsaHoldingDef {
  amount: number; // 현재 평가금액
  weight: number; // 현재비중(%) = 값/isaTotal*100
  deviation: number; // 편차(%p) = 현재 - 목표
  flagged: boolean; // |편차| >= 5%p
  action: RebalanceAction; // 편차>0 매도후보(sell) / 편차<0 매수후보(buy)
}

/** 전체 계산 결과 */
export interface PortfolioResult {
  holdings: HoldingResult[];
  isaTotal: number; // ISA 4종목 합
  gold: number; // 금현물 금액
  goldWeight: number; // 금비중(%) = gold/항아리B*100
  goldTarget: number; // 느슨한 목표(15)
  goldDeviation: number; // goldWeight - goldTarget (참고용, 하드신호 아님)
  jarA: number; // 항아리 A
  jarB: number; // 항아리 B = isaTotal + gold
  total: number; // 총자산 = jarA + jarB
  aRatio: number; // A 비율(%) = jarA/total*100
  bRatio: number; // B 비율(%) = jarB/total*100
  flagCount: number; // 리밸런싱 플래그 개수(ISA 하드신호만 집계)
}

/** 빈 포트폴리오 (모든 금액 0) */
export function emptyPortfolio(): PortfolioData {
  const isa: Record<string, number> = {};
  for (const h of ISA_HOLDINGS) isa[h.code] = 0;
  return { jarA: 0, gold: 0, isa };
}

/**
 * 저장 데이터를 안전한 PortfolioData 로 정규화한다.
 * (누락 필드 보완 · 음수/NaN 방어 · 알 수 없는 종목코드 제거)
 */
export function normalizePortfolio(raw: Partial<PortfolioData> | null | undefined): PortfolioData {
  const base = emptyPortfolio();
  if (!raw || typeof raw !== 'object') return base;
  const num = (v: unknown): number => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  base.jarA = num(raw.jarA);
  base.gold = num(raw.gold);
  if (raw.isa && typeof raw.isa === 'object') {
    for (const h of ISA_HOLDINGS) base.isa[h.code] = num((raw.isa as Record<string, unknown>)[h.code]);
  }
  return base;
}

/**
 * 항아리 A/B 모델 전체 계산.
 * - ISA 4종목 합 = isaTotal, 각 현재비중 = 값/isaTotal*100
 * - 편차 = 현재 - 목표, |편차| >= 5%p → 플래그 (편차>0 매도후보, <0 매수후보)
 * - 항아리B = isaTotal + gold, 금비중 = gold/항아리B*100
 * - 총자산 = jarA + 항아리B, A/B 비율 표시
 */
export function computePortfolio(data: PortfolioData): PortfolioResult {
  const src = normalizePortfolio(data);
  const isaTotal = ISA_HOLDINGS.reduce((s, h) => s + (src.isa[h.code] || 0), 0);

  const holdings: HoldingResult[] = ISA_HOLDINGS.map((h) => {
    const amount = src.isa[h.code] || 0;
    const weight = isaTotal > 0 ? (amount / isaTotal) * 100 : 0;
    const deviation = weight - h.target;
    // 입력이 하나도 없으면(isaTotal=0) 신호를 띄우지 않는다.
    const flagged = isaTotal > 0 && Math.abs(deviation) >= REBALANCE_THRESHOLD;
    const action: RebalanceAction = !flagged ? null : deviation > 0 ? 'sell' : 'buy';
    return { ...h, amount, weight, deviation, flagged, action };
  });

  const gold = src.gold;
  const jarB = isaTotal + gold;
  const goldWeight = jarB > 0 ? (gold / jarB) * 100 : 0;
  const goldDeviation = goldWeight - GOLD_TARGET_PCT;

  const jarA = src.jarA;
  const total = jarA + jarB;
  const aRatio = total > 0 ? (jarA / total) * 100 : 0;
  const bRatio = total > 0 ? (jarB / total) * 100 : 0;

  const flagCount = holdings.filter((h) => h.flagged).length;

  return {
    holdings,
    isaTotal,
    gold,
    goldWeight,
    goldTarget: GOLD_TARGET_PCT,
    goldDeviation,
    jarA,
    jarB,
    total,
    aRatio,
    bRatio,
    flagCount,
  };
}

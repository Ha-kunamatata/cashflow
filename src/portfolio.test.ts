// ════════════════════════════════════════════════════════
// portfolio.test.ts — 항아리 A/B 계산 로직 유닛테스트 (Vitest)
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  ISA_HOLDINGS,
  GOLD_TARGET_PCT,
  REBALANCE_THRESHOLD,
  emptyPortfolio,
  normalizePortfolio,
  computePortfolio,
  type PortfolioData,
} from './portfolio';

/** 목표비중대로 채운 ISA(합계 base) — 편차 0 상태 */
function balancedIsa(base = 1_000_000): Record<string, number> {
  const isa: Record<string, number> = {};
  for (const h of ISA_HOLDINGS) isa[h.code] = (h.target / 100) * base;
  return isa;
}

describe('상수 정의', () => {
  it('ISA 목표비중 합계는 100%', () => {
    expect(ISA_HOLDINGS.reduce((s, h) => s + h.target, 0)).toBe(100);
  });
  it('종목코드/목표비중이 사양과 일치', () => {
    const map = Object.fromEntries(ISA_HOLDINGS.map((h) => [h.code, h.target]));
    expect(map).toEqual({ '360750': 30, '379810': 20, '458730': 35, '0091C0': 15 });
  });
});

describe('normalizePortfolio', () => {
  it('빈 값/누락 필드를 0으로 보완', () => {
    const p = normalizePortfolio(null);
    expect(p.jarA).toBe(0);
    expect(p.gold).toBe(0);
    expect(Object.keys(p.isa).sort()).toEqual(ISA_HOLDINGS.map((h) => h.code).sort());
  });
  it('음수·NaN·문자열을 방어', () => {
    const p = normalizePortfolio({ jarA: -100, gold: NaN as unknown as number, isa: { '360750': '300' as unknown as number } });
    expect(p.jarA).toBe(0);
    expect(p.gold).toBe(0);
    expect(p.isa['360750']).toBe(300);
  });
  it('알 수 없는 종목코드는 무시', () => {
    const p = normalizePortfolio({ isa: { '999999': 500 } as Record<string, number> });
    expect(p.isa['999999']).toBeUndefined();
  });
});

describe('computePortfolio — 기본', () => {
  it('전부 0이면 신호 없음(플래그 0), 비중 0', () => {
    const r = computePortfolio(emptyPortfolio());
    expect(r.isaTotal).toBe(0);
    expect(r.total).toBe(0);
    expect(r.flagCount).toBe(0);
    expect(r.holdings.every((h) => h.weight === 0 && !h.flagged)).toBe(true);
  });

  it('목표비중대로면 편차 0, 플래그 0', () => {
    const data: PortfolioData = { jarA: 0, gold: 0, isa: balancedIsa() };
    const r = computePortfolio(data);
    expect(r.flagCount).toBe(0);
    r.holdings.forEach((h) => {
      expect(h.weight).toBeCloseTo(h.target, 6);
      expect(h.deviation).toBeCloseTo(0, 6);
      expect(h.action).toBeNull();
    });
  });
});

describe('computePortfolio — 리밸런싱 신호', () => {
  it('편차 >= +5%p → 매도 후보(sell) 플래그', () => {
    // S&P500 비중을 크게 초과시킨다.
    const isa = balancedIsa();
    isa['360750'] = isa['360750'] + 1_000_000; // 30% 목표를 크게 초과
    const r = computePortfolio({ jarA: 0, gold: 0, isa });
    const sp = r.holdings.find((h) => h.code === '360750')!;
    expect(sp.deviation).toBeGreaterThanOrEqual(REBALANCE_THRESHOLD);
    expect(sp.flagged).toBe(true);
    expect(sp.action).toBe('sell');
    expect(r.flagCount).toBeGreaterThanOrEqual(1);
  });

  it('편차 <= -5%p → 매수 후보(buy) 플래그', () => {
    const isa = balancedIsa();
    isa['458730'] = 0; // 목표 35% 종목을 0으로 → 크게 미달
    const r = computePortfolio({ jarA: 0, gold: 0, isa });
    const div = r.holdings.find((h) => h.code === '458730')!;
    expect(div.deviation).toBeLessThanOrEqual(-REBALANCE_THRESHOLD);
    expect(div.flagged).toBe(true);
    expect(div.action).toBe('buy');
  });

  it('임계값 경계: 정확히 5%p 편차는 플래그, 4%p 편차는 아님', () => {
    // isaTotal=100 이 되도록 구성하면 금액=비중(%)이 되어 편차 제어가 쉽다.
    // 목표: 30/20/35/15 → S&P500 를 +5(35), 배당다우를 -5(30) 로 상쇄.
    const at5 = computePortfolio({
      jarA: 0,
      gold: 0,
      isa: { '360750': 35, '379810': 20, '458730': 30, '0091C0': 15 },
    });
    expect(at5.holdings.find((h) => h.code === '360750')!.flagged).toBe(true);
    expect(at5.holdings.find((h) => h.code === '458730')!.flagged).toBe(true);

    // S&P500 +4(34), 배당다우 -4(31) → 경계 미만
    const at4 = computePortfolio({
      jarA: 0,
      gold: 0,
      isa: { '360750': 34, '379810': 20, '458730': 31, '0091C0': 15 },
    });
    expect(at4.holdings.find((h) => h.code === '360750')!.flagged).toBe(false);
    expect(at4.flagCount).toBe(0);
  });
});

describe('computePortfolio — 항아리 B / 금 / 총자산', () => {
  it('금비중 = gold / (isaTotal+gold) * 100', () => {
    const r = computePortfolio({ jarA: 0, gold: 150_000, isa: balancedIsa(850_000) });
    expect(r.jarB).toBe(1_000_000);
    expect(r.goldWeight).toBeCloseTo(15, 6);
    expect(r.goldTarget).toBe(GOLD_TARGET_PCT);
    expect(r.goldDeviation).toBeCloseTo(0, 6);
  });

  it('금은 ISA 비중 계산에 영향을 주지 않는다 (isaTotal 은 4종목만)', () => {
    const isa = balancedIsa(1_000_000);
    const r = computePortfolio({ jarA: 0, gold: 500_000, isa });
    expect(r.isaTotal).toBe(1_000_000);
    expect(r.flagCount).toBe(0); // 목표대로면 금이 있어도 ISA 편차 0
  });

  it('총자산 & A/B 비율', () => {
    const r = computePortfolio({ jarA: 600_000, gold: 0, isa: balancedIsa(400_000) });
    expect(r.total).toBe(1_000_000);
    expect(r.aRatio).toBeCloseTo(60, 6);
    expect(r.bRatio).toBeCloseTo(40, 6);
  });
});

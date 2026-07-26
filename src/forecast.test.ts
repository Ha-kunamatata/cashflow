import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildForecast, simulateWishPurchase } from './forecast';
import { state, resetState } from './state';
import type { Entry } from './types';

describe('buildForecast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1)); // 2026-01-01
    resetState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the requested number of days starting from today', () => {
    state.balance = 100000;
    const fc = buildForecast(5);
    expect(fc).toHaveLength(5);
    expect(fc[0].dk).toBe('2026-01-01');
    expect(fc[4].dk).toBe('2026-01-05');
  });

  it('carries the starting balance forward when there are no entries', () => {
    state.balance = 100000;
    const fc = buildForecast(10);
    expect(fc.every((d) => d.balance === 100000)).toBe(true);
  });

  it('applies a monthly (매월) recurring entry only on its day, cumulatively', () => {
    state.balance = 0;
    state.entries = [
      { id: '1', type: 'income', name: '월급', category: '월급', amount: 3_000_000, repeat: '매월', day: 15 } as Entry,
    ];
    const fc = buildForecast(31);
    const beforePay = fc.find((d) => d.dom === 14)!;
    const payDay = fc.find((d) => d.dom === 15)!;
    const afterPay = fc.find((d) => d.dom === 16)!;

    expect(beforePay.balance).toBe(0);
    expect(payDay.income).toBe(3_000_000);
    expect(payDay.balance).toBe(3_000_000);
    expect(afterPay.balance).toBe(3_000_000);
  });

  it('stops applying a recurring entry once its endMonth has passed', () => {
    state.balance = 0;
    state.entries = [
      {
        id: '1', type: 'expense', name: '할부', category: '할부', amount: 50000,
        repeat: '매월', day: 10, endMonth: '202601',
      } as Entry,
    ];
    const fc = buildForecast(60); // covers Jan 10 and Feb 10
    const janPay = fc.find((d) => d.dk === '2026-01-10')!;
    const febPay = fc.find((d) => d.dk === '2026-02-10')!;

    expect(janPay.expense).toBe(50000);
    expect(febPay.expense).toBe(0); // 202602 > endMonth 202601 → no longer applied
  });

  it('applies a one-time (1회성) entry only on its exact date', () => {
    state.balance = 0;
    state.entries = [
      { id: '1', type: 'expense', name: '가전구매', category: '쇼핑', amount: 200000, repeat: '1회성', date: '2026-01-10' } as Entry,
    ];
    const fc = buildForecast(20);
    expect(fc.find((d) => d.dk === '2026-01-10')!.expense).toBe(200000);
    expect(fc.find((d) => d.dk === '2026-01-09')!.expense).toBe(0);
    expect(fc.find((d) => d.dk === '2026-01-11')!.expense).toBe(0);
  });

  it('applies a biweekly (격주) entry every 14 days from its anchor date', () => {
    state.balance = 0;
    state.entries = [
      { id: '1', type: 'expense', name: '격주 지출', category: '기타', amount: 10000, repeat: '격주', date: '2026-01-01' } as Entry,
    ];
    const fc = buildForecast(30);
    expect(fc.find((d) => d.dk === '2026-01-01')!.expense).toBe(10000); // diff=0
    expect(fc.find((d) => d.dk === '2026-01-08')!.expense).toBe(0);     // diff=7
    expect(fc.find((d) => d.dk === '2026-01-15')!.expense).toBe(10000); // diff=14
    expect(fc.find((d) => d.dk === '2026-01-29')!.expense).toBe(10000); // diff=28
  });
});

describe('simulateWishPurchase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
    resetState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports no safe date when balance never covers the price within 365 days', () => {
    state.balance = 0;
    state.entries = [];
    const result = simulateWishPurchase({ price: 100_000_000 });
    expect(result.canAfford).toBe(false);
    expect(result.safeDate).toBeNull();
    expect(result.impactSummary).toContain('구매 불가');
  });

  it('finds today as the safe date when balance already covers the price', () => {
    state.balance = 500000;
    const result = simulateWishPurchase({ price: 100000 });
    expect(result.safeDate).toBe('2026-01-01');
    expect(result.balanceAfter).toBe(400000);
    expect(result.canAfford).toBe(true);
  });

  it('warns when a target-date purchase would breach the danger line', () => {
    state.balance = 150000;
    state.dangerLine = 100000;
    const result = simulateWishPurchase({ price: 100000, targetDate: '2026-01-01' });
    expect(result.impactSummary).toContain('⚠️');
    expect(result.balanceAfter).toBe(50000);
  });

  it('confirms safety when a target-date purchase stays above the danger line', () => {
    state.balance = 300000;
    state.dangerLine = 100000;
    const result = simulateWishPurchase({ price: 100000, targetDate: '2026-01-01' });
    expect(result.impactSummary).toContain('✅');
    expect(result.canAfford).toBe(true);
  });

  it('returns a "no amount" result when price is missing', () => {
    const result = simulateWishPurchase({});
    expect(result.impactSummary).toBe('금액 없음');
    expect(result.canAfford).toBe(false);
  });
});

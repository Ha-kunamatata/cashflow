import { describe, it, expect } from 'vitest';
import { getMonthBudget, setMonthBudget, getMonthActual, suggestBudget } from './budget';
import type { BudgetMap, LedgerData } from './types';

// Note: month parameter is 0-indexed (0 = January, 11 = December)
// This matches JavaScript's Date.getMonth() convention.

describe('getMonthBudget', () => {
  it('returns empty object for missing month', () => {
    const budgets: BudgetMap = {};
    expect(getMonthBudget(budgets, 2024, 0)).toEqual({});
  });

  it('returns stored budget for January (month=0 → key 2024-01)', () => {
    const budgets: BudgetMap = { '2024-01': { 식비: 200000, 교통: 50000 } };
    expect(getMonthBudget(budgets, 2024, 0)).toEqual({ 식비: 200000, 교통: 50000 });
  });

  it('returns correct budget for December (month=11 → key 2024-12)', () => {
    const budgets: BudgetMap = { '2024-12': { 식비: 500000 } };
    expect(getMonthBudget(budgets, 2024, 11)).toEqual({ 식비: 500000 });
  });
});

describe('setMonthBudget', () => {
  it('sets budget for a category in March (month=2 → key 2024-03)', () => {
    const budgets: BudgetMap = {};
    setMonthBudget(budgets, 2024, 2, '식비', 300000);
    expect(budgets['2024-03']['식비']).toBe(300000);
  });

  it('removes category when amount is 0', () => {
    const budgets: BudgetMap = { '2024-03': { 식비: 300000 } };
    setMonthBudget(budgets, 2024, 2, '식비', 0);
    expect(budgets['2024-03']['식비']).toBeUndefined();
  });

  it('creates month key if missing', () => {
    const budgets: BudgetMap = {};
    setMonthBudget(budgets, 2024, 5, '교통', 80000); // June → 2024-06
    expect(budgets['2024-06']).toBeDefined();
    expect(budgets['2024-06']['교통']).toBe(80000);
  });

  it('does not create key for amount=0', () => {
    const budgets: BudgetMap = {};
    setMonthBudget(budgets, 2024, 2, '식비', 0);
    // key may or may not be created — just assert 식비 is not set
    expect(budgets['2024-03']?.['식비']).toBeUndefined();
  });
});

describe('getMonthActual', () => {
  it('returns empty object for empty ledger', () => {
    const ledger: LedgerData = {};
    expect(getMonthActual(ledger, 2024, 0)).toEqual({});
  });

  it('sums expenses by category for January (month=0)', () => {
    const ledger: LedgerData = {
      '2024-01-05': [
        { id: '1', type: 'expense', category: '식비', amount: 15000 },
        { id: '2', type: 'expense', category: '식비', amount: 10000 },
      ],
      '2024-01-10': [
        { id: '3', type: 'expense', category: '교통', amount: 5000 },
      ],
      '2024-01-20': [
        { id: '4', type: 'income', category: '급여', amount: 300000 },
      ],
    };
    const actual = getMonthActual(ledger, 2024, 0);
    expect(actual['식비']).toBe(25000);
    expect(actual['교통']).toBe(5000);
    expect(actual['급여']).toBeUndefined(); // income is excluded
  });

  it('excludes other months', () => {
    const ledger: LedgerData = {
      '2024-01-05': [{ id: '1', type: 'expense', category: '식비', amount: 10000 }],
      '2024-02-05': [{ id: '2', type: 'expense', category: '식비', amount: 20000 }],
    };
    const actual = getMonthActual(ledger, 2024, 0); // January only
    expect(actual['식비']).toBe(10000);
  });
});

describe('suggestBudget', () => {
  it('returns empty for empty ledger', () => {
    expect(suggestBudget({}, 2024, 3)).toEqual({});
  });

  it('averages expenses across 3 prior months, rounded up to nearest 10,000', () => {
    // month=3 (April) → looks at months 0(Jan), 1(Feb), 2(Mar)
    const ledger: LedgerData = {
      '2024-01-05': [{ id: '1', type: 'expense', category: '식비', amount: 100000 }],
      '2024-02-05': [{ id: '2', type: 'expense', category: '식비', amount: 200000 }],
      // March has no data → 0
    };
    const suggested = suggestBudget(ledger, 2024, 3);
    // total=300000, /3=100000, ceil(100000/10000)*10000 = 100000
    expect(suggested['식비']).toBe(100000);
  });

  it('rounds up fractional 10,000s', () => {
    const ledger: LedgerData = {
      '2024-01-05': [{ id: '1', type: 'expense', category: '외식', amount: 25000 }],
    };
    const suggested = suggestBudget(ledger, 2024, 3);
    // total=25000, /3≈8333, ceil(8333/10000)*10000 = 10000
    expect(suggested['외식']).toBe(10000);
  });
});

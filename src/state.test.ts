import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  state,
  resetState,
  validateState,
  migrateLedger,
  syncLedgerToBalance,
} from './state';
import type { LedgerItem } from './types';

function expenseItem(amount: number): LedgerItem {
  return { id: '1', type: 'expense', category: '식비', amount };
}

function incomeItem(amount: number): LedgerItem {
  return { id: '2', type: 'income', category: '월급', amount };
}

describe('validateState', () => {
  it('accepts an empty object', () => {
    expect(validateState({})).toBe(true);
  });

  it('rejects non-objects', () => {
    expect(validateState(null)).toBe(false);
    expect(validateState('nope')).toBe(false);
    expect(validateState(42)).toBe(false);
    expect(validateState([])).toBe(false);
  });

  it('rejects a balance of the wrong type', () => {
    expect(validateState({ balance: '1000' })).toBe(false);
  });

  it('rejects entries/goals/assets/badges that are not arrays', () => {
    expect(validateState({ entries: {} })).toBe(false);
    expect(validateState({ goals: 'x' })).toBe(false);
    expect(validateState({ assets: null })).toBe(false);
    expect(validateState({ badges: 1 })).toBe(false);
  });

  it('rejects ledgerData/cardData/budgets that are arrays instead of maps', () => {
    expect(validateState({ ledgerData: [] })).toBe(false);
    expect(validateState({ cardData: [] })).toBe(false);
    expect(validateState({ budgets: [] })).toBe(false);
  });

  it('accepts a well-formed partial state payload', () => {
    expect(
      validateState({
        balance: 100000,
        dangerLine: 50000,
        entries: [],
        goals: [],
        assets: [],
        badges: [],
        ledgerData: { '2026-01-01': [expenseItem(1000)] },
        budgets: { '2026-01': { 식비: 100000 } },
        streak: { count: 3, lastDate: '2026-01-01' },
      }),
    ).toBe(true);
  });
});

describe('migrateLedger', () => {
  beforeEach(() => resetState());

  it('migrates legacy checkData entries into ledgerData when ledgerData is empty', () => {
    state.checkData = { '2026-01-05': 15000, '2026-01-06': 0 };
    migrateLedger();
    expect(state.ledgerData['2026-01-05']).toHaveLength(1);
    expect(state.ledgerData['2026-01-05'][0].amount).toBe(15000);
    expect(state.ledgerData['2026-01-05'][0].type).toBe('expense');
    // zero/falsy amounts are not migrated
    expect(state.ledgerData['2026-01-06']).toBeUndefined();
  });

  it('does nothing if ledgerData already has entries', () => {
    state.ledgerData = { '2026-02-01': [expenseItem(5000)] };
    state.checkData = { '2026-01-05': 15000 };
    migrateLedger();
    expect(state.ledgerData['2026-01-05']).toBeUndefined();
    expect(state.ledgerData['2026-02-01']).toHaveLength(1);
  });
});

describe('syncLedgerToBalance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15)); // 2026-01-15
    resetState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('subtracts past/today expenses from balance', () => {
    state.balance = 100000;
    state.ledgerData = { '2026-01-10': [expenseItem(20000)] };
    syncLedgerToBalance();
    expect(state.balance).toBe(80000);
    expect(state.appliedCheckData['2026-01-10']).toBe(20000);
  });

  it('adds past/today income to balance (negative raw delta)', () => {
    state.balance = 100000;
    state.ledgerData = { '2026-01-10': [incomeItem(50000)] };
    syncLedgerToBalance();
    expect(state.balance).toBe(150000);
  });

  it('does not apply entries dated in the future', () => {
    state.balance = 100000;
    state.ledgerData = { '2026-02-01': [expenseItem(30000)] };
    syncLedgerToBalance();
    expect(state.balance).toBe(100000);
    expect(state.appliedCheckData['2026-02-01']).toBeUndefined();
  });

  it('is idempotent — calling twice does not double-apply', () => {
    state.balance = 100000;
    state.ledgerData = { '2026-01-10': [expenseItem(20000)] };
    syncLedgerToBalance();
    syncLedgerToBalance();
    expect(state.balance).toBe(80000);
  });

  it('reconciles balance when a past ledger entry is edited after being applied', () => {
    state.balance = 100000;
    state.ledgerData = { '2026-01-10': [expenseItem(20000)] };
    syncLedgerToBalance();
    expect(state.balance).toBe(80000);

    // amount increases from 20000 → 35000
    state.ledgerData['2026-01-10'][0].amount = 35000;
    syncLedgerToBalance();
    expect(state.balance).toBe(65000);
  });

  it('reverses balance impact when a past entry is deleted', () => {
    state.balance = 100000;
    state.ledgerData = { '2026-01-10': [expenseItem(20000)] };
    syncLedgerToBalance();
    expect(state.balance).toBe(80000);

    delete state.ledgerData['2026-01-10'];
    syncLedgerToBalance();
    expect(state.balance).toBe(100000);
    expect(state.appliedCheckData['2026-01-10']).toBeUndefined();
  });
});

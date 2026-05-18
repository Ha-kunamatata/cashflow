import { describe, it, expect } from 'vitest';
import { computeStreak } from './streak';
import type { LedgerData } from './types';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('computeStreak', () => {
  it('returns 0 for empty ledger', () => {
    const result = computeStreak({});
    expect(result.count).toBe(0);
    expect(result.hasToday).toBe(false);
  });

  it('detects streak of 1 when only today has entries', () => {
    const ledger: LedgerData = {
      [daysAgo(0)]: [{ id: '1', type: 'expense', category: '식비', amount: 5000 }],
    };
    const result = computeStreak(ledger);
    expect(result.count).toBe(1);
    expect(result.hasToday).toBe(true);
  });

  it('computes multi-day streak including today', () => {
    const ledger: LedgerData = {
      [daysAgo(0)]: [{ id: '1', type: 'expense', category: '식비', amount: 5000 }],
      [daysAgo(1)]: [{ id: '2', type: 'expense', category: '교통', amount: 3000 }],
      [daysAgo(2)]: [{ id: '3', type: 'expense', category: '식비', amount: 8000 }],
    };
    const result = computeStreak(ledger);
    expect(result.count).toBe(3);
    expect(result.hasToday).toBe(true);
  });

  it('streak breaks with a gap day', () => {
    const ledger: LedgerData = {
      [daysAgo(0)]: [{ id: '1', type: 'expense', category: '식비', amount: 5000 }],
      // daysAgo(1) is missing — gap
      [daysAgo(2)]: [{ id: '2', type: 'expense', category: '교통', amount: 3000 }],
    };
    const result = computeStreak(ledger);
    expect(result.count).toBe(1);
  });

  it('counts streak from yesterday when today has no entry', () => {
    // If today is empty, function starts counting from yesterday.
    // Yesterday + day before = streak of 2, hasToday = false
    const ledger: LedgerData = {
      [daysAgo(1)]: [{ id: '1', type: 'expense', category: '식비', amount: 5000 }],
      [daysAgo(2)]: [{ id: '2', type: 'expense', category: '교통', amount: 3000 }],
    };
    const result = computeStreak(ledger);
    expect(result.count).toBe(2);
    expect(result.hasToday).toBe(false);
  });

  it('returns streak=1 for only yesterday (hasToday false)', () => {
    const ledger: LedgerData = {
      [daysAgo(1)]: [{ id: '1', type: 'expense', category: '식비', amount: 5000 }],
    };
    const result = computeStreak(ledger);
    expect(result.count).toBe(1);
    expect(result.hasToday).toBe(false);
  });
});

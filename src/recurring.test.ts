import { describe, it, expect } from 'vitest';
import { detectRecurringPatterns } from './recurring';
import type { LedgerData, Entry } from './types';

function makeItem(memo: string, amount: number, category = '식비') {
  return { id: Math.random().toString(), type: 'expense' as const, category, amount, memo };
}

describe('detectRecurringPatterns', () => {
  it('returns empty for empty ledger', () => {
    expect(detectRecurringPatterns({}, [])).toHaveLength(0);
  });

  it('detects pattern appearing in 3 months', () => {
    const ledger: LedgerData = {
      '2026-01-05': [makeItem('넷플릭스', 17000, '구독')],
      '2026-02-05': [makeItem('넷플릭스', 17000, '구독')],
      '2026-03-05': [makeItem('넷플릭스', 17000, '구독')],
    };
    const patterns = detectRecurringPatterns(ledger, []);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].memo).toBe('넷플릭스');
    expect(patterns[0].avgAmount).toBe(17000);
    expect(patterns[0].confidence).toBe('high');
  });

  it('skips entries already in fixed items', () => {
    const ledger: LedgerData = {
      '2026-01-10': [makeItem('월세', 500000, '주거')],
      '2026-02-10': [makeItem('월세', 500000, '주거')],
      '2026-03-10': [makeItem('월세', 500000, '주거')],
    };
    const existing: Entry[] = [{
      id: '1', type: 'expense', name: '월세', category: '주거', amount: 500000, repeat: '매월', day: 10,
    }];
    const patterns = detectRecurringPatterns(ledger, existing);
    expect(patterns.find(p => p.memo === '월세')).toBeUndefined();
  });

  it('ignores items only in 1 month', () => {
    const ledger: LedgerData = {
      '2026-03-15': [makeItem('컨퍼런스비', 80000, '교육')],
    };
    expect(detectRecurringPatterns(ledger, [])).toHaveLength(0);
  });

  it('returns at most 5 patterns', () => {
    const ledger: LedgerData = {};
    // 6개의 패턴 생성
    ['가','나','다','라','마','바'].forEach((n, i) => {
      for (let m = 1; m <= 3; m++) {
        const key = `2026-0${m}-0${i + 1}`;
        ledger[key] = [makeItem(`${n}구독`, 10000 * (i + 1))];
      }
    });
    const patterns = detectRecurringPatterns(ledger, []);
    expect(patterns.length).toBeLessThanOrEqual(5);
  });
});

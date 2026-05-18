// recurring.ts — 반복 지출 자동 감지
import type { LedgerData, Entry } from './types';

export interface RecurringPattern {
  memo: string;
  category: string;
  avgAmount: number;
  occurrences: { month: string; day: number; amount: number }[];
  suggestedDay: number;
  confidence: 'high' | 'medium';
}

function normalizeMemo(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 20);
}

function amountSimilar(a: number, b: number): boolean {
  if (a === 0 || b === 0) return false;
  const ratio = Math.abs(a - b) / Math.max(a, b);
  return ratio < 0.15; // 15% 이내 차이
}

/**
 * 최근 3~6개월 가계부에서 반복 패턴 감지
 * 이미 state.entries에 있는 항목은 제외
 */
export function detectRecurringPatterns(
  ledgerData: LedgerData,
  existingEntries: Entry[],
): RecurringPattern[] {
  // 최근 6개월 날짜키 수집
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // 메모별 발생 기록
  const grouped: Record<string, { month: string; day: number; amount: number; category: string }[]> = {};

  for (const [dk, items] of Object.entries(ledgerData)) {
    const [y, m, d] = dk.split('-');
    const month = `${y}-${m}`;
    if (!months.includes(month)) continue;
    const day = parseInt(d, 10);

    for (const item of items) {
      if (item.type !== 'expense') continue;
      const key = normalizeMemo(item.memo || item.category);
      if (!key) continue;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ month, day, amount: item.amount, category: item.category });
    }
  }

  // 이미 등록된 고정 항목의 메모 Set
  const existingMemos = new Set(
    existingEntries
      .filter(e => e.repeat === '매월')
      .map(e => normalizeMemo(e.name || '')),
  );

  const patterns: RecurringPattern[] = [];

  for (const [memo, occList] of Object.entries(grouped)) {
    if (existingMemos.has(memo)) continue;

    // 다른 달에 걸쳐 2번 이상 발생
    const uniqueMonths = new Set(occList.map(o => o.month));
    if (uniqueMonths.size < 2) continue;

    // 금액 일관성 확인 (첫 번째 기준으로 15% 이내)
    const ref = occList[0].amount;
    const consistent = occList.every(o => amountSimilar(o.amount, ref));
    if (!consistent && occList.length < 3) continue;

    // 일자 일관성 (±5일 이내)
    const days = occList.map(o => o.day);
    const avgDay = Math.round(days.reduce((s, d) => s + d, 0) / days.length);
    const daySpread = Math.max(...days) - Math.min(...days);

    const avgAmount = Math.round(occList.reduce((s, o) => s + o.amount, 0) / occList.length);
    const confidence: 'high' | 'medium' = uniqueMonths.size >= 3 && daySpread <= 5 ? 'high' : 'medium';

    // 3개월 이상이거나 2개월이면서 날짜 일치
    if (uniqueMonths.size >= 3 || (uniqueMonths.size >= 2 && daySpread <= 3)) {
      patterns.push({
        memo,
        category: occList[occList.length - 1].category,
        avgAmount,
        occurrences: occList,
        suggestedDay: avgDay,
        confidence,
      });
    }
  }

  // 신뢰도 높은 것 먼저, 최대 5개
  return patterns
    .sort((a, b) => {
      if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1;
      return b.occurrences.length - a.occurrences.length;
    })
    .slice(0, 5);
}

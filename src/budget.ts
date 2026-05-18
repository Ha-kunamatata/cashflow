// ════════════════════════════════════════════════════════
// budget.ts — 예산 관리 헬퍼
// ════════════════════════════════════════════════════════
import type { BudgetMap, LedgerData } from './types';

type MonthBudget = Record<string, number>;

export function getMonthBudget(budgets: BudgetMap, year: number, month: number): MonthBudget {
  const key = `${year}-${String(month + 1).padStart(2, '0')}`;
  return budgets?.[key] || {};
}

export function setMonthBudget(
  budgets: BudgetMap,
  year: number,
  month: number,
  category: string,
  amount: number,
): void {
  const key = `${year}-${String(month + 1).padStart(2, '0')}`;
  if (!budgets[key]) budgets[key] = {};
  if (amount > 0) budgets[key][category] = amount;
  else delete budgets[key][category];
}

export function getMonthActual(
  ledgerData: LedgerData,
  year: number,
  month: number,
): MonthBudget {
  const pad = (n: number) => String(n).padStart(2, '0');
  const totals: MonthBudget = {};
  for (let d = 1; d <= 31; d++) {
    const dk = `${year}-${pad(month + 1)}-${pad(d)}`;
    for (const item of ledgerData?.[dk] || []) {
      if (item.type === 'expense') {
        totals[item.category] = (totals[item.category] || 0) + item.amount;
      }
    }
  }
  return totals;
}

export function suggestBudget(
  ledgerData: LedgerData,
  year: number,
  month: number,
): MonthBudget {
  const pad = (n: number) => String(n).padStart(2, '0');
  const totals: MonthBudget = {};
  const counts: Record<string, number> = {};
  for (let mo = 1; mo <= 3; mo++) {
    let y = year;
    let m = month - mo;
    while (m < 0) {
      m += 12;
      y--;
    }
    for (let d = 1; d <= 31; d++) {
      const dk = `${y}-${pad(m + 1)}-${pad(d)}`;
      for (const item of ledgerData?.[dk] || []) {
        if (item.type === 'expense') {
          totals[item.category] = (totals[item.category] || 0) + item.amount;
          counts[item.category] = (counts[item.category] || 0) + 1;
        }
      }
    }
  }
  // 월평균을 가장 가까운 만원 단위로 올림
  const suggestion: MonthBudget = {};
  for (const [cat, total] of Object.entries(totals)) {
    suggestion[cat] = Math.ceil(total / 3 / 10000) * 10000;
  }
  return suggestion;
}

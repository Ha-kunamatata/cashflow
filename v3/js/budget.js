// ════════════════════════════════════════════════════════
// budget.js — 예산 관리 헬퍼
// ════════════════════════════════════════════════════════

export function getMonthBudget(budgets, year, month) {
  const key = `${year}-${String(month + 1).padStart(2, '0')}`;
  return budgets?.[key] || {};
}

export function setMonthBudget(budgets, year, month, category, amount) {
  const key = `${year}-${String(month + 1).padStart(2, '0')}`;
  if (!budgets[key]) budgets[key] = {};
  if (amount > 0) budgets[key][category] = amount;
  else delete budgets[key][category];
}

export function getMonthActual(ledgerData, year, month) {
  const pad = n => String(n).padStart(2, '0');
  const totals = {};
  for (let d = 1; d <= 31; d++) {
    const dk = `${year}-${pad(month + 1)}-${pad(d)}`;
    for (const item of (ledgerData?.[dk] || [])) {
      if (item.type === 'expense') {
        totals[item.category] = (totals[item.category] || 0) + item.amount;
      }
    }
  }
  return totals;
}

export function suggestBudget(ledgerData, year, month) {
  const pad = n => String(n).padStart(2, '0');
  const totals = {};
  const counts = {};
  for (let mo = 1; mo <= 3; mo++) {
    let y = year, m = month - mo;
    while (m < 0) { m += 12; y--; }
    for (let d = 1; d <= 31; d++) {
      const dk = `${y}-${pad(m + 1)}-${pad(d)}`;
      for (const item of (ledgerData?.[dk] || [])) {
        if (item.type === 'expense') {
          totals[item.category] = (totals[item.category] || 0) + item.amount;
          counts[item.category] = (counts[item.category] || 0) + 1;
        }
      }
    }
  }
  // return monthly average rounded up to nearest 10k
  const suggestion = {};
  for (const [cat, total] of Object.entries(totals)) {
    suggestion[cat] = Math.ceil(total / 3 / 10000) * 10000;
  }
  return suggestion;
}

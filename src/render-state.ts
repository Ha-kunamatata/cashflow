// @ts-nocheck
// ════════════════════════════════════════════════════════
// render-state.ts — shared rendering state
// ════════════════════════════════════════════════════════
import { today } from './utils';

export let currentLedgerYear = today().getFullYear();
export let currentLedgerMonth = today().getMonth();

try {
  const saved = JSON.parse(localStorage.getItem('cashflow_ledger_ym') || 'null');
  if (saved && typeof saved.y === 'number' && typeof saved.m === 'number') {
    currentLedgerYear = saved.y;
    currentLedgerMonth = saved.m;
  }
} catch (_) {}

export let _selectedLedgerDate = null;

export function setCurrentLedgerYear(v) { currentLedgerYear = v; }
export function setCurrentLedgerMonth(v) { currentLedgerMonth = v; }
export function setSelectedLedgerDate(dk) { _selectedLedgerDate = dk; }

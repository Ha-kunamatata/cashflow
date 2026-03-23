// ════════════════════════════════════════════════════════
// forecast.js — 잔고 예측 계산 로직
// ════════════════════════════════════════════════════════
import { today, addDays, dateKey, yyyymm, p2 } from ‘./utils.js’;
import { state } from ‘./state.js’;

/**

- N일치 잔고 예측 배열 반환
- @param {number} days
- @returns {{ date, income, expense, balance, events, ym, dom, dk }[]}
  */
  export function buildForecast(days = 365) {
  const base   = today();
  const result = [];
  let running  = state.balance;

for (let i = 0; i < days; i++) {
const d   = addDays(base, i);
const ym  = yyyymm(d);
const dom = d.getDate();
const dk  = dateKey(d);

```
let income  = 0;
let expense = 0;
const events = [];

// ── 수입/지출 항목 ──────────────────────────────────
for (const e of state.entries) {
  if (e.endMonth && ym > parseInt(e.endMonth)) continue;
  const amt = e.amount || 0;

  if (e.repeat === '매월' && e.day == dom) {
    _push(e, amt, events, v => { if (e.type === 'income') income += v; else expense += v; });

  } else if (e.repeat === '1회성' && e.date && dateKey(new Date(e.date)) === dk) {
    _push(e, amt, events, v => { if (e.type === 'income') income += v; else expense += v; });

  } else if (e.repeat === '격주' && e.date) {
    const diff = Math.round((d - new Date(e.date)) / 86400000);
    if (diff >= 0 && diff % 14 === 0)
      _push(e, amt, events, v => { if (e.type === 'income') income += v; else expense += v; });
  }
}

// ── 신용카드 변동분 ────────────────────────────────
const ymStr = String(ym);
const cd    = state.cardData[ymStr] || {};
if (dom === 1 && cd.hyundai) { expense += cd.hyundai; events.push({ name:'현대카드', amt:cd.hyundai, type:'expense' }); }
if (dom === 3 && cd.kookmin) { expense += cd.kookmin; events.push({ name:'국민카드', amt:cd.kookmin, type:'expense' }); }

// ── 체크카드(가계부) ───────────────────────────────
const ck = state.checkData || {};
if (ck[dk]) { expense += ck[dk]; events.push({ name:'체크카드', amt:ck[dk], type:'expense' }); }

running += income - expense;
result.push({ date:d, income, expense, balance:running, events, ym, dom, dk });
```

}

return result;
}

function _push(entry, amt, events, addFn) {
addFn(amt);
events.push({ name:entry.name, amt, type:entry.type });
}

// ════════════════════════════════════════════════════════
// forecast.js — 잔고 예측 계산 로직
// ════════════════════════════════════════════════════════
import { today, addDays, dateKey, yyyymm } from './utils.js';
import { state, DEFAULT_CARDS } from './state.js';

/** 현재 카드 정의 반환 (커스텀 없으면 기본값) */
export function getCards() {
  return (state.cards && state.cards.length > 0) ? state.cards : DEFAULT_CARDS;
}

/**
 * N일치 잔고 예측 배열 반환
 * @param {number} days
 * @param {Array} [extraExpenses] - 위시리스트 시뮬레이션 등 추가 지출 [{ date: 'YYYY-MM-DD', amount, name }]
 * @returns {{ date, income, expense, balance, events, ym, dom, dk }[]}
 */
export function buildForecast(days = 365, extraExpenses = []) {
  const base = today();
  const result = [];
  let running = state.balance;
  const cards = getCards();

  // 추가 지출을 날짜 키로 맵핑
  const extraMap = {};
  for (const ex of extraExpenses) {
    if (!extraMap[ex.date]) extraMap[ex.date] = [];
    extraMap[ex.date].push(ex);
  }

  for (let i = 0; i < days; i++) {
    const d = addDays(base, i);
    const ym = yyyymm(d);
    const dom = d.getDate();
    const dk = dateKey(d);

    let income = 0;
    let expense = 0;
    const events = [];

    // ── 수입/지출 항목 ──────────────────────────────────
    for (const e of state.entries) {
      if (e.endMonth && ym > parseInt(e.endMonth, 10)) continue;
      const amt = Number(e.amount || 0);

      if (e.repeat === '매월' && Number(e.day) === dom) {
        pushEvent(e, amt, events, (v) => {
          if (e.type === 'income') income += v;
          else expense += v;
        });
      } else if (e.repeat === '1회성' && e.date && dateKey(new Date(e.date)) === dk) {
        pushEvent(e, amt, events, (v) => {
          if (e.type === 'income') income += v;
          else expense += v;
        });
      } else if (e.repeat === '격주' && e.date) {
        const diff = Math.round((d - new Date(e.date)) / 86400000);
        if (diff >= 0 && diff % 14 === 0) {
          pushEvent(e, amt, events, (v) => {
            if (e.type === 'income') income += v;
            else expense += v;
          });
        }
      }
    }

    // ── 신용카드 변동분 (커스텀 카드 지원) ────────────────
    const ymStr = String(ym);
    const cd = state.cardData[ymStr] || {};

    for (const card of cards) {
      if (dom === card.payDay) {
        const amt = Number(cd[card.id] || 0);
        if (amt > 0) {
          expense += amt;
          events.push({ name: card.name + ' 변동지출', amt, type: 'expense' });
        }
      }
    }

    // ── 체크카드(가계부) ───────────────────────────────
    const ck = state.checkData || {};
    if (ck[dk]) {
      expense += Number(ck[dk]);
      events.push({ name: '체크카드', amt: Number(ck[dk]), type: 'expense' });
    }

    // ── 추가 지출 (위시리스트 시뮬레이션 등) ─────────────
    if (extraMap[dk]) {
      for (const ex of extraMap[dk]) {
        expense += Number(ex.amount);
        events.push({ name: ex.name, amt: Number(ex.amount), type: 'expense', extra: true });
      }
    }

    running += income - expense;

    result.push({
      date: d,
      income,
      expense,
      balance: running,
      events,
      ym,
      dom,
      dk,
    });
  }

  return result;
}

function pushEvent(entry, amt, events, addFn) {
  addFn(amt);
  events.push({
    name: entry.name,
    amt,
    type: entry.type,
  });
}

/**
 * 위시리스트 항목 구매 시뮬레이션
 * @param {Object} item - 위시리스트 항목
 * @returns {{ safeDate: string|null, impactSummary: string, canAfford: boolean, balanceAfter: number }}
 */
export function simulateWishPurchase(item) {
  const price = Number(item.price || 0);
  if (!price) return { safeDate: null, impactSummary: '금액 없음', canAfford: false, balanceAfter: 0 };

  const targetDk = item.targetDate || null;
  const fc = buildForecast(365);
  const { state: st } = { state };

  // 현재 잔고로 바로 살 수 있는지
  const canAffordNow = state.balance >= price;

  // 구매 가능한 첫 날짜 (잔고 ≥ price)
  let safeDate = null;
  let balanceAfter = 0;
  for (const day of fc) {
    if (day.balance >= price) {
      safeDate = day.dk;
      balanceAfter = day.balance - price;
      break;
    }
  }

  // 지정일 기준 영향
  if (targetDk) {
    const targetDay = fc.find(d => d.dk === targetDk);
    if (targetDay) {
      const afterBuy = targetDay.balance - price;
      const dangerLine = state.dangerLine || 100000;
      const impact = afterBuy < dangerLine
        ? `⚠️ 구매 후 안전선(${(dangerLine/10000).toFixed(0)}만원) 미달`
        : `✅ 구매 후 잔고 ${fmt(afterBuy)}`;
      return { safeDate, impactSummary: impact, canAfford: targetDay.balance >= price, balanceAfter: afterBuy };
    }
  }

  if (!safeDate) {
    return { safeDate: null, impactSummary: '365일 내 구매 불가 (잔고 부족)', canAfford: false, balanceAfter: 0 };
  }

  const dangerLine = state.dangerLine || 100000;
  const impactSummary = balanceAfter < dangerLine
    ? `⚠️ 구매 후 안전선 미달 (잔고 ${fmt(balanceAfter)})`
    : `✅ 안전 — 구매 후 잔고 ${fmt(balanceAfter)}`;

  return { safeDate, impactSummary, canAfford: canAffordNow, balanceAfter };
}

function fmt(n) {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만원';
  return n.toLocaleString() + '원';
}

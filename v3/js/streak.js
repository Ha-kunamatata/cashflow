// ════════════════════════════════════════════════════════
// streak.js — 연속 기록 & 배지 관리
// ════════════════════════════════════════════════════════

export function computeStreak(ledgerData) {
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  let count = 0;
  let d = new Date(today);

  const todayKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hasToday = (ledgerData?.[todayKey] || []).length > 0;

  if (!hasToday) d.setDate(d.getDate() - 1); // start from yesterday if today has no entry

  while (true) {
    const dk = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if ((ledgerData?.[dk] || []).length === 0) break;
    count++;
    d.setDate(d.getDate() - 1);
    if (count > 1000) break; // safety
  }
  return { count, hasToday };
}

export const BADGE_DEFS = [
  { id: 'streak7',    icon: '🔥', label: '일주일 달성',  desc: '7일 연속 기록' },
  { id: 'streak30',   icon: '💎', label: '한 달 달성',   desc: '30일 연속 기록' },
  { id: 'streak100',  icon: '👑', label: '100일 달성',   desc: '100일 연속 기록' },
  { id: 'halbu_done', icon: '🎊', label: '할부 졸업',    desc: '이번달 할부 전부 종료' },
  { id: 'budget_ok',  icon: '💚', label: '예산 지킴이',  desc: '이번달 예산 내 소비' },
];

export function checkBadges(state) {
  const earned = new Set(state.badges || []);
  const newBadges = [];
  const { count } = computeStreak(state.ledgerData);

  if (count >= 7   && !earned.has('streak7'))   newBadges.push('streak7');
  if (count >= 30  && !earned.has('streak30'))  newBadges.push('streak30');
  if (count >= 100 && !earned.has('streak100')) newBadges.push('streak100');

  // Check halbu_done
  const todayYm = Number(`${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const activeHalbu = (state.entries || []).filter(e =>
    e.type === 'expense' && e.category === '할부' && e.repeat === '매월' &&
    (!e.endMonth || parseInt(e.endMonth, 10) >= todayYm)
  );
  if (
    activeHalbu.length === 0 &&
    (state.entries || []).some(e => e.category === '할부') &&
    !earned.has('halbu_done')
  ) {
    newBadges.push('halbu_done');
  }

  return newBadges;
}

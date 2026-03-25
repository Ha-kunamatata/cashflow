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

// ── 배지 카테고리별 정의 ──────────────────────────────────
export const BADGE_DEFS = [
  // 🔥 연속 기록
  { id: 'streak3',    icon: '🌱', label: '새싹 기록',      desc: '3일 연속 가계부 기록',     category: '기록',   rarity: 'common' },
  { id: 'streak7',    icon: '🔥', label: '불꽃 일주일',    desc: '7일 연속 가계부 기록',     category: '기록',   rarity: 'uncommon' },
  { id: 'streak14',   icon: '⚡', label: '2주 전사',       desc: '14일 연속 기록 달성',      category: '기록',   rarity: 'uncommon' },
  { id: 'streak30',   icon: '💎', label: '한 달 마스터',   desc: '30일 연속 기록 달성',      category: '기록',   rarity: 'rare' },
  { id: 'streak60',   icon: '🌙', label: '두 달 전설',     desc: '60일 연속 기록 달성',      category: '기록',   rarity: 'rare' },
  { id: 'streak100',  icon: '👑', label: '100일의 왕',     desc: '100일 연속 기록 달성',     category: '기록',   rarity: 'legendary' },
  { id: 'streak365',  icon: '🏆', label: '1년 챔피언',     desc: '365일 연속 기록 달성',     category: '기록',   rarity: 'legendary' },

  // 💰 자산 달성
  { id: 'asset_1m',   icon: '💵', label: '첫 백만원',      desc: '총 자산 100만원 돌파',     category: '자산',   rarity: 'common' },
  { id: 'asset_10m',  icon: '💰', label: '천만장자',       desc: '총 자산 1천만원 돌파',     category: '자산',   rarity: 'uncommon' },
  { id: 'asset_50m',  icon: '🏅', label: '오천만 클럽',    desc: '총 자산 5천만원 돌파',     category: '자산',   rarity: 'rare' },
  { id: 'asset_100m', icon: '💫', label: '억대 자산가',    desc: '총 자산 1억원 돌파',       category: '자산',   rarity: 'legendary' },

  // 🎯 절약/지출 관리
  { id: 'budget_ok',  icon: '💚', label: '예산 지킴이',    desc: '이번달 예산 내 소비 완료', category: '절약',   rarity: 'uncommon' },
  { id: 'budget_ace', icon: '🎯', label: '예산 에이스',    desc: '예산 80% 이하 소비',       category: '절약',   rarity: 'rare' },
  { id: 'no_spend',   icon: '🧊', label: '무지출 챌린지',  desc: '하루 지출 0원 달성',       category: '절약',   rarity: 'uncommon' },
  { id: 'save_10pct', icon: '🐷', label: '저축 돼지',      desc: '수입의 10% 이상 저축',     category: '절약',   rarity: 'common' },
  { id: 'save_30pct', icon: '🏦', label: '저축왕',         desc: '수입의 30% 이상 저축',     category: '절약',   rarity: 'rare' },

  // 💳 할부/카드
  { id: 'halbu_done', icon: '🎊', label: '할부 졸업',      desc: '할부 항목 전부 종료',      category: '부채',   rarity: 'uncommon' },
  { id: 'no_halbu',   icon: '✂️',  label: '카드 프리',     desc: '할부 항목 0개 상태',       category: '부채',   rarity: 'common' },
  { id: 'card_ctrl',  icon: '🃏', label: '카드 마스터',    desc: '카드 지출 월 목표 달성',   category: '부채',   rarity: 'uncommon' },

  // 🎯 목표 달성
  { id: 'goal_first', icon: '🌟', label: '첫 목표 달성',   desc: '저축 목표 1개 달성',       category: '목표',   rarity: 'uncommon' },
  { id: 'goal_x3',    icon: '🚀', label: '목표 헌터',      desc: '저축 목표 3개 달성',       category: '목표',   rarity: 'rare' },

  // 🏠 레벨업
  { id: 'lvl_villa',  icon: '🏡', label: '내집 마련',      desc: '자산 레벨: 빌라 달성',     category: '레벨',   rarity: 'common' },
  { id: 'lvl_apt',    icon: '🏢', label: '아파트 입주',    desc: '자산 레벨: 아파트 달성',   category: '레벨',   rarity: 'uncommon' },
  { id: 'lvl_pent',   icon: '🏰', label: '펜트하우스',     desc: '자산 레벨: 최고 등급',     category: '레벨',   rarity: 'legendary' },

  // 📊 분석/기록
  { id: 'first_entry',icon: '✍️', label: '첫 발걸음',      desc: '첫 번째 항목 등록',        category: '시작',   rarity: 'common' },
  { id: 'entries_10', icon: '📋', label: '항목 부자',      desc: '고정 항목 10개 등록',      category: '시작',   rarity: 'common' },
  { id: 'wish_first', icon: '🛍️', label: '위시리스트 시작', desc: '첫 위시 아이템 등록',     category: '시작',   rarity: 'common' },
  { id: 'invest_first',icon:'📈', label: '투자 시작',      desc: '관심 종목 첫 등록',        category: '시작',   rarity: 'common' },
  { id: 'early_bird', icon: '🐦', label: '새벽 기록',      desc: '오전 6시 이전 가계부 기록',category: '특별',   rarity: 'uncommon' },
  { id: 'night_owl',  icon: '🦉', label: '야행성 관리자',  desc: '자정 이후 가계부 기록',    category: '특별',   rarity: 'uncommon' },
];

export const RARITY_CONFIG = {
  common:    { label: 'COMMON',    color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' },
  uncommon:  { label: 'UNCOMMON',  color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)' },
  rare:      { label: 'RARE',      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)' },
  legendary: { label: 'LEGENDARY', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)', glow: true },
};

export function checkBadges(state) {
  const earned = new Set(state.badges || []);
  const newBadges = [];
  const { count } = computeStreak(state.ledgerData);
  const now = new Date();
  const todayYm = Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);

  // ── 연속 기록 ──
  if (count >= 3   && !earned.has('streak3'))   newBadges.push('streak3');
  if (count >= 7   && !earned.has('streak7'))   newBadges.push('streak7');
  if (count >= 14  && !earned.has('streak14'))  newBadges.push('streak14');
  if (count >= 30  && !earned.has('streak30'))  newBadges.push('streak30');
  if (count >= 60  && !earned.has('streak60'))  newBadges.push('streak60');
  if (count >= 100 && !earned.has('streak100')) newBadges.push('streak100');
  if (count >= 365 && !earned.has('streak365')) newBadges.push('streak365');

  // ── 자산 달성 ──
  const totalAssets = (state.assets || []).reduce((s, a) => s + (a.amount || 0), 0);
  if (totalAssets >= 1_000_000   && !earned.has('asset_1m'))   newBadges.push('asset_1m');
  if (totalAssets >= 10_000_000  && !earned.has('asset_10m'))  newBadges.push('asset_10m');
  if (totalAssets >= 50_000_000  && !earned.has('asset_50m'))  newBadges.push('asset_50m');
  if (totalAssets >= 100_000_000 && !earned.has('asset_100m')) newBadges.push('asset_100m');

  // ── 할부 ──
  const activeHalbu = (state.entries || []).filter(e =>
    e.type === 'expense' && e.category === '할부' && e.repeat === '매월' &&
    (!e.endMonth || parseInt(e.endMonth, 10) >= todayYm)
  );
  if (activeHalbu.length === 0 && (state.entries || []).some(e => e.category === '할부') && !earned.has('halbu_done')) {
    newBadges.push('halbu_done');
  }
  if (activeHalbu.length === 0 && !(state.entries || []).some(e => e.category === '할부') && !earned.has('no_halbu')) {
    newBadges.push('no_halbu');
  }

  // ── 첫 항목 ──
  if ((state.entries || []).length > 0 && !earned.has('first_entry')) newBadges.push('first_entry');
  if ((state.entries || []).length >= 10 && !earned.has('entries_10')) newBadges.push('entries_10');
  if ((state.wishlist || []).length > 0 && !earned.has('wish_first')) newBadges.push('wish_first');
  if ((state.watchlist || []).length > 0 && !earned.has('invest_first')) newBadges.push('invest_first');

  // ── 레벨 배지 ──
  if (totalAssets >= 5_000_000  && !earned.has('lvl_villa')) newBadges.push('lvl_villa');
  if (totalAssets >= 10_000_000 && !earned.has('lvl_apt'))   newBadges.push('lvl_apt');
  if (totalAssets >= 100_000_000 && !earned.has('lvl_pent')) newBadges.push('lvl_pent');

  // ── 목표 달성 ──
  const completedGoals = (state.goals || []).filter(g => (g.savedAmount || 0) >= (g.targetAmount || 1));
  if (completedGoals.length >= 1 && !earned.has('goal_first')) newBadges.push('goal_first');
  if (completedGoals.length >= 3 && !earned.has('goal_x3'))   newBadges.push('goal_x3');

  return newBadges;
}

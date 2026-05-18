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

  // ── 기록 확장 ──────────────────────────────────────────────
  { id: 'streak200',   icon: '⭐', label: '200일의 별',    desc: '200일 연속 가계부 기록',      category: '기록',  rarity: 'rare' },
  { id: 'streak500',   icon: '🌠', label: '500일 전설',    desc: '500일 연속 가계부 기록',      category: '기록',  rarity: 'legendary' },
  { id: 'ledger_50',   icon: '📓', label: '50일 기록가',   desc: '가계부 50일치 기록 누적',     category: '기록',  rarity: 'uncommon' },
  { id: 'ledger_100',  icon: '📚', label: '100일 기록가',  desc: '가계부 100일치 기록 누적',    category: '기록',  rarity: 'rare' },

  // ── 자산 확장 ──────────────────────────────────────────────
  { id: 'asset_500k',  icon: '🌿', label: '첫 오십만원',   desc: '총 자산 50만원 달성',         category: '자산',  rarity: 'common' },
  { id: 'asset_5m',    icon: '💴', label: '오백만 돌파',   desc: '총 자산 500만원 돌파',        category: '자산',  rarity: 'uncommon' },
  { id: 'asset_30m',   icon: '🥇', label: '삼천만 클럽',   desc: '총 자산 3천만원 돌파',        category: '자산',  rarity: 'rare' },
  { id: 'asset_200m',  icon: '🌌', label: '이억 자산가',   desc: '총 자산 2억원 돌파',          category: '자산',  rarity: 'legendary' },
  { id: 'asset_500m',  icon: '🚀', label: '오억 클럽',     desc: '총 자산 5억원 돌파',          category: '자산',  rarity: 'legendary' },
  { id: 'multi_asset', icon: '🗂️', label: '포트폴리오',   desc: '자산 5개 이상 등록',          category: '자산',  rarity: 'uncommon' },

  // ── 절약 확장 ──────────────────────────────────────────────
  { id: 'no_spend_3',  icon: '❄️', label: '3회 무지출',    desc: '이번 달 3일 이상 지출 0원',   category: '절약',  rarity: 'rare' },
  { id: 'save_50pct',  icon: '🏆', label: '반절 저축',     desc: '이번 달 수입의 50% 이상 저축',category: '절약',  rarity: 'legendary' },
  { id: 'small_daily', icon: '🪙', label: '소소한 하루',   desc: '하루 총지출 1만원 미만 달성', category: '절약',  rarity: 'common' },
  { id: 'save_goal_ok',icon: '📊', label: '흑자 달성',     desc: '가계부 월수입이 월지출 초과', category: '절약',  rarity: 'uncommon' },
  { id: 'expense_ctrl',icon: '🎛️', label: '지출 컨트롤',  desc: '이번 달 지출이 지난달보다 30% 이상 감소',category:'절약', rarity:'rare'},
  { id: 'free_week',   icon: '🌺', label: '가벼운 한 주',  desc: '연속 7일 총지출 5만원 미만',  category: '절약',  rarity: 'uncommon' },

  // ── 부채 확장 ──────────────────────────────────────────────
  { id: 'card_free',   icon: '✨', label: '카드 자유인',   desc: '카드 연결 지출 항목이 없는 상태',category: '부채', rarity: 'rare' },
  { id: 'halbu_5',     icon: '💪', label: '할부 5개 종료', desc: '만료된 할부 항목 5개 이상',   category: '부채',  rarity: 'rare' },
  { id: 'debt_down',   icon: '📉', label: '부채 감소',     desc: '활성 할부 월납액 10만원 미만',category: '부채',  rarity: 'uncommon' },
  { id: 'card_only1',  icon: '1️⃣', label: '카드 하나',    desc: '하나의 카드만 사용 중',       category: '부채',  rarity: 'uncommon' },

  // ── 목표 확장 ──────────────────────────────────────────────
  { id: 'goal_50pct',  icon: '🔋', label: '목표 반 도달',  desc: '저축 목표 50% 이상 달성',     category: '목표',  rarity: 'common' },
  { id: 'goal_x5',     icon: '🌟', label: '목표 마스터',   desc: '저축 목표 5개 달성 완료',     category: '목표',  rarity: 'legendary' },
  { id: 'goal_running3',icon:'⚡', label: '3개 동시 진행', desc: '저축 목표 3개 이상 동시 진행',category: '목표',  rarity: 'uncommon' },
  { id: 'wish_bought', icon: '🛒', label: '위시 달성',     desc: '위시리스트 아이템 구매 완료', category: '목표',  rarity: 'uncommon' },

  // ── 레벨 확장 ──────────────────────────────────────────────
  { id: 'lvl_gosiwon', icon: '🪑', label: '고시원 탈출',   desc: '자산 100만원 이상 달성',      category: '레벨',  rarity: 'common' },
  { id: 'lvl_oneroom', icon: '🛏️', label: '원룸 생활',    desc: '자산 200만원 이상 달성',      category: '레벨',  rarity: 'common' },
  { id: 'lvl_town',    icon: '🏘️', label: '타운하우스',   desc: '자산 3천만원 이상 달성',      category: '레벨',  rarity: 'rare' },
  { id: 'lvl_mansion', icon: '🏯', label: '저택 주인',     desc: '자산 2억원 이상 달성',        category: '레벨',  rarity: 'legendary' },

  // ── 시작 확장 ──────────────────────────────────────────────
  { id: 'goal_add',    icon: '🎪', label: '목표 설정가',   desc: '저축 목표 첫 등록',           category: '시작',  rarity: 'common' },
  { id: 'budget_set',  icon: '📐', label: '예산 설정',     desc: '첫 예산 설정 완료',           category: '시작',  rarity: 'common' },
  { id: 'asset_first', icon: '🏷️', label: '첫 자산 등록', desc: '첫 번째 자산 등록',           category: '시작',  rarity: 'common' },
  { id: 'income_entry',icon: '💹', label: '수입 등록',     desc: '수입 항목 첫 등록',           category: '시작',  rarity: 'common' },
  { id: 'expense_entry',icon:'🧾', label: '지출 등록',     desc: '지출 항목 첫 등록',           category: '시작',  rarity: 'common' },
  { id: 'wish_5',      icon: '🎁', label: '소원 5개',      desc: '위시리스트 5개 이상 등록',    category: '시작',  rarity: 'uncommon' },
  { id: 'watch_3',     icon: '📡', label: '관심 종목 3개', desc: '관심 종목 3개 이상 등록',     category: '시작',  rarity: 'common' },
  { id: 'entries_20',  icon: '📁', label: '20개 항목',     desc: '고정 항목 20개 등록',         category: '시작',  rarity: 'uncommon' },
  { id: 'entries_30',  icon: '🗄️', label: '30개 항목',    desc: '고정 항목 30개 등록',         category: '시작',  rarity: 'rare' },
  { id: 'gemini_user', icon: '🤖', label: 'AI 분석가',     desc: 'Gemini API 키 등록 완료',     category: '시작',  rarity: 'uncommon' },

  // ── 특별 확장 ──────────────────────────────────────────────
  { id: 'new_year',    icon: '🎆', label: '새해 결심',     desc: '1월 1일에 가계부 기록',       category: '특별',  rarity: 'rare' },
  { id: 'payday_rec',  icon: '💸', label: '월급날 기록',   desc: '25일에 가계부 기록',          category: '특별',  rarity: 'uncommon' },
  { id: 'weekend_rec', icon: '🎡', label: '주말 기록',     desc: '토요일·일요일 모두 기록',     category: '특별',  rarity: 'common' },
  { id: 'month_end',   icon: '🌛', label: '월말 결산',     desc: '매달 마지막 날 가계부 기록',  category: '특별',  rarity: 'uncommon' },
  { id: 'full_month',  icon: '🗓️', label: '완벽한 달',    desc: '한 달 모든 날 가계부 기록',   category: '특별',  rarity: 'legendary' },
  { id: 'lunch_save',  icon: '🥗', label: '식비 절약',     desc: '식비 지출 없는 날 가계부 기록',category: '특별', rarity: 'uncommon' },

  // ── 📈 투자 (신규) ────────────────────────────────────────
  { id: 'invest_3',    icon: '📊', label: '3종목 탐색',    desc: '관심 종목 3개 이상 등록',     category: '투자',  rarity: 'common' },
  { id: 'invest_5',    icon: '📉', label: '5종목 포트폴리오',desc:'관심 종목 5개 이상 등록',    category: '투자',  rarity: 'uncommon' },
  { id: 'invest_10',   icon: '🔭', label: '전문 투자가',   desc: '관심 종목 10개 이상 등록',   category: '투자',  rarity: 'rare' },
  { id: 'invest_kr',   icon: '🇰🇷', label: '국내 투자',   desc: '국내 주식 시장 종목 등록',    category: '투자',  rarity: 'common' },
  { id: 'invest_us',   icon: '🇺🇸', label: '해외 투자',   desc: '미국 주식 시장 종목 등록',    category: '투자',  rarity: 'uncommon' },
  { id: 'invest_diverse',icon:'🌐', label: '글로벌 투자',  desc: '3개 이상 시장에 종목 등록',   category: '투자',  rarity: 'rare' },
  { id: 'invest_note', icon: '📝', label: '투자 메모',     desc: '메모가 있는 관심 종목 등록',  category: '투자',  rarity: 'common' },
  { id: 'invest_big',  icon: '💎', label: '대형 종목',     desc: '종목당 평가액 100만원 이상',  category: '투자',  rarity: 'rare' },

  // ── 🏆 성취 (신규) ────────────────────────────────────────
  { id: 'ach_balance_1m', icon: '🌈', label: '잔고 백만',  desc: '잔고 100만원 이상 달성',      category: '성취',  rarity: 'common' },
  { id: 'ach_balance_5m', icon: '💫', label: '잔고 오백만',desc: '잔고 500만원 이상 달성',      category: '성취',  rarity: 'uncommon' },
  { id: 'ach_balance_10m',icon: '🌟', label: '잔고 천만', desc: '잔고 1천만원 이상 달성',      category: '성취',  rarity: 'rare' },
  { id: 'ach_net_pos',    icon: '📈', label: '흑자 인생',  desc: '월수입이 월지출보다 많은 상태',category: '성취', rarity: 'common' },
  { id: 'ach_monthly_2m', icon: '💰', label: '월수입 200만',desc:'월 총수입 200만원 이상',      category: '성취',  rarity: 'uncommon' },
  { id: 'ach_goal_total', icon: '🎯', label: '목표 총액 1억',desc:'저축 목표 합계 1억원 이상',  category: '성취',  rarity: 'legendary' },
  { id: 'ach_all_goals',  icon: '🏁', label: '모든 목표 완료',desc:'등록한 모든 목표 달성',    category: '성취',  rarity: 'legendary' },
  { id: 'ach_surplus_big',icon: '💹', label: '큰 흑자',    desc: '이번 달 50만원 이상 흑자',    category: '성취',  rarity: 'rare' },

  // ── 🎖️ 도전 (신규) ────────────────────────────────────────
  { id: 'chal_all_used',  icon: '🔑', label: '모든 기능 사용',desc:'자산·위시·관심종목 모두 등록',category:'도전',  rarity: 'rare' },
  { id: 'chal_100days',   icon: '💯', label: '누적 100일', desc: '가계부 100일 이상 기록',      category: '도전',  rarity: 'rare' },
  { id: 'chal_budget_all',icon: '🗃️', label: '예산 완비', desc: '5개 이상 카테고리 예산 설정', category: '도전',  rarity: 'uncommon' },
  { id: 'chal_no_halbu',  icon: '✂️', label: '할부 청산',  desc: '모든 할부 항목 종료 처리',    category: '도전',  rarity: 'rare' },
  { id: 'chal_save_1year',icon: '⏳', label: '1년 절약 계획',desc:'1년 이상 기간 목표 등록',    category: '도전',  rarity: 'uncommon' },
  { id: 'chal_10goals',   icon: '🎲', label: '10개 목표', desc: '저축 목표 10개 이상 등록',     category: '도전',  rarity: 'legendary' },
  { id: 'chal_millionaire',icon:'🤑', label: '천만장자 도전',desc:'목표 저축액 1천만원 이상',   category: '도전',  rarity: 'rare' },
  { id: 'chal_debt_zero', icon: '🕊️', label: '부채 제로', desc: '할부 항목이 완전히 없는 상태', category: '도전',  rarity: 'legendary' },
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

  // ══════════════════════════════════════════════════════
  // 확장 배지 체크
  // ══════════════════════════════════════════════════════

  // ── 기록 확장 ──
  const totalLedgerDays = Object.keys(state.ledgerData || {}).length;
  if (count >= 200  && !earned.has('streak200'))  newBadges.push('streak200');
  if (count >= 500  && !earned.has('streak500'))  newBadges.push('streak500');
  if (totalLedgerDays >= 50  && !earned.has('ledger_50'))  newBadges.push('ledger_50');
  if (totalLedgerDays >= 100 && !earned.has('ledger_100')) newBadges.push('ledger_100');

  // ── 자산 확장 ──
  if (totalAssets >= 500_000     && !earned.has('asset_500k'))  newBadges.push('asset_500k');
  if (totalAssets >= 5_000_000   && !earned.has('asset_5m'))    newBadges.push('asset_5m');
  if (totalAssets >= 30_000_000  && !earned.has('asset_30m'))   newBadges.push('asset_30m');
  if (totalAssets >= 200_000_000 && !earned.has('asset_200m'))  newBadges.push('asset_200m');
  if (totalAssets >= 500_000_000 && !earned.has('asset_500m'))  newBadges.push('asset_500m');
  if ((state.assets || []).length >= 5 && !earned.has('multi_asset')) newBadges.push('multi_asset');

  // ── 절약 확장 ──
  const pad2 = n => String(n).padStart(2, '0');
  const thisYm = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const thisMonthKeys = Object.keys(state.ledgerData || {}).filter(k => k.startsWith(thisYm));
  const thisMonthExpense = thisMonthKeys.reduce((s, k) =>
    s + (state.ledgerData[k] || []).filter(i => i.type === 'expense').reduce((s2, i) => s2 + i.amount, 0), 0);
  const thisMonthIncome = thisMonthKeys.reduce((s, k) =>
    s + (state.ledgerData[k] || []).filter(i => i.type === 'income').reduce((s2, i) => s2 + i.amount, 0), 0);

  // no_spend_3: 3+ days this month with zero expense entries
  const noSpendDays = thisMonthKeys.filter(k => {
    const exp = (state.ledgerData[k] || []).filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
    return exp === 0 && (state.ledgerData[k] || []).length > 0;
  });
  if (noSpendDays.length >= 3 && !earned.has('no_spend_3')) newBadges.push('no_spend_3');

  // save_50pct: this month ledger income >= expense * 2 (saving 50%+)
  const monthlyFixedIncome = (state.entries || []).filter(e => e.type === 'income').reduce((s, e) => s + (e.amount || 0), 0);
  if (monthlyFixedIncome > 0 && thisMonthExpense > 0 && thisMonthExpense <= monthlyFixedIncome * 0.5 && !earned.has('save_50pct')) {
    newBadges.push('save_50pct');
  }

  // small_daily: any ledger day with expense > 0 and < 10000
  const hasSmallDay = Object.keys(state.ledgerData || {}).some(k => {
    const exp = (state.ledgerData[k] || []).filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
    return exp > 0 && exp < 10_000;
  });
  if (hasSmallDay && !earned.has('small_daily')) newBadges.push('small_daily');

  // save_goal_ok: this month's ledger income > expense
  if (thisMonthIncome > 0 && thisMonthIncome > thisMonthExpense && !earned.has('save_goal_ok')) {
    newBadges.push('save_goal_ok');
  }

  // expense_ctrl: this month's expense < last month's expense * 0.7
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastYm = `${lastMonthDate.getFullYear()}-${pad2(lastMonthDate.getMonth() + 1)}`;
  const lastMonthExpense = Object.keys(state.ledgerData || {}).filter(k => k.startsWith(lastYm))
    .reduce((s, k) => s + (state.ledgerData[k] || []).filter(i => i.type === 'expense').reduce((s2, i) => s2 + i.amount, 0), 0);
  if (lastMonthExpense > 0 && thisMonthKeys.length > 0 && thisMonthExpense < lastMonthExpense * 0.7 && !earned.has('expense_ctrl')) {
    newBadges.push('expense_ctrl');
  }

  // free_week: any 7 consecutive calendar days where total expense < 50000
  {
    const allDates = Object.keys(state.ledgerData || {}).sort();
    for (let i = 0; i <= allDates.length - 7 && !earned.has('free_week'); i++) {
      const week = allDates.slice(i, i + 7);
      const first = new Date(week[0]), last = new Date(week[6]);
      if ((last - first) / 86400000 === 6) {
        const weekExp = week.reduce((s, k) =>
          s + (state.ledgerData[k] || []).filter(i => i.type === 'expense').reduce((s2, i) => s2 + i.amount, 0), 0);
        if (weekExp > 0 && weekExp < 50_000) newBadges.push('free_week');
      }
    }
  }

  // ── 부채 확장 ──
  const hasCardEntries = (state.entries || []).some(e => e.card && e.card !== '');
  if (!hasCardEntries && !earned.has('card_free')) newBadges.push('card_free');

  const expiredHalbu = (state.entries || []).filter(e => e.category === '할부' && e.endMonth && parseInt(e.endMonth, 10) < todayYm);
  if (expiredHalbu.length >= 5 && !earned.has('halbu_5')) newBadges.push('halbu_5');

  const activeHalbuTotal = (state.entries || []).filter(e =>
    e.type === 'expense' && e.category === '할부' && e.repeat === '매월' &&
    (!e.endMonth || parseInt(e.endMonth, 10) >= todayYm)
  ).reduce((s, e) => s + (e.amount || 0), 0);
  if (activeHalbuTotal > 0 && activeHalbuTotal < 100_000 && !earned.has('debt_down')) newBadges.push('debt_down');

  const usedCards = new Set((state.entries || []).filter(e => e.card && e.card !== '').map(e => e.card));
  if (usedCards.size === 1 && !earned.has('card_only1')) newBadges.push('card_only1');

  // ── 목표 확장 ──
  const halfGoal = (state.goals || []).some(g => g.savedAmount >= (g.targetAmount || 1) * 0.5);
  if (halfGoal && !earned.has('goal_50pct')) newBadges.push('goal_50pct');
  if (completedGoals.length >= 5 && !earned.has('goal_x5')) newBadges.push('goal_x5');
  const activeGoals = (state.goals || []).filter(g => (g.savedAmount || 0) < (g.targetAmount || 1));
  if (activeGoals.length >= 3 && !earned.has('goal_running3')) newBadges.push('goal_running3');
  if ((state.wishlist || []).some(w => w.bought) && !earned.has('wish_bought')) newBadges.push('wish_bought');

  // ── 레벨 확장 ──
  if (totalAssets >= 1_000_000   && !earned.has('lvl_gosiwon')) newBadges.push('lvl_gosiwon');
  if (totalAssets >= 2_000_000   && !earned.has('lvl_oneroom')) newBadges.push('lvl_oneroom');
  if (totalAssets >= 30_000_000  && !earned.has('lvl_town'))    newBadges.push('lvl_town');
  if (totalAssets >= 200_000_000 && !earned.has('lvl_mansion')) newBadges.push('lvl_mansion');

  // ── 시작 확장 ──
  if ((state.goals || []).length > 0 && !earned.has('goal_add')) newBadges.push('goal_add');
  if (Object.keys(state.budgets || {}).length > 0 && !earned.has('budget_set')) newBadges.push('budget_set');
  if ((state.assets || []).length > 0 && !earned.has('asset_first')) newBadges.push('asset_first');
  if ((state.entries || []).some(e => e.type === 'income') && !earned.has('income_entry')) newBadges.push('income_entry');
  if ((state.entries || []).some(e => e.type === 'expense') && !earned.has('expense_entry')) newBadges.push('expense_entry');
  if ((state.wishlist || []).length >= 5 && !earned.has('wish_5')) newBadges.push('wish_5');
  if ((state.watchlist || []).length >= 3 && !earned.has('watch_3')) newBadges.push('watch_3');
  if ((state.entries || []).length >= 20 && !earned.has('entries_20')) newBadges.push('entries_20');
  if ((state.entries || []).length >= 30 && !earned.has('entries_30')) newBadges.push('entries_30');
  if (state.geminiKey && !earned.has('gemini_user')) newBadges.push('gemini_user');

  // ── 특별 확장 ──
  if (Object.keys(state.ledgerData || {}).some(k => k.endsWith('-01-01')) && !earned.has('new_year')) newBadges.push('new_year');
  if (Object.keys(state.ledgerData || {}).some(k => k.endsWith('-25')) && !earned.has('payday_rec')) newBadges.push('payday_rec');

  {
    const ledgerSet = new Set(Object.keys(state.ledgerData || {}));
    const hasBothWeekend = [...ledgerSet].some(k => {
      const d = new Date(k);
      if (d.getDay() === 6) {
        const sun = new Date(d); sun.setDate(d.getDate() + 1);
        const sunKey = `${sun.getFullYear()}-${pad2(sun.getMonth()+1)}-${pad2(sun.getDate())}`;
        return ledgerSet.has(sunKey);
      }
      return false;
    });
    if (hasBothWeekend && !earned.has('weekend_rec')) newBadges.push('weekend_rec');
  }

  {
    const hasMonthEnd = Object.keys(state.ledgerData || {}).some(k => {
      const d = new Date(k), next = new Date(d); next.setDate(d.getDate() + 1);
      return next.getMonth() !== d.getMonth();
    });
    if (hasMonthEnd && !earned.has('month_end')) newBadges.push('month_end');
  }

  {
    const byMonth = {};
    Object.keys(state.ledgerData || {}).forEach(k => {
      const ym = k.substring(0, 7);
      if (!byMonth[ym]) byMonth[ym] = new Set();
      byMonth[ym].add(k);
    });
    const hasFullMonth = Object.entries(byMonth).some(([ym, days]) => {
      const [y, m] = ym.split('-').map(Number);
      return days.size === new Date(y, m, 0).getDate();
    });
    if (hasFullMonth && !earned.has('full_month')) newBadges.push('full_month');
  }

  {
    const hasLunchSave = Object.keys(state.ledgerData || {}).some(k => {
      const items = state.ledgerData[k] || [];
      return items.length > 0 && !items.some(i => i.type === 'expense' && (i.category === '식비' || i.category === '카페'));
    });
    if (hasLunchSave && !earned.has('lunch_save')) newBadges.push('lunch_save');
  }

  // ── 투자 ──
  if ((state.watchlist || []).length >= 3  && !earned.has('invest_3'))  newBadges.push('invest_3');
  if ((state.watchlist || []).length >= 5  && !earned.has('invest_5'))  newBadges.push('invest_5');
  if ((state.watchlist || []).length >= 10 && !earned.has('invest_10')) newBadges.push('invest_10');

  const hasKR = (state.watchlist || []).some(w => w.market === 'KRX' || w.market === 'KR');
  if (hasKR && !earned.has('invest_kr')) newBadges.push('invest_kr');
  const hasUS = (state.watchlist || []).some(w => w.market === 'US' || w.market === 'CRYPTO');
  if (hasUS && !earned.has('invest_us')) newBadges.push('invest_us');
  const markets = new Set((state.watchlist || []).map(w => w.market).filter(Boolean));
  if (markets.size >= 3 && !earned.has('invest_diverse')) newBadges.push('invest_diverse');
  if ((state.watchlist || []).some(w => w.note && w.note.trim()) && !earned.has('invest_note')) newBadges.push('invest_note');
  if ((state.watchlist || []).some(w => (w.buyPrice || 0) * (w.quantity || 0) >= 1_000_000) && !earned.has('invest_big')) newBadges.push('invest_big');

  // ── 성취 ──
  if (state.balance >= 1_000_000  && !earned.has('ach_balance_1m'))  newBadges.push('ach_balance_1m');
  if (state.balance >= 5_000_000  && !earned.has('ach_balance_5m'))  newBadges.push('ach_balance_5m');
  if (state.balance >= 10_000_000 && !earned.has('ach_balance_10m')) newBadges.push('ach_balance_10m');

  const totalMonthlyIncome  = (state.entries || []).filter(e => e.type === 'income' ).reduce((s, e) => s + (e.amount || 0), 0);
  const totalMonthlyExpense = (state.entries || []).filter(e => e.type === 'expense').reduce((s, e) => s + (e.amount || 0), 0);
  if (totalMonthlyIncome > totalMonthlyExpense && totalMonthlyIncome > 0 && !earned.has('ach_net_pos')) newBadges.push('ach_net_pos');
  if (totalMonthlyIncome >= 2_000_000 && !earned.has('ach_monthly_2m')) newBadges.push('ach_monthly_2m');

  const totalGoalTarget = (state.goals || []).reduce((s, g) => s + (g.targetAmount || 0), 0);
  if (totalGoalTarget >= 100_000_000 && !earned.has('ach_goal_total')) newBadges.push('ach_goal_total');
  if ((state.goals || []).length > 0 && (state.goals || []).every(g => (g.savedAmount || 0) >= (g.targetAmount || 1)) && !earned.has('ach_all_goals')) {
    newBadges.push('ach_all_goals');
  }
  if (thisMonthIncome - thisMonthExpense >= 500_000 && thisMonthIncome > 0 && !earned.has('ach_surplus_big')) newBadges.push('ach_surplus_big');

  // ── 도전 ──
  const hasAllFeatures = (state.assets || []).length > 0 && (state.wishlist || []).length > 0 && (state.watchlist || []).length > 0;
  if (hasAllFeatures && !earned.has('chal_all_used')) newBadges.push('chal_all_used');
  if (totalLedgerDays >= 100 && !earned.has('chal_100days')) newBadges.push('chal_100days');

  const budgetCatCount = Object.values(state.budgets || {}).reduce((max, mb) => Math.max(max, Object.keys(mb || {}).length), 0);
  if (budgetCatCount >= 5 && !earned.has('chal_budget_all')) newBadges.push('chal_budget_all');

  const allHalbuDone = (state.entries || []).filter(e => e.category === '할부').length > 0 &&
    (state.entries || []).filter(e => e.category === '할부').every(e => e.endMonth && parseInt(e.endMonth, 10) < todayYm);
  if (allHalbuDone && !earned.has('chal_no_halbu')) newBadges.push('chal_no_halbu');

  const oneYearYm = Number(`${now.getFullYear() + 1}${pad2(now.getMonth() + 1)}`);
  if ((state.goals || []).some(g => g.targetDate && Number(String(g.targetDate).replace('-', '')) >= oneYearYm) && !earned.has('chal_save_1year')) {
    newBadges.push('chal_save_1year');
  }
  if ((state.goals || []).length >= 10 && !earned.has('chal_10goals')) newBadges.push('chal_10goals');
  if ((state.goals || []).some(g => (g.targetAmount || 0) >= 10_000_000) && !earned.has('chal_millionaire')) newBadges.push('chal_millionaire');
  if (!(state.entries || []).some(e => e.category === '할부') && !earned.has('chal_debt_zero')) newBadges.push('chal_debt_zero');

  return newBadges;
}

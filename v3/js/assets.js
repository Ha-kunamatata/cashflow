// ════════════════════════════════════════════════════════
// assets.js — 자산 관리 헬퍼
// ════════════════════════════════════════════════════════

export const ASSET_TYPES = {
  bank:        { icon: '🏦', label: '은행 통장' },
  savings:     { icon: '💰', label: '적금/예금' },
  investment:  { icon: '📈', label: '주식/ETF' },
  cash:        { icon: '💵', label: '현금' },
  crypto:      { icon: '🪙', label: '가상화폐' },
  real_estate: { icon: '🏠', label: '부동산' },
  other:       { icon: '📦', label: '기타' },
};

export const ASSET_PURPOSES = ['생활비', '비상금', '투자금', '저축', '자유'];

export const PURPOSE_COLORS = {
  생활비: '#3b82f6',
  비상금: '#10b981',
  투자금: '#f59e0b',
  저축:   '#8b5cf6',
  자유:   '#64748b',
};

export function getTotalAssets(assets) {
  return (assets || []).reduce((s, a) => s + a.amount, 0);
}

export function getUsableMoney(assets) {
  return (assets || [])
    .filter(a => !['비상금', '투자금'].includes(a.purpose))
    .reduce((s, a) => s + a.amount, 0);
}

export function getAssetsByPurpose(assets) {
  const map = {};
  for (const a of (assets || [])) {
    map[a.purpose] = (map[a.purpose] || 0) + a.amount;
  }
  return map;
}

// ── 자산 레벨 시스템 (10단계 + 상세 스토리) ─────────────
export const HOUSE_LEVELS = [
  {
    id: 'ruin',
    icon: '🏚️', bigIcon: '🏚️',
    label: '폐가',
    sublabel: 'Level 0',
    desc: '자산이 마이너스 상태입니다.\n부채를 갚고 새 출발을 해보세요.',
    color: '#ef4444',
    min: -Infinity,
    max: 0,
    tip: '지출을 줄이고 수입을 늘려 빚부터 청산하세요.',
    bonus: '없음',
  },
  {
    id: 'tent',
    icon: '⛺', bigIcon: '⛺',
    label: '텐트',
    sublabel: 'Level 1',
    desc: '야외에서 하루하루를 버티는 단계.\n첫 백만원이 목표입니다.',
    color: '#f97316',
    min: 0,
    max: 1_000_000,
    tip: '월 5만원씩 저축하면 20개월 후 텐트 탈출!',
    bonus: '기록 시작 배지 지급',
  },
  {
    id: 'gosiwon',
    icon: '🛖', bigIcon: '🛖',
    label: '고시원',
    sublabel: 'Level 2',
    desc: '작은 공간이지만 내 공간이 생겼습니다.\n기초 자산 형성 단계.',
    color: '#eab308',
    min: 1_000_000,
    max: 3_000_000,
    tip: '고정 지출을 줄이면 저축 속도가 2배!',
    bonus: '첫 백만원 배지',
  },
  {
    id: 'oneroom',
    icon: '🏠', bigIcon: '🏠',
    label: '원룸',
    sublabel: 'Level 3',
    desc: '나만의 독립 공간 확보!\n생활 기반을 다지는 중요한 시기.',
    color: '#84cc16',
    min: 3_000_000,
    max: 10_000_000,
    tip: '비상금 3개월치를 먼저 채우세요.',
    bonus: '저축 배지, 예산 추적 활성화',
  },
  {
    id: 'villa',
    icon: '🏡', bigIcon: '🏡',
    label: '빌라',
    sublabel: 'Level 4',
    desc: '점점 안정적인 삶의 기반!\n투자를 시작할 여유가 생겼습니다.',
    color: '#10b981',
    min: 10_000_000,
    max: 30_000_000,
    tip: '수입의 20%를 투자에 배분해보세요.',
    bonus: '빌라 레벨 배지, 투자 추천 활성화',
  },
  {
    id: 'apartment',
    icon: '🏢', bigIcon: '🏢',
    label: '아파트',
    sublabel: 'Level 5',
    desc: '드디어 아파트 입주!\n자산이 본격적으로 불어나는 단계.',
    color: '#3b82f6',
    min: 30_000_000,
    max: 70_000_000,
    tip: '복리 투자의 마법이 시작됩니다.',
    bonus: '아파트 배지, 분석 리포트 강화',
  },
  {
    id: 'highrise',
    icon: '🏙️', bigIcon: '🏙️',
    label: '고층 아파트',
    sublabel: 'Level 6',
    desc: '고층에서 내려다보는 뷰!\n자산 관리의 달인이 되어가는 중.',
    color: '#6366f1',
    min: 70_000_000,
    max: 150_000_000,
    tip: '포트폴리오 다각화로 리스크를 줄이세요.',
    bonus: '고층 배지, AI 분석 고도화',
  },
  {
    id: 'penthouse',
    icon: '🏰', bigIcon: '🏰',
    label: '펜트하우스',
    sublabel: 'Level 7',
    desc: '최상층 펜트하우스 입성!\n자산 관리의 정점에 올랐습니다.',
    color: '#a855f7',
    min: 150_000_000,
    max: 500_000_000,
    tip: '세금 최적화와 법인 설립을 고려해보세요.',
    bonus: '펜트하우스 배지, 전설 등급 해금',
  },
  {
    id: 'mansion',
    icon: '🌆', bigIcon: '🌆',
    label: '맨션',
    sublabel: 'Level 8',
    desc: '나만의 맨션!\n부의 자동화가 이루어지는 단계.',
    color: '#ec4899',
    min: 500_000_000,
    max: 1_000_000_000,
    tip: '패시브 인컴으로 월 지출을 커버하고 있나요?',
    bonus: '맨션 배지, 전설 배지 전체 해금',
  },
  {
    id: 'castle',
    icon: '🏯', bigIcon: '🏯',
    label: '성 (CASTLE)',
    sublabel: 'Level 9 — MAX',
    desc: '🎉 모든 레벨 정복!\n재정적 자유를 완전히 달성했습니다.',
    color: '#f59e0b',
    min: 1_000_000_000,
    max: Infinity,
    tip: '이제 다음 세대를 위한 계획을 세워보세요.',
    bonus: '성 배지 + 전설 타이틀 [재정 자유인]',
  },
];

export function getHouseLevel(netWorth) {
  const level = HOUSE_LEVELS.find(l => netWorth >= l.min && netWorth < l.max)
    || HOUSE_LEVELS[HOUSE_LEVELS.length - 1];
  const idx = HOUSE_LEVELS.indexOf(level);
  const nextLevel = HOUSE_LEVELS[idx + 1] || null;
  return {
    ...level,
    index: idx,
    totalLevels: HOUSE_LEVELS.length,
    next: nextLevel ? nextLevel.min : null,
    nextLabel: nextLevel ? nextLevel.label : null,
    nextIcon: nextLevel ? nextLevel.icon : null,
  };
}

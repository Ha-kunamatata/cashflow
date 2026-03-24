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
  // total minus 비상금 and 투자금
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

export function getHouseLevel(netWorth) {
  if (netWorth < 0)            return { icon: '🏚️', label: '폐가',        next: 0,           nextLabel: '텐트' };
  if (netWorth < 1_000_000)    return { icon: '⛺',  label: '텐트',        next: 1_000_000,   nextLabel: '원룸' };
  if (netWorth < 5_000_000)    return { icon: '🏠',  label: '원룸',        next: 5_000_000,   nextLabel: '빌라' };
  if (netWorth < 10_000_000)   return { icon: '🏡',  label: '빌라',        next: 10_000_000,  nextLabel: '아파트' };
  if (netWorth < 30_000_000)   return { icon: '🏢',  label: '아파트',      next: 30_000_000,  nextLabel: '고층 아파트' };
  if (netWorth < 100_000_000)  return { icon: '🏙️',  label: '고층 아파트', next: 100_000_000, nextLabel: '펜트하우스' };
  return                              { icon: '🏰',  label: '펜트하우스', next: null,         nextLabel: null };
}

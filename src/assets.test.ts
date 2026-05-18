import { describe, it, expect } from 'vitest';
import { getTotalAssets, getUsableMoney, getHouseLevel } from './assets';
import type { Asset } from './types';

function makeAsset(overrides: Partial<Asset>): Asset {
  return {
    id: '1',
    type: 'bank',
    purpose: '생활비',
    name: '테스트',
    amount: 0,
    ...overrides,
  };
}

describe('getTotalAssets', () => {
  it('returns 0 for empty array', () => expect(getTotalAssets([])).toBe(0));
  it('returns 0 for null', () => expect(getTotalAssets(null)).toBe(0));
  it('sums all asset amounts', () => {
    const assets = [
      makeAsset({ amount: 500000 }),
      makeAsset({ amount: 1000000 }),
      makeAsset({ amount: 250000 }),
    ];
    expect(getTotalAssets(assets)).toBe(1750000);
  });
});

describe('getUsableMoney', () => {
  it('excludes 비상금 and 투자금', () => {
    const assets = [
      makeAsset({ purpose: '생활비', amount: 500000 }),
      makeAsset({ purpose: '비상금', amount: 1000000 }),
      makeAsset({ purpose: '투자금', amount: 2000000 }),
      makeAsset({ purpose: '저축', amount: 300000 }),
    ];
    expect(getUsableMoney(assets)).toBe(800000); // 500000 + 300000
  });

  it('returns full amount if all are usable', () => {
    const assets = [
      makeAsset({ purpose: '생활비', amount: 100000 }),
      makeAsset({ purpose: '자유', amount: 200000 }),
    ];
    expect(getUsableMoney(assets)).toBe(300000);
  });
});

describe('getHouseLevel', () => {
  it('returns the negative-debt level for -1', () => {
    const info = getHouseLevel(-1);
    expect(info.min).toBe(-Infinity);
    expect(info.max).toBe(0);
  });

  it('returns index > 0 for 0 net worth (0 is not in the debt level)', () => {
    const info = getHouseLevel(0);
    // HOUSE_LEVELS[0] covers < 0; 0 belongs to the next level
    expect(info.index).toBeGreaterThan(0);
    expect(info.min).toBe(0);
  });

  it('returns last level for very large net worth', () => {
    const info = getHouseLevel(999_999_999_999);
    expect(info.index).toBe(info.totalLevels - 1);
    expect(info.next).toBeNull(); // no next level at max
  });

  it('provides next level info when not at max', () => {
    const info = getHouseLevel(0);
    expect(info.next).toBeGreaterThan(0);
    expect(info.nextLabel).toBeTruthy();
  });

  it('index increases as net worth grows', () => {
    const a = getHouseLevel(1_000_000);
    const b = getHouseLevel(100_000_000);
    expect(b.index).toBeGreaterThan(a.index);
  });
});

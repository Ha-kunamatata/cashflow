import { describe, it, expect } from 'vitest';
import { escapeHtml, p2, dateKey, yyyymm, fmtFull, fmtShort, fmtSigned, addDays } from './utils';

describe('escapeHtml', () => {
  it('escapes ampersand', () => expect(escapeHtml('a&b')).toBe('a&amp;b'));
  it('escapes less-than', () => expect(escapeHtml('<b>')).toBe('&lt;b&gt;'));
  it('escapes double quotes', () => expect(escapeHtml('"hi"')).toBe('&quot;hi&quot;'));
  it('escapes single quotes', () => expect(escapeHtml("it's")).toBe('it&#39;s'));
  it('handles null/undefined safely', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
  it('passes through safe strings', () => expect(escapeHtml('hello')).toBe('hello'));
});

describe('p2', () => {
  it('pads single digit', () => expect(p2(3)).toBe('03'));
  it('leaves double digit unchanged', () => expect(p2(12)).toBe('12'));
  it('accepts string input', () => expect(p2('5')).toBe('05'));
});

describe('dateKey', () => {
  it('formats date as YYYY-MM-DD', () => {
    expect(dateKey(new Date(2024, 0, 5))).toBe('2024-01-05');
  });
  it('handles end of year', () => {
    expect(dateKey(new Date(2023, 11, 31))).toBe('2023-12-31');
  });
  it('accepts string input', () => {
    expect(dateKey('2024-06-15')).toBe('2024-06-15');
  });
});

describe('yyyymm', () => {
  it('returns correct YYYYMM number', () => {
    expect(yyyymm(new Date(2024, 2, 1))).toBe(202403);
  });
  it('handles December correctly', () => {
    expect(yyyymm(new Date(2023, 11, 1))).toBe(202312);
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    const result = addDays(new Date(2024, 0, 1), 5);
    expect(result.getDate()).toBe(6);
    expect(result.getMonth()).toBe(0);
  });
  it('crosses month boundary', () => {
    const result = addDays(new Date(2024, 0, 30), 3);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(2);
  });
  it('handles negative days', () => {
    const result = addDays(new Date(2024, 0, 10), -3);
    expect(result.getDate()).toBe(7);
  });
});

describe('fmtFull', () => {
  it('formats with 원 suffix', () => expect(fmtFull(50000)).toBe('50,000원'));
  it('handles zero', () => expect(fmtFull(0)).toBe('0원'));
  it('handles null', () => expect(fmtFull(null)).toBe('0원'));
  it('handles string number', () => expect(fmtFull('1000')).toBe('1,000원'));
});

describe('fmtShort', () => {
  it('formats numbers under 10,000 as-is', () => expect(fmtShort(9999)).toBe('9,999원'));
  it('formats 10,000 as 1만원', () => expect(fmtShort(10000)).toBe('1만원'));
  it('formats 50,000 as 5만원', () => expect(fmtShort(50000)).toBe('5만원'));
  it('formats 100,000,000 as 1억원', () => expect(fmtShort(100_000_000)).toBe('1억원'));
  it('handles negative', () => expect(fmtShort(-50000)).toBe('-5만원'));
});

describe('fmtSigned', () => {
  it('adds + for positive', () => expect(fmtSigned(10000)).toBe('+1만원'));
  it('adds - for negative', () => expect(fmtSigned(-10000)).toBe('-1만원'));
  it('adds + for zero', () => expect(fmtSigned(0)).toBe('+0원'));
});

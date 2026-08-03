import { describe, expect, it } from 'vitest';
import { formatDate, formatIDR, parseIsoMs, toIsoMs } from '../format';

describe('toIsoMs', () => {
  it('emits fixed-width millisecond RFC3339 UTC (server contract)', () => {
    expect(toIsoMs(new Date(Date.UTC(2026, 6, 1, 12, 0, 0, 500)))).toBe('2026-07-01T12:00:00.500Z');
    expect(toIsoMs(new Date(Date.UTC(2026, 6, 1, 12, 0, 0, 0)))).toBe('2026-07-01T12:00:00.000Z');
  });
});

describe('parseIsoMs', () => {
  it('parses the canonical format', () => {
    expect(parseIsoMs('2026-07-01T12:00:00.500Z')?.getUTCHours()).toBe(12);
  });
  it('rejects second-precision, offsets, and wrong fraction widths', () => {
    expect(parseIsoMs('2026-07-01T12:00:00Z')).toBeNull();
    expect(parseIsoMs('2026-07-01T12:00:00+07:00')).toBeNull();
    expect(parseIsoMs('2026-07-01T12:00:00.5Z')).toBeNull();
    expect(parseIsoMs('garbage')).toBeNull();
  });
});

describe('formatIDR', () => {
  it('formats integer rupiah with thousand separators', () => {
    expect(formatIDR(65000)).toBe('Rp65.000');
    expect(formatIDR(123456789)).toBe('Rp123.456.789');
    expect(formatIDR(0)).toBe('Rp0');
  });
});

describe('formatDate', () => {
  it('formats Indonesian date from ISO ms string', () => {
    expect(formatDate('2026-07-01T12:00:00.500Z', 'id')).toBe('1 Juli 2026');
  });
  it('formats English date', () => {
    expect(formatDate('2026-07-01T12:00:00.500Z', 'en')).toBe('1 July 2026');
  });
});

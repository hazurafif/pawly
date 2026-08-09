import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ageFrom,
  dayKey,
  dayKeyOfIso,
  formatDate,
  formatIDR,
  formatTime,
  isIsoDateInput,
  parseIsoMs,
  parseLocalDateInput,
  relativeDayLabel,
  startOfTodayIso,
  toIsoMs,
  weightKg,
} from '../format';

afterEach(() => {
  vi.useRealTimers();
});

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

describe('dayKey', () => {
  it('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(dayKey(new Date(2026, 6, 1, 12))).toBe('2026-07-01');
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('dayKeyOfIso', () => {
  it('converts a valid ISO ms timestamp to the local day key', () => {
    expect(dayKeyOfIso('2026-07-01T12:00:00.500Z')).toBe(dayKey(new Date('2026-07-01T12:00:00.500Z')));
  });
  it('returns null for malformed input', () => {
    expect(dayKeyOfIso('garbage')).toBeNull();
  });
});

describe('startOfTodayIso', () => {
  it('emits local midnight on the current day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 8, 14, 30));
    const result = startOfTodayIso();
    const d = parseIsoMs(result);
    expect(d).not.toBeNull();
    expect(dayKey(d!)).toBe(dayKey(new Date()));
    expect(d!.getHours()).toBe(0);
    expect(d!.getMinutes()).toBe(0);
  });
});

describe('parseLocalDateInput', () => {
  it('parses a YYYY-MM-DD form value into local noon UTC ISO', () => {
    const iso = parseLocalDateInput('2026-08-05');
    expect(iso).not.toBeNull();
    expect(iso!.slice(0, 10)).toBe('2026-08-05');
    // Local noon: the wall-clock hour in the test environment is 12:00.
    expect(new Date(iso!).getHours()).toBe(12);
  });

  it('returns null for empty and whitespace-only input', () => {
    expect(parseLocalDateInput('')).toBeNull();
    expect(parseLocalDateInput('   ')).toBeNull();
  });

  it('rejects non-date garbage and wrong shapes', () => {
    expect(parseLocalDateInput('garbage')).toBeNull();
    expect(parseLocalDateInput('2026-8-5')).toBeNull();
    expect(parseLocalDateInput('2026/08/05')).toBeNull();
    expect(parseLocalDateInput('2026-08-05T00:00')).toBeNull();
  });

  it('rejects impossible calendar dates instead of rolling over', () => {
    expect(parseLocalDateInput('2026-02-30')).toBeNull();
    expect(parseLocalDateInput('2026-13-01')).toBeNull();
    expect(parseLocalDateInput('2026-00-10')).toBeNull();
  });

  it('accepts leap-day dates on leap years only', () => {
    expect(parseLocalDateInput('2024-02-29')).not.toBeNull();
    expect(parseLocalDateInput('2026-02-29')).toBeNull();
  });
});

describe('isIsoDateInput', () => {
  it('is true exactly for real calendar dates', () => {
    expect(isIsoDateInput('2026-08-05')).toBe(true);
    expect(isIsoDateInput('')).toBe(false);
    expect(isIsoDateInput('not-a-date')).toBe(false);
    expect(isIsoDateInput('2026-13-01')).toBe(false);
  });
});

describe('formatTime', () => {
  it('renders a HH:MM local time', () => {
    expect(formatTime('2026-07-01T14:32:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
  });
  it('returns malformed input unchanged', () => {
    expect(formatTime('garbage')).toBe('garbage');
  });
});

describe('relativeDayLabel', () => {
  it('labels today, yesterday, and older dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T00:00:00.000Z'));
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    expect(relativeDayLabel(today, 'en')).toBe('Today');
    expect(relativeDayLabel(today, 'id')).toBe('Hari ini');
    expect(relativeDayLabel(yesterday, 'en')).toBe('Yesterday');
    expect(relativeDayLabel(yesterday, 'id')).toBe('Kemarin');
    expect(relativeDayLabel('2026-07-01T12:00:00.500Z', 'en')).toBe('1 July 2026');
  });
  it('returns malformed input unchanged', () => {
    expect(relativeDayLabel('garbage', 'en')).toBe('garbage');
  });
});

describe('ageFrom', () => {
  it('renders years and months from a reference date', () => {
    const now = new Date(2026, 7, 8);
    expect(ageFrom(new Date(2024, 2, 15).toISOString(), now)).toBe('2y 4m');
    expect(ageFrom(new Date(2024, 7, 8).toISOString(), now)).toBe('2y');
    expect(ageFrom(new Date(2026, 6, 1).toISOString(), now)).toBe('1m');
  });
  it('returns null for missing, invalid, or future dates', () => {
    const now = new Date(2026, 7, 8);
    expect(ageFrom(null, now)).toBeNull();
    expect(ageFrom('garbage', now)).toBeNull();
    expect(ageFrom(new Date(2026, 8, 8).toISOString(), now)).toBeNull();
    expect(ageFrom(null)).toBeNull();
  });
});

describe('weightKg', () => {
  it('extracts a finite numeric kg value', () => {
    expect(weightKg('{"kg":4.3}')).toBe(4.3);
    expect(weightKg('{"kg":0}')).toBe(0);
  });
  it('returns null for missing, malformed, or non-numeric payloads', () => {
    expect(weightKg(null)).toBeNull();
    expect(weightKg('{}')).toBeNull();
    expect(weightKg('garbage')).toBeNull();
    expect(weightKg('{"kg":"4.3"}')).toBeNull();
  });
});

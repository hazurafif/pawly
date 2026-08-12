import { describe, expect, it } from 'vitest';
import { addMonths, cellDayKey, monthGrid, todayPosition } from '../calendar';

describe('monthGrid', () => {
  it('starts on the weekday of the 1st (Sunday-first) and pads to full weeks', () => {
    // August 2026: Aug 1 is a Saturday (getUTCDay = 6), 31 days.
    const cells = monthGrid(2026, 7);
    expect(cells).toHaveLength(6 * 7); // padded to full weeks
    expect(cells[0]).toBeNull(); // Sun..Fri blanks before Saturday
    expect(cells.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(cells[6]?.getUTCDate()).toBe(1);
    expect(cells.filter((c) => c !== null)).toHaveLength(31);
  });

  it('handles a month starting on Sunday without leading blanks', () => {
    // November 2026 starts on a Sunday.
    const cells = monthGrid(2026, 10);
    expect(cells[0]?.getUTCDate()).toBe(1);
    expect(cells[0]?.getUTCDay()).toBe(0);
  });

  it('pads trailing days to complete the last week', () => {
    // September 2026: Sep 1 is a Tuesday (2 leading blanks), 30 days → 35 cells.
    const cells = monthGrid(2026, 8);
    expect(cells.length % 7).toBe(0);
    expect(cells).toHaveLength(35);
    const dates = cells.filter((c) => c !== null);
    expect(dates).toHaveLength(30);
    expect(cells[cells.length - 1]).toBeNull();
  });
});

describe('cellDayKey', () => {
  it('formats a zero-padded YYYY-MM-DD key', () => {
    expect(cellDayKey(new Date(Date.UTC(2026, 7, 1)))).toBe('2026-08-01');
    expect(cellDayKey(new Date(Date.UTC(2026, 11, 31)))).toBe('2026-12-31');
  });
});

describe('addMonths', () => {
  it('wraps years and months', () => {
    expect(addMonths({ year: 2026, month: 7 }, -1)).toEqual({ year: 2026, month: 6 });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  });
});

describe('todayPosition', () => {
  it('returns the current year and month', () => {
    const now = new Date();
    expect(todayPosition()).toEqual({ year: now.getFullYear(), month: now.getMonth() });
  });
});

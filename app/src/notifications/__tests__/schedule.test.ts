import { describe, expect, it } from 'vitest';
import { notificationId, ruleTriggers } from '../schedule';

// All fixtures are fixed instants — the functions are pure (afterMs-driven).
const NOW = Date.parse('2026-08-10T00:00:00.000Z');

const rule = (due: string, repeat: string) => ({ due, repeat });

describe('ruleTriggers', () => {
  it('schedules a future once rule exactly once', () => {
    expect(ruleTriggers(rule('2026-08-20T00:00:00.000Z', 'once'), { afterMs: NOW, count: 4 }))
      .toEqual(['2026-08-20T00:00:00.000Z']);
  });

  it('returns nothing for a past once rule', () => {
    expect(ruleTriggers(rule('2026-08-01T00:00:00.000Z', 'once'), { afterMs: NOW, count: 4 }))
      .toEqual([]);
  });

  it('steps a past daily rule forward to the next occurrences', () => {
    expect(ruleTriggers(rule('2026-08-08T00:00:00.000Z', 'daily'), { afterMs: NOW, count: 3 }))
      .toEqual([
        '2026-08-10T00:00:00.000Z',
        '2026-08-11T00:00:00.000Z',
        '2026-08-12T00:00:00.000Z',
      ]);
  });

  it('triggers at the anchor when a repeating rule is still in the future', () => {
    // "daily meds starting tomorrow" must not skip tomorrow.
    expect(ruleTriggers(rule('2026-08-12T00:00:00.000Z', 'daily'), { afterMs: NOW, count: 2 }))
      .toEqual(['2026-08-12T00:00:00.000Z', '2026-08-13T00:00:00.000Z']);
  });

  it('steps weekly rules by seven days', () => {
    expect(ruleTriggers(rule('2026-08-01T00:00:00.000Z', 'weekly'), { afterMs: NOW, count: 2 }))
      .toEqual(['2026-08-15T00:00:00.000Z', '2026-08-22T00:00:00.000Z']);
  });

  it('steps monthly rules by one month', () => {
    expect(ruleTriggers(rule('2026-08-01T00:00:00.000Z', 'monthly'), { afterMs: NOW, count: 2 }))
      .toEqual(['2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z']);
  });

  it('moves the anchor forward past a completion', () => {
    // Daily rule anchored Aug 1, completed Aug 9 09:00 — the next trigger
    // is Aug 10 09:00 (completion + 1 day), matching rules.nextDueIso.
    expect(ruleTriggers(rule('2026-08-01T00:00:00.000Z', 'daily'), {
      afterMs: NOW,
      count: 2,
      lastCompletedAt: '2026-08-09T09:00:00.000Z',
    })).toEqual(['2026-08-10T09:00:00.000Z', '2026-08-11T09:00:00.000Z']);
  });

  it('ignores a completion older than the anchor', () => {
    expect(ruleTriggers(rule('2026-08-12T00:00:00.000Z', 'daily'), {
      afterMs: NOW,
      count: 1,
      lastCompletedAt: '2026-08-01T09:00:00.000Z',
    })).toEqual(['2026-08-12T00:00:00.000Z']);
  });

  it('caps occurrences at count', () => {
    expect(ruleTriggers(rule('2026-08-08T00:00:00.000Z', 'daily'), { afterMs: NOW, count: 1 }))
      .toEqual(['2026-08-10T00:00:00.000Z']);
  });

  it('returns nothing for an unparsable due', () => {
    expect(ruleTriggers(rule('not-a-date', 'daily'), { afterMs: NOW, count: 4 })).toEqual([]);
  });
});

describe('notificationId', () => {
  it('is stable and unique per rule occurrence', () => {
    expect(notificationId('abc', 0)).toBe('pawly-rule-abc#0');
    expect(notificationId('abc', 1)).toBe('pawly-rule-abc#1');
    expect(notificationId('abc', 0)).not.toBe(notificationId('abd', 0));
  });
});

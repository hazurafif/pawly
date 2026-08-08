import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Event } from '../../db/types';
import { isDueSoon, lastCompletionForRule, nextDueIso, ruleStatus } from '../rules';

const NOW = '2026-08-08T00:00:00.000Z';

function freezeTime(): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
}

afterEach(() => {
  vi.useRealTimers();
});

function taskEvent(id: string, ruleId: string | null, occurredAt: string): Event {
  return {
    id,
    pet_id: 'p-1',
    kind: 'task',
    title: null,
    text: null,
    occurred_at: occurredAt,
    next_due_at: null,
    data: ruleId ? JSON.stringify({ rule_id: ruleId }) : null,
    favorite: 0,
    created_at: occurredAt,
    updated_at: occurredAt,
    deleted_at: null,
  };
}

describe('nextDueIso', () => {
  it('returns the anchor for once-only rules, ignoring completions', () => {
    const rule = { due: '2026-08-01T00:00:00.000Z', repeat: 'once' as const };
    expect(nextDueIso(rule, '2026-08-05T00:00:00.000Z')).toBe('2026-08-01T00:00:00.000Z');
  });

  it('returns null when the due date is not a valid ISO ms timestamp', () => {
    expect(nextDueIso({ due: 'garbage', repeat: 'daily' }, null)).toBeNull();
  });

  it('falls back to the anchor when the last completion is unparseable', () => {
    const rule = { due: '2026-08-01T00:00:00.000Z', repeat: 'daily' };
    expect(nextDueIso(rule, 'garbage')).toBe('2026-08-01T00:00:00.000Z');
  });

  it('advances daily from the last completion', () => {
    freezeTime();
    const rule = { due: '2026-08-01T00:00:00.000Z', repeat: 'daily' };
    expect(nextDueIso(rule, '2026-08-07T00:00:00.000Z')).toBe('2026-08-08T00:00:00.000Z');
  });

  it('advances weekly from the last completion', () => {
    freezeTime();
    const rule = { due: '2026-08-01T00:00:00.000Z', repeat: 'weekly' };
    expect(nextDueIso(rule, '2026-08-01T00:00:00.000Z')).toBe('2026-08-08T00:00:00.000Z');
  });

  it('advances monthly from the last completion', () => {
    freezeTime();
    const rule = { due: '2026-07-15T00:00:00.000Z', repeat: 'monthly' };
    expect(nextDueIso(rule, '2026-07-15T00:00:00.000Z')).toBe('2026-08-15T00:00:00.000Z');
  });

  it('never returns a past date for a stale anchor', () => {
    freezeTime();
    const rule = { due: '2026-07-20T00:00:00.000Z', repeat: 'daily' };
    expect(nextDueIso(rule, null)).toBe('2026-08-08T00:00:00.000Z');
  });

  it('returns the anchor for unknown repeat cadences', () => {
    freezeTime();
    const rule = { due: '2026-09-01T00:00:00.000Z', repeat: 'yearly' };
    expect(nextDueIso(rule, '2026-08-01T00:00:00.000Z')).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('lastCompletionForRule', () => {
  it('returns the latest task completion for the rule', () => {
    const events = [
      taskEvent('e-1', 'r-1', '2026-08-01T07:00:00.000Z'),
      taskEvent('e-2', 'r-1', '2026-08-05T09:00:00.000Z'),
      taskEvent('e-3', 'r-2', '2026-08-06T09:00:00.000Z'),
    ];
    expect(lastCompletionForRule(events, 'r-1')).toBe('2026-08-05T09:00:00.000Z');
  });

  it('ignores non-task events, malformed data, and other rule ids', () => {
    const events: Event[] = [
      taskEvent('e-1', 'r-1', '2026-08-01T07:00:00.000Z'),
      { ...taskEvent('e-2', null, '2026-08-02T07:00:00.000Z'), kind: 'feed', data: '{"rule_id":"r-1"}' },
      { ...taskEvent('e-3', 'r-1', '2026-08-03T07:00:00.000Z'), data: '{broken' },
      taskEvent('e-4', 'r-9', '2026-08-04T07:00:00.000Z'),
    ];
    expect(lastCompletionForRule(events, 'r-1')).toBe('2026-08-01T07:00:00.000Z');
  });

  it('returns null when the rule has no completions', () => {
    expect(lastCompletionForRule([], 'r-1')).toBeNull();
    expect(lastCompletionForRule([taskEvent('e-1', 'r-2', '2026-08-01T07:00:00.000Z')], 'r-1')).toBeNull();
  });
});

describe('ruleStatus', () => {
  it('treats a missing due date as upcoming', () => {
    expect(ruleStatus(null, NOW)).toBe('upcoming');
  });

  it('marks past and current instants overdue', () => {
    expect(ruleStatus('2026-08-01T00:00:00.000Z', NOW)).toBe('overdue');
    expect(ruleStatus('2026-08-08T00:00:00.000Z', NOW)).toBe('overdue');
  });

  it('marks future instants upcoming', () => {
    expect(ruleStatus('2026-08-09T00:00:00.000Z', NOW)).toBe('upcoming');
  });
});

describe('isDueSoon', () => {
  it('is false without a due date or with a malformed one', () => {
    expect(isDueSoon(null, 7)).toBe(false);
    expect(isDueSoon('garbage', 7)).toBe(false);
  });

  it('includes past and horizon-boundary instants, exclusive beyond', () => {
    freezeTime();
    expect(isDueSoon('2026-08-01T00:00:00.000Z', 7)).toBe(true);
    expect(isDueSoon('2026-08-15T00:00:00.000Z', 7)).toBe(true);
    expect(isDueSoon('2026-08-16T00:00:00.000Z', 7)).toBe(false);
  });
});

import type { Event, ReminderRule, Repeat } from '../db/types';
import { parseIsoMs } from './format';

// Computes the next occurrence of a reminder rule from its anchor date and
// repeat cadence, relative to the last completion (an event of kind 'task'
// whose data is { rule_id }). Returns the ISO timestamp of the next due
// instant, or null when the rule's due date is unknown.
export function nextDueIso(
  rule: Pick<ReminderRule, 'due' | 'repeat'>,
  lastCompletedAt: string | null
): string | null {
  const anchor = parseIsoMs(rule.due);
  if (!anchor) {
    return null;
  }
  if (rule.repeat === 'once') {
    return rule.due;
  }
  const from = parseIsoMs(lastCompletedAt ?? rule.due);
  if (!from) {
    return rule.due;
  }
  const next = new Date(from);
  switch (rule.repeat as Repeat) {
    case 'daily':
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    default:
      return rule.due;
  }
  // A stale anchor (completion long after due) must not spawn past dates:
  // advance until the next occurrence is not in the past.
  if (rule.repeat !== 'once') {
    const now = Date.now();
    while (next.getTime() < now) {
      switch (rule.repeat) {
        case 'daily':
          next.setUTCDate(next.getUTCDate() + 1);
          break;
        case 'weekly':
          next.setUTCDate(next.getUTCDate() + 7);
          break;
        case 'monthly':
          next.setUTCMonth(next.getUTCMonth() + 1);
          break;
      }
    }
  }
  return next.toISOString();
}

export function lastCompletionForRule(events: Event[], ruleId: string): string | null {
  let latest: string | null = null;
  for (const e of events) {
    if (e.kind !== 'task' || !e.data) {
      continue;
    }
    let rule: { rule_id?: unknown } | null = null;
    try {
      rule = JSON.parse(e.data) as { rule_id?: unknown };
    } catch {
      continue;
    }
    if (rule?.rule_id === ruleId) {
      if (!latest || e.occurred_at > latest) {
        latest = e.occurred_at;
      }
    }
  }
  return latest;
}

export type RuleStatus = 'overdue' | 'due' | 'upcoming';

export function ruleStatus(nextDue: string | null, nowIso: string): RuleStatus {
  if (!nextDue) {
    return 'upcoming';
  }
  return nextDue <= nowIso ? 'overdue' : 'upcoming';
}

// Rules whose next due lands within `horizonDays` (inclusive) or is past.
export function isDueSoon(nextDue: string | null, horizonDays: number): boolean {
  if (!nextDue) {
    return false;
  }
  const due = parseIsoMs(nextDue);
  if (!due) {
    return false;
  }
  const horizon = Date.now() + horizonDays * 86_400_000;
  return due.getTime() <= horizon;
}

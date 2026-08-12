import type { ReminderRule, Repeat } from '../db/types';
import { parseIsoMs } from '../lib/format';

// Notification scheduling logic — pure and unit-tested, no expo imports.
//
// Rules store `due` as a date-only instant (`YYYY-MM-DDT00:00:00.000Z`).
// For a repeating rule, `due` is the anchor (first occurrence / last done);
// occurrences step by the cadence. A completion (task event with
// `data.rule_id`) moves the anchor forward, mirroring rules.nextDueIso.
// Unlike nextDueIso, a repeating rule whose anchor is still in the future
// triggers AT the anchor — a "daily meds starting tomorrow" rule must not
// skip tomorrow.

export const OCCURRENCES_AHEAD = 4;

export interface RuleTriggerInput {
  due: string;
  repeat: string;
}

export interface RuleTriggerOptions {
  /** Only occurrences at/after this instant are returned (ms epoch). */
  afterMs: number;
  /** Max number of occurrences to return per rule. */
  count: number;
  /** ISO timestamp of the rule's last completion (task event), if any. */
  lastCompletedAt?: string | null;
}

function step(date: Date, repeat: Repeat): void {
  switch (repeat) {
    case 'daily':
      date.setUTCDate(date.getUTCDate() + 1);
      break;
    case 'weekly':
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case 'monthly':
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
  }
}

// Returns up to `count` future trigger instants (ISO) for a rule, earliest
// first. Empty when the rule has no future occurrence (past "once" rule).
export function ruleTriggers(rule: RuleTriggerInput, opts: RuleTriggerOptions): string[] {
  const anchor = parseIsoMs(rule.due);
  if (!anchor) {
    return [];
  }
  const completed = opts.lastCompletedAt ? parseIsoMs(opts.lastCompletedAt) : null;
  const fromMs = Math.max(anchor.getTime(), completed?.getTime() ?? 0);
  if (rule.repeat === 'once') {
    return fromMs >= opts.afterMs ? [new Date(fromMs).toISOString()] : [];
  }
  const next = new Date(fromMs);
  while (next.getTime() < opts.afterMs) {
    step(next, rule.repeat as Repeat);
  }
  const triggers: string[] = [];
  for (let i = 0; i < opts.count; i++) {
    triggers.push(next.toISOString());
    step(next, rule.repeat as Repeat);
  }
  return triggers;
}

// Stable, unique notification identifier for a rule occurrence.
export function notificationId(ruleId: string, index: number): string {
  return `pawly-rule-${ruleId}#${index}`;
}

export type { ReminderRule };

import type { Event } from '../db/types';
import { dayKeyOfIso } from './format';

// Gentle daily care targets per quick-log kind. These are soft goals for
// the Today checklist — a miss is never punished, just shown as remaining.
export const CHECKLIST_TARGETS: Record<string, number> = {
  feed: 2,
  water: 3,
  potty: 2,
  walk: 1,
};

export interface ChecklistItem {
  kind: string;
  target: number;
  done: number;
}

export interface ChecklistProgress {
  items: ChecklistItem[];
  done: number;
  total: number;
}

// Counts today's events (in the user's timezone) against the soft targets.
export function checklistProgress(todayEvents: Event[]): ChecklistProgress {
  const counts: Record<string, number> = {};
  const todayKey = new Date().toLocaleDateString('en-CA');
  for (const e of todayEvents) {
    if (dayKeyOfIso(e.occurred_at) === todayKey) {
      counts[e.kind] = (counts[e.kind] ?? 0) + 1;
    }
  }
  const items = Object.entries(CHECKLIST_TARGETS).map(([kind, target]) => ({
    kind,
    target,
    done: Math.min(counts[kind] ?? 0, target),
  }));
  const done = items.reduce((sum, i) => sum + i.done, 0);
  const total = items.reduce((sum, i) => sum + i.target, 0);
  return { items, done, total };
}

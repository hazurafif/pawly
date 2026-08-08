import { describe, expect, it } from 'vitest';
import type { Event } from '../../db/types';
import { CHECKLIST_TARGETS, checklistProgress } from '../checklist';

function ev(kind: string, occurredAt: string): Event {
  return {
    id: `${kind}-${occurredAt}`,
    pet_id: 'p-1',
    kind,
    title: null,
    text: null,
    occurred_at: occurredAt,
    next_due_at: null,
    data: null,
    favorite: 0,
    created_at: occurredAt,
    updated_at: occurredAt,
    deleted_at: null,
  };
}

describe('checklistProgress', () => {
  const total = Object.values(CHECKLIST_TARGETS).reduce((a, b) => a + b, 0);

  it('counts today events against the soft targets', () => {
    const today = new Date().toISOString();
    const progress = checklistProgress([ev('feed', today), ev('water', today), ev('water', today)]);
    expect(progress.total).toBe(total);
    expect(progress.done).toBe(3);
    expect(progress.items.find((i) => i.kind === 'feed')).toEqual({ kind: 'feed', target: 2, done: 1 });
    expect(progress.items.find((i) => i.kind === 'water')).toEqual({ kind: 'water', target: 3, done: 2 });
    expect(progress.items.find((i) => i.kind === 'potty')).toEqual({ kind: 'potty', target: 2, done: 0 });
  });

  it('caps done at the target and ignores other kinds', () => {
    const today = new Date().toISOString();
    const progress = checklistProgress([
      ev('feed', today),
      ev('feed', today),
      ev('feed', today),
      ev('feed', today),
      ev('feed', today),
      ev('weight', today),
    ]);
    expect(progress.done).toBe(2);
    expect(progress.items.find((i) => i.kind === 'feed')?.done).toBe(2);
  });

  it('ignores events from earlier days', () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const progress = checklistProgress([ev('feed', today), ev('feed', yesterday)]);
    expect(progress.done).toBe(1);
  });

  it('returns zeroed items for an empty day', () => {
    const progress = checklistProgress([]);
    expect(progress.done).toBe(0);
    expect(progress.total).toBe(total);
    expect(progress.items.every((i) => i.done === 0)).toBe(true);
  });
});

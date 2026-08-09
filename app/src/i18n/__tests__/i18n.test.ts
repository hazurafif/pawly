import { describe, expect, it } from 'vitest';
import id from '../id.json';
import en from '../en.json';
import {
  APPETITE_VALUES,
  EVENT_KIND_META,
  MOOD_VALUES,
  RULE_KINDS,
  SEVERITY_VALUES,
} from '../../lib/catalog';

const cap = (v: string) => `${v.charAt(0).toUpperCase()}${v.slice(1)}`;

function has(res: Record<string, unknown>, path: string): boolean {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (typeof acc === 'object' && acc !== null) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, res) !== undefined;
}

describe('i18n resources', () => {
  it('id and en have identical key trees', () => {
    const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(obj).flatMap(([k, v]) =>
        typeof v === 'object' && v !== null
          ? flat(v as Record<string, unknown>, `${prefix}${k}.`)
          : [`${prefix}${k}`]
      );
    expect(flat(en as Record<string, unknown>).sort()).toEqual(
      flat(id as Record<string, unknown>).sort()
    );
  });

  it('mood keys are lowercase (code calls t(`mood.${value}`) with lowercase values)', () => {
    for (const res of [en, id]) {
      for (const key of Object.keys(res.mood)) {
        expect(key, `${key} should be lowercase`).toBe(key.toLowerCase());
      }
    }
  });

  it('every canonical mood/appetite/severity value has a label in both locales', () => {
    for (const value of MOOD_VALUES) {
      expect(has(en, `mood.${value}`), `en mood.${value}`).toBe(true);
      expect(has(id, `mood.${value}`), `id mood.${value}`).toBe(true);
    }
    for (const value of APPETITE_VALUES) {
      expect(has(en, `entry.appetite${cap(value)}`), `en entry.appetite${cap(value)}`).toBe(true);
      expect(has(id, `entry.appetite${cap(value)}`), `id entry.appetite${cap(value)}`).toBe(true);
    }
    for (const value of SEVERITY_VALUES) {
      expect(has(en, `entry.severity${cap(value)}`), `en entry.severity${cap(value)}`).toBe(true);
      expect(has(id, `entry.severity${cap(value)}`), `id entry.severity${cap(value)}`).toBe(true);
    }
  });

  it('every reminder rule kind and event kind has a label in both locales', () => {
    for (const kind of RULE_KINDS) {
      expect(has(en, `ruleKind.${kind}`), `en ruleKind.${kind}`).toBe(true);
      expect(has(id, `ruleKind.${kind}`), `id ruleKind.${kind}`).toBe(true);
    }
    for (const kind of Object.keys(EVENT_KIND_META)) {
      expect(has(en, `event.kinds.${kind}`), `en event.kinds.${kind}`).toBe(true);
      expect(has(id, `event.kinds.${kind}`), `id event.kinds.${kind}`).toBe(true);
    }
  });

  it('reminder forms have dedicated validation copy', () => {
    for (const res of [en, id]) {
      expect(res.reminder.titleRequired.length).toBeGreaterThan(0);
      expect(res.reminder.dueInvalid.length).toBeGreaterThan(0);
    }
  });

  it('every event kind has a specialized form hero subtitle in both locales', () => {
    for (const kind of Object.keys(EVENT_KIND_META)) {
      expect(has(en, `entry.hero.${kind}`), `en entry.hero.${kind}`).toBe(true);
      expect(has(id, `entry.hero.${kind}`), `id entry.hero.${kind}`).toBe(true);
    }
  });

  it('quick-note presets and weight context copy exist in both locales', () => {
    for (const key of ['presetBreakfast', 'presetLunch', 'presetDinner', 'presetSnack', 'presetMorningWalk', 'presetEveningWalk', 'presetsHint', 'lastWeight', 'details', 'pickHint']) {
      expect(has(en, `entry.${key}`), `en entry.${key}`).toBe(true);
      expect(has(id, `entry.${key}`), `id entry.${key}`).toBe(true);
    }
  });

  it('mood emoji picker values map to mood labels (lowercase keys)', () => {
    for (const value of MOOD_VALUES) {
      expect(has(en, `mood.${value}`)).toBe(true);
    }
  });
});

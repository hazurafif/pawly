import { describe, expect, it } from 'vitest';
import {
  EVENT_KIND_META,
  isEventKind,
  JOURNAL_KINDS,
  kindMeta,
  LOGGABLE_KINDS,
  QUICK_KINDS,
  ruleKindMeta,
  RULE_KIND_META,
  RULE_KINDS,
} from '../catalog';

describe('isEventKind', () => {
  it('recognizes known kinds and rejects unknown strings', () => {
    expect(isEventKind('feed')).toBe(true);
    expect(isEventKind('weight')).toBe(true);
    expect(isEventKind('bogus')).toBe(false);
    expect(isEventKind('')).toBe(false);
  });
});

describe('kindMeta', () => {
  it('returns the metadata for known kinds', () => {
    expect(kindMeta('feed')).toBe(EVENT_KIND_META.feed);
  });

  it('falls back for unknown kinds', () => {
    expect(kindMeta('bogus')).toEqual({ icon: 'ellipse-outline', color: '#7E7E84', chip: 'care' });
  });
});

describe('catalog integrity', () => {
  it('every loggable and quick kind has metadata', () => {
    for (const kind of [...LOGGABLE_KINDS, ...QUICK_KINDS]) {
      expect(EVENT_KIND_META[kind], `missing meta for ${kind}`).toBeDefined();
    }
  });

  it('journal kinds are a care-only subset of the loggable kinds', () => {
    // Milestone moved to the Memories tab; health kinds live on Health.
    expect(JOURNAL_KINDS).toEqual(['feed', 'water', 'walk', 'potty', 'mood', 'photo', 'grooming', 'dental']);
    expect(JOURNAL_KINDS).not.toContain('milestone');
    for (const kind of JOURNAL_KINDS) {
      expect(LOGGABLE_KINDS).toContain(kind);
      expect(EVENT_KIND_META[kind]?.chip).toBe('care');
    }
  });

  it('every event meta has an icon, a hex color, and a chip', () => {
    for (const meta of Object.values(EVENT_KIND_META)) {
      expect(meta.icon.length).toBeGreaterThan(0);
      expect(meta.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(['care', 'health']).toContain(meta.chip);
    }
  });
});

describe('ruleKindMeta', () => {
  it('covers every rule kind', () => {
    for (const kind of RULE_KINDS) {
      expect(RULE_KIND_META[kind], `missing meta for ${kind}`).toBeDefined();
    }
  });

  it('returns the specific or fallback meta', () => {
    expect(ruleKindMeta('vaccine')).toBe(RULE_KIND_META.vaccine);
    expect(ruleKindMeta('bogus')).toBe(RULE_KIND_META.other);
  });
});

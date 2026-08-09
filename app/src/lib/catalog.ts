import type { EventKind, Species } from '../db/types';

// Event kinds and their catalog metadata. Icons are Ionicons names.
// Labels live in i18n under event.kinds.<kind>.
export const EVENT_KIND_META: Record<
  EventKind,
  { icon: string; color: string; chip: 'care' | 'health' }
> = {
  feed: { icon: 'restaurant-outline', color: '#B08446', chip: 'care' },
  water: { icon: 'water-outline', color: '#5F8FA8', chip: 'care' },
  walk: { icon: 'walk-outline', color: '#6F9966', chip: 'care' },
  potty: { icon: 'brush-outline', color: '#8F7B5C', chip: 'care' },
  mood: { icon: 'happy-outline', color: '#B57A93', chip: 'care' },
  checkin: { icon: 'clipboard-outline', color: '#7A7FAE', chip: 'health' },
  symptom: { icon: 'medkit-outline', color: '#B85A54', chip: 'health' },
  med_given: { icon: 'bandage-outline', color: '#5F7FB0', chip: 'health' },
  vaccine: { icon: 'shield-checkmark-outline', color: '#4E8F6A', chip: 'health' },
  visit: { icon: 'medkit-outline', color: '#4C8A84', chip: 'health' },
  weight: { icon: 'scale-outline', color: '#837FAF', chip: 'health' },
  photo: { icon: 'camera-outline', color: '#A482A8', chip: 'care' },
  milestone: { icon: 'star-outline', color: '#B08446', chip: 'care' },
  task: { icon: 'checkmark-circle-outline', color: '#4F8F7D', chip: 'care' },
  vet_bill: { icon: 'receipt-outline', color: '#7E7E84', chip: 'health' },
};

// Journal (care) kinds offered by the "add entry" flow on the Journal tab.
// Health kinds (weight, vaccine, med, visit, symptom) are added from the
// Health tab; milestones are added from the Memories tab.
export const JOURNAL_KINDS: EventKind[] = [
  'feed', 'water', 'walk', 'potty', 'mood', 'photo',
];

// Every kind offered by the type-driven "add entry" flow, in display order.
export const LOGGABLE_KINDS: EventKind[] = [
  ...JOURNAL_KINDS, 'weight', 'med_given', 'vaccine', 'visit', 'symptom',
];

// Quick-log actions on Home.
export const QUICK_KINDS: EventKind[] = ['feed', 'water', 'walk', 'potty'];

// Fallback used for unknown kinds.
const OTHER_KIND_META = { icon: 'ellipse-outline', color: '#7E7E84', chip: 'care' as const };

export const SPECIES_META: Record<Species, { icon: string }> = {
  cat: { icon: 'paw' },
  dog: { icon: 'paw' },
  other: { icon: 'paw' },
};

export function isEventKind(value: string): value is EventKind {
  return value in EVENT_KIND_META;
}

export function kindMeta(kind: string) {
  return isEventKind(kind) ? EVENT_KIND_META[kind] : OTHER_KIND_META;
}

export const RULE_KINDS = ['vaccine', 'med', 'groom', 'flea', 'other'] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export const RULE_KIND_META: Record<RuleKind, { icon: string }> = {
  vaccine: { icon: 'shield-checkmark-outline' },
  med: { icon: 'bandage-outline' },
  groom: { icon: 'cut-outline' },
  flea: { icon: 'bug-outline' },
  other: { icon: 'alarm-outline' },
};

export function ruleKindMeta(kind: string) {
  return (kind in RULE_KIND_META ? RULE_KIND_META[kind as RuleKind] : RULE_KIND_META.other) as {
    icon: string;
  };
}

// Canonical option values for the typed entry/check-in flows. The values are
// the i18n key suffixes (lowercase); labels live under `mood.*`,
// `entry.appetite*`, and `entry.severity*` in en.json/id.json.
export const MOOD_VALUES = ['great', 'good', 'ok', 'low', 'bad'] as const;
export type MoodValue = (typeof MOOD_VALUES)[number];

export const APPETITE_VALUES = ['normal', 'low', 'high'] as const;
export type AppetiteValue = (typeof APPETITE_VALUES)[number];

export const SEVERITY_VALUES = ['mild', 'moderate', 'severe'] as const;
export type SeverityValue = (typeof SEVERITY_VALUES)[number];

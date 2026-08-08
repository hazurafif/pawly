import type { EventKind, Species } from '../db/types';

// Event kinds and their catalog metadata. Icons are Ionicons names.
// Labels live in i18n under event.kinds.<kind>.
export const EVENT_KIND_META: Record<
  EventKind,
  { icon: string; color: string; chip: 'care' | 'health' }
> = {
  feed: { icon: 'restaurant-outline', color: '#E0A04E', chip: 'care' },
  water: { icon: 'water-outline', color: '#6FAED6', chip: 'care' },
  walk: { icon: 'walk-outline', color: '#86B56F', chip: 'care' },
  potty: { icon: 'brush-outline', color: '#B08D57', chip: 'care' },
  mood: { icon: 'happy-outline', color: '#DA7FA2', chip: 'care' },
  checkin: { icon: 'clipboard-outline', color: '#9B8AC9', chip: 'health' },
  symptom: { icon: 'medkit-outline', color: '#D96B63', chip: 'health' },
  med_given: { icon: 'bandage-outline', color: '#7C9EE0', chip: 'health' },
  vaccine: { icon: 'shield-checkmark-outline', color: '#5CB98A', chip: 'health' },
  visit: { icon: 'medkit-outline', color: '#5CA79B', chip: 'health' },
  weight: { icon: 'scale-outline', color: '#9B8AC9', chip: 'health' },
  photo: { icon: 'camera-outline', color: '#DA7FA2', chip: 'care' },
  milestone: { icon: 'star-outline', color: '#E0A04E', chip: 'care' },
  task: { icon: 'checkmark-circle-outline', color: '#86B56F', chip: 'care' },
  vet_bill: { icon: 'receipt-outline', color: '#8A857D', chip: 'health' },
};

// Kinds offered by the type-driven "add entry" flow, in display order.
export const LOGGABLE_KINDS: EventKind[] = [
  'feed', 'water', 'walk', 'potty', 'mood', 'photo', 'weight', 'med_given',
  'vaccine', 'visit', 'symptom', 'milestone',
];

// Quick-log actions on Home.
export const QUICK_KINDS: EventKind[] = ['feed', 'water', 'walk', 'potty'];

// Fallback used for unknown kinds.
const OTHER_KIND_META = { icon: 'ellipse-outline', color: '#8A857D', chip: 'care' as const };

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
  return (kind in RULE_KIND_META ? RULE_KIND_META : RULE_KIND_META.other) as {
    icon: string;
  };
}

export const TABLES = ['pets', 'events', 'photos', 'reminder_rules'] as const;

export type TableName = (typeof TABLES)[number];

export type Row = Record<string, unknown>;
export type Changes = Record<TableName, Row[]>;

// Every synced table shares these columns.
export const SYNC_COLUMNS = ['id', 'created_at', 'updated_at', 'deleted_at'] as const;

// Column allow-lists per table — mirrors the Go server's columnsByTable.
export const COLUMNS: Record<TableName, readonly string[]> = {
  pets: [
    'id', 'name', 'species', 'sex', 'birth_date', 'birth_date_is_estimated',
    'rescue_date', 'rescue_date_is_estimated', 'is_neutered', 'story', 'status',
    'passed_away_date', 'vet_clinic', 'breed', 'microchip', 'allergies',
    'created_at', 'updated_at', 'deleted_at',
  ],
  events: [
    'id', 'pet_id', 'kind', 'title', 'text', 'occurred_at', 'next_due_at',
    'data', 'favorite', 'created_at', 'updated_at', 'deleted_at',
  ],
  photos: ['id', 'event_id', 'taken_at', 'content_type', 'created_at', 'updated_at', 'deleted_at'],
  reminder_rules: [
    'id', 'pet_id', 'title', 'kind', 'due', 'repeat', 'dose', 'note',
    'created_at', 'updated_at', 'deleted_at',
  ],
};

// Minimal DB facade. Implemented by expoAdapter (app) and the sql.js
// adapter in testDb.ts (tests).
export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  first<T = Row>(sql: string, params?: unknown[]): Promise<T | null>;
}

// --- typed row shapes (mirror the schema; INTEGER columns are numbers) ---

export const SPECIES = ['cat', 'dog', 'other'] as const;
export type Species = (typeof SPECIES)[number];

export const EVENT_KINDS = [
  'feed', 'water', 'walk', 'potty', 'mood', 'checkin', 'symptom', 'med_given',
  'vaccine', 'visit', 'weight', 'photo', 'milestone', 'task', 'vet_bill',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const REPEAT_VALUES = ['once', 'daily', 'weekly', 'monthly'] as const;
export type Repeat = (typeof REPEAT_VALUES)[number];

export interface Pet {
  id: string;
  name: string;
  species: string;
  sex: string;
  birth_date: string | null;
  birth_date_is_estimated: number;
  rescue_date: string | null;
  rescue_date_is_estimated: number;
  is_neutered: string;
  story: string | null;
  status: string;
  passed_away_date: string | null;
  vet_clinic: string | null;
  breed: string | null;
  microchip: string | null;
  allergies: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Event {
  id: string;
  pet_id: string | null;
  kind: string;
  title: string | null;
  text: string | null;
  occurred_at: string;
  next_due_at: string | null;
  data: string | null;
  favorite: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Photo {
  id: string;
  event_id: string | null;
  taken_at: string | null;
  content_type: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ReminderRule {
  id: string;
  pet_id: string | null;
  title: string;
  kind: string;
  due: string;
  repeat: string;
  dose: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// Rows joined with the owning pet's name (null when the pet is gone/deleted).
export interface EventWithPet extends Event {
  pet_name: string | null;
}
export interface RuleWithPet extends ReminderRule {
  pet_name: string | null;
}
export interface PhotoWithUri extends Photo {
  local_uri: string | null;
}

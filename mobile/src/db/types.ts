export const TABLES = [
  'cats',
  'moments',
  'purchases',
  'reminders',
  'reminder_completions',
  'photos',
] as const;

export type TableName = (typeof TABLES)[number];

export type Row = Record<string, unknown>;
export type Changes = Record<TableName, Row[]>;

// Every synced table shares these columns.
export const SYNC_COLUMNS = ['id', 'created_at', 'updated_at', 'deleted_at'] as const;

// Column allow-lists per table — mirrors the Go server's columnsByTable.
export const COLUMNS: Record<TableName, readonly string[]> = {
  cats: [
    'id', 'name', 'sex', 'birth_date', 'birth_date_is_estimated', 'rescue_date',
    'rescue_date_is_estimated', 'is_neutered', 'story', 'status',
    'passed_away_date', 'mother_id', 'father_id', 'created_at', 'updated_at', 'deleted_at',
  ],
  moments: ['id', 'cat_id', 'kind', 'title', 'text', 'occurred_at', 'next_due_at', 'created_at', 'updated_at', 'deleted_at'],
  photos: ['id', 'moment_id', 'purchase_id', 'taken_at', 'content_type', 'created_at', 'updated_at', 'deleted_at'],
  reminders: ['id', 'title', 'scope', 'cat_id', 'time', 'days_of_week', 'created_at', 'updated_at', 'deleted_at'],
  reminder_completions: ['id', 'reminder_id', 'completed_at', 'note', 'created_at', 'updated_at', 'deleted_at'],
  purchases: ['id', 'item', 'price', 'category', 'date', 'note', 'cat_id', 'created_at', 'updated_at', 'deleted_at'],
};

// Minimal DB facade. Implemented by expoAdapter (app) and the sql.js
// adapter in schema.ts (tests).
export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  first<T = Row>(sql: string, params?: unknown[]): Promise<T | null>;
}

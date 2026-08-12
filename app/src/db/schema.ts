import { COLUMNS, type Db, type TableName } from './types';

const MIGRATION_1 = `
CREATE TABLE pets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT 'cat',
  sex TEXT NOT NULL DEFAULT 'unknown',
  birth_date TEXT,
  birth_date_is_estimated INTEGER NOT NULL DEFAULT 0,
  rescue_date TEXT,
  rescue_date_is_estimated INTEGER NOT NULL DEFAULT 0,
  is_neutered TEXT NOT NULL DEFAULT 'unknown',
  story TEXT,
  status TEXT NOT NULL DEFAULT 'alive',
  passed_away_date TEXT,
  vet_clinic TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z')
);
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  pet_id TEXT REFERENCES pets(id),
  kind TEXT NOT NULL,
  title TEXT,
  text TEXT,
  occurred_at TEXT NOT NULL,
  next_due_at TEXT,
  data TEXT,
  favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z')
);
CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id),
  taken_at TEXT,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z')
);
CREATE TABLE reminder_rules (
  id TEXT PRIMARY KEY,
  pet_id TEXT REFERENCES pets(id),
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other',
  due TEXT NOT NULL,
  repeat TEXT NOT NULL DEFAULT 'once',
  dose TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z')
);
CREATE INDEX idx_pets_updated ON pets(updated_at);
CREATE INDEX idx_events_updated ON events(updated_at);
CREATE INDEX idx_events_pet_occurred ON events(pet_id, occurred_at);
CREATE INDEX idx_photos_updated ON photos(updated_at);
CREATE INDEX idx_rules_updated ON reminder_rules(updated_at);
CREATE TABLE dirty (
  table_name TEXT NOT NULL,
  id TEXT NOT NULL,
  PRIMARY KEY (table_name, id)
);
CREATE TABLE photo_cache (
  photo_id TEXT PRIMARY KEY REFERENCES photos(id),
  local_uri TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'cached'))
);
CREATE TABLE sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cursor TEXT NOT NULL
);
`;

const MIGRATION_2 = `
ALTER TABLE pets ADD COLUMN breed TEXT;
ALTER TABLE pets ADD COLUMN microchip TEXT;
ALTER TABLE pets ADD COLUMN allergies TEXT;
`;

const MIGRATIONS = [MIGRATION_1, MIGRATION_2];

export async function migrate(db: Db): Promise<void> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version > MIGRATIONS.length) {
    throw new Error(
      `database schema version ${version} is newer than this app supports (${MIGRATIONS.length})`
    );
  }
  for (let i = version; i < MIGRATIONS.length; i++) {
    await db.exec('BEGIN');
    try {
      await db.exec(MIGRATIONS[i]);
      version = i + 1;
      await db.exec(`PRAGMA user_version = ${version}`);
      await db.exec('COMMIT');
    } catch (e) {
      await db.exec('ROLLBACK');
      throw e;
    }
  }
}

export function upsertSql(table: TableName): string {
  const cols = COLUMNS[table];
  const set = cols
    .filter((c) => c !== 'id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  return `INSERT INTO ${table} (${cols.join(', ')})
    VALUES (${cols.map(() => '?').join(', ')})
    ON CONFLICT(id) DO UPDATE SET ${set}
    WHERE ${table}.updated_at < excluded.updated_at`;
}

// Upsert without the last-write-wins guard. Used for local tombstones only:
// deletes are final, so a stale pulled row whose updated_at was clamped to
// server time must never block the tombstone from applying.
export function forceUpsertSql(table: TableName): string {
  const cols = COLUMNS[table];
  const set = cols
    .filter((c) => c !== 'id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  return `INSERT INTO ${table} (${cols.join(', ')})
    VALUES (${cols.map(() => '?').join(', ')})
    ON CONFLICT(id) DO UPDATE SET ${set}`;
}

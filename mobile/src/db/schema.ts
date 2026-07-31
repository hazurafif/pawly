import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { COLUMNS, type Db, type Row, type TableName } from './types';

const MIGRATION_1 = `
CREATE TABLE cats (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sex TEXT NOT NULL DEFAULT 'unknown',
  birth_date TEXT,
  birth_date_is_estimated INTEGER NOT NULL DEFAULT 0,
  rescue_date TEXT,
  rescue_date_is_estimated INTEGER NOT NULL DEFAULT 0,
  is_neutered TEXT NOT NULL DEFAULT 'unknown',
  story TEXT,
  status TEXT NOT NULL DEFAULT 'alive',
  passed_away_date TEXT,
  mother_id TEXT REFERENCES cats(id),
  father_id TEXT REFERENCES cats(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z')
);
CREATE TABLE moments (
  id TEXT PRIMARY KEY,
  cat_id TEXT REFERENCES cats(id),
  kind TEXT NOT NULL,
  title TEXT,
  text TEXT,
  occurred_at TEXT NOT NULL,
  next_due_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z')
);
CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  moment_id TEXT REFERENCES moments(id),
  purchase_id TEXT REFERENCES purchases(id),
  taken_at TEXT,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z')
);
CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'household',
  cat_id TEXT REFERENCES cats(id),
  time TEXT NOT NULL,
  days_of_week TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z')
);
CREATE TABLE reminder_completions (
  id TEXT PRIMARY KEY,
  reminder_id TEXT REFERENCES reminders(id),
  completed_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z')
);
CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  item TEXT NOT NULL,
  price INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  date TEXT NOT NULL,
  note TEXT,
  cat_id TEXT REFERENCES cats(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z')
);
CREATE INDEX idx_cats_updated ON cats(updated_at);
CREATE INDEX idx_moments_updated ON moments(updated_at);
CREATE INDEX idx_photos_updated ON photos(updated_at);
CREATE INDEX idx_reminders_updated ON reminders(updated_at);
CREATE INDEX idx_completions_updated ON reminder_completions(updated_at);
CREATE INDEX idx_purchases_updated ON purchases(updated_at);
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

const MIGRATIONS = [MIGRATION_1];

export async function migrate(db: Db): Promise<void> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  for (let i = version; i < MIGRATIONS.length; i++) {
    await db.exec(MIGRATIONS[i]);
    version = i + 1;
    await db.exec(`PRAGMA user_version = ${version}`);
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

// --- test-only helpers (sql.js) ---

let sqlJsPromise: Promise<SqlJsDatabase> | null = null;

async function sqlJsDb(): Promise<SqlJsDatabase> {
  if (!sqlJsPromise) {
    const SQL = await initSqlJs();
    sqlJsPromise = Promise.resolve(new SQL.Database());
  }
  return sqlJsPromise;
}

export async function openTestDb(): Promise<Db> {
  const raw = await sqlJsDb();
  const all = <T = Row>(sql: string, params: unknown[] = []) => {
    const stmt = raw.prepare(sql);
    stmt.bind(params as never[]);
    const out: T[] = [];
    while (stmt.step()) {
      out.push(stmt.getAsObject() as unknown as T);
    }
    stmt.free();
    return Promise.resolve(out);
  };
  const run = (sql: string, params: unknown[] = []) => {
    if (params.length === 0) {
      const res = raw.exec(sql);
      return Promise.resolve({ changes: res.reduce((n, r) => n + r.values.length, 0) });
    }
    const stmt = raw.prepare(sql);
    stmt.bind(params as never[]);
    stmt.step();
    stmt.free();
    return Promise.resolve({ changes: 1 });
  };
  return {
    exec: (sql) => {
      raw.exec(sql);
      return Promise.resolve();
    },
    run,
    all,
    first: async <T = Row>(sql: string, params: unknown[] = []) => {
      const rows = await all<T>(sql, params);
      return rows[0] ?? null;
    },
  };
}

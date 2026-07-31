# Pawly Mobile App (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation of the Pawly Android app — Expo/React Native project with local SQLite, the offline-first sync client that talks to the Go server, settings, and i18n — so Plan 3 (feature screens) can be built on top.

**Architecture:** Expo (SDK 57, TypeScript, expo-router). The phone's local SQLite DB (expo-sqlite) is the working copy. A pure-TS `SyncClient` orchestrates: push dirty rows → upload pending photo binaries → pull changes since cursor → download missing photos. All DB access goes through a small `Db` interface so tests run against sql.js (WASM SQLite in vitest) while the app uses expo-sqlite. Server URL + language live in AsyncStorage.

**Tech Stack:** Expo SDK 57 (expo-router, expo-sqlite, expo-file-system, expo-crypto, expo-network, expo-localization), `@react-native-async-storage/async-storage`, i18next + react-i18next, vitest + sql.js (dev).

**Spec:** `docs/superpowers/specs/2026-08-01-pawly-design.md`
**Backend contract:** `server/README.md` "Sync contract for client developers" — timestamps are `2006-01-02T15:04:05.000Z` (exactly what JS `Date.toISOString()` emits), pull `since` is exclusive, any push error means keep-and-retry, server clamps stale `updated_at` to its own clock.

**Repo layout (new `mobile/` directory):**
```
mobile/
  app/                       # expo-router routes
    _layout.tsx
    (tabs)/
      _layout.tsx
      index.tsx              # Beranda placeholder (Plan 3 builds real screen)
    settings.tsx             # Pengaturan: server URL, language, sync status
  src/
    lib/
      format.ts              # formatIDR, formatDate, toIsoMs, parseIsoMs (pure)
    db/
      types.ts               # Db interface, TableName, Row, Changes
      schema.ts              # migrations (PRAGMA user_version)
      repository.ts          # SyncStore impl + local upserts (takes Db)
      expoAdapter.ts         # expo-sqlite → Db (app only, not vitest-tested)
      sqljsAdapter.ts        # sql.js → Db (test-only)
      __tests__/schema.test.ts, repository.test.ts
    sync/
      types.ts               # TableName, Row, Changes, PullResponse...
      client.ts              # SyncClient (pure, injected store+transport)
      transport.ts           # HttpTransport (injected fetch + file helpers)
      __tests__/client.test.ts, transport.test.ts
      __tests__/server-e2e.test.ts   # vs the real Go binary
    settings/
      settings.ts            # AsyncStorage-backed serverUrl/language
      __tests__/settings.test.ts
    i18n/
      index.ts, id.json, en.json
      __tests__/i18n.test.ts
    hooks/
      useSync.ts             # SyncProvider context + triggers
  test/
    setup.ts                 # vitest setup (mocks)
  vitest.config.ts
```

---

### Task 1: Scaffold the Expo app

**Files:**
- Create: `mobile/` (via create-expo-app)
- Create: `.gitignore` addition

- [ ] **Step 1: Scaffold**

```bash
cd /Users/rafif/Developer/personal/pawly
npx create-expo-app@latest mobile --template tabs
cd mobile
npx expo install expo-sqlite expo-file-system expo-crypto expo-network expo-localization
npx expo install @react-native-async-storage/async-storage
```

Expected: `mobile/` with the tabs template (expo-router, TypeScript), all packages installed at SDK-57-compatible versions.

- [ ] **Step 2: Strip template boilerplate**

Delete or empty the template's demo content so we start clean:

```bash
cd /Users/rafif/Developer/personal/pawly/mobile
rm -rf app/(tabs)/two.tsx app/modal.tsx components/StyledText.tsx components/EditScreenInfo.tsx components/ExternalLink.tsx components/Themed.tsx components/useClientOnlyValue.ts components/useClientOnlyValue.web.ts components/useColorScheme.ts components/useColorScheme.web.ts
mkdir -p src/lib src/db src/sync src/settings src/i18n src/hooks test
```

(Keep `components/__tests__/` only if it exists — delete it too: `rm -rf components/__tests__`.)

- [ ] **Step 3: Make the home screen minimal**

Replace `mobile/app/(tabs)/index.tsx` with:

```tsx
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pawly</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700' },
});
```

Also replace `mobile/app/(tabs)/_layout.tsx` with a single tab:

```tsx
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
    </Tabs>
  );
}
```

Replace `mobile/app/_layout.tsx` with:

```tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: 'Pengaturan' }} />
    </Stack>
  );
}
```

- [ ] **Step 4: Set app metadata**

In `mobile/app.json`, set `"name": "Pawly"`, `"slug": "pawly"`, and remove template-specific plugins if any reference removed packages (e.g. `expo-symbols`).

- [ ] **Step 5: Verify it boots**

```bash
cd /Users/rafif/Developer/personal/pawly/mobile
npx tsc --noEmit
npx expo start --port 8082 &
# wait for the bundler banner, then:
curl -s http://localhost:8082/status | grep -q "packager-status:running" && echo "bundler OK"
kill %1
```

Expected: `tsc` clean, bundler reports running. (Full visual verification happens on a device in a later task; the bundler starting + typecheck passing is sufficient here.)

- [ ] **Step 6: Update root `.gitignore`**

Append to `/Users/rafif/Developer/personal/pawly/.gitignore`:

```gitignore
mobile/.expo/
mobile/dist/
```

(The Expo template ships its own `mobile/.gitignore` covering `node_modules`, `.expo`, etc.)

- [ ] **Step 7: Commit**

```bash
cd /Users/rafif/Developer/personal/pawly
git add .gitignore mobile/
git commit -m "feat(mobile): scaffold Expo app with expo-router and core dependencies"
```

---

### Task 2: Test infrastructure + pure formatting helpers

**Files:**
- Create: `mobile/vitest.config.ts`, `mobile/test/setup.ts`
- Create: `mobile/src/lib/format.ts`
- Test: `mobile/src/lib/__tests__/format.test.ts`

- [ ] **Step 1: Install dev dependencies**

```bash
cd /Users/rafif/Developer/personal/pawly/mobile
npm i -D vitest sql.js @types/sql.js
```

- [ ] **Step 2: Write vitest config**

Create `mobile/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
```

Create `mobile/test/setup.ts`:

```ts
// vitest setup — reserved for global mocks; none needed yet.
```

- [ ] **Step 3: Add the test script**

In `mobile/package.json` scripts, add:

```json
"test": "vitest run"
```

- [ ] **Step 4: Write the failing tests**

Create `mobile/src/lib/__tests__/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatDate, formatIDR, parseIsoMs, toIsoMs } from '../format';

describe('toIsoMs', () => {
  it('emits fixed-width millisecond RFC3339 UTC (server contract)', () => {
    expect(toIsoMs(new Date(Date.UTC(2026, 6, 1, 12, 0, 0, 500)))).toBe('2026-07-01T12:00:00.500Z');
    expect(toIsoMs(new Date(Date.UTC(2026, 6, 1, 12, 0, 0, 0)))).toBe('2026-07-01T12:00:00.000Z');
  });
});

describe('parseIsoMs', () => {
  it('parses the canonical format', () => {
    expect(parseIsoMs('2026-07-01T12:00:00.500Z')?.getUTCHours()).toBe(12);
  });
  it('rejects second-precision, offsets, and wrong fraction widths', () => {
    expect(parseIsoMs('2026-07-01T12:00:00Z')).toBeNull();
    expect(parseIsoMs('2026-07-01T12:00:00+07:00')).toBeNull();
    expect(parseIsoMs('2026-07-01T12:00:00.5Z')).toBeNull();
    expect(parseIsoMs('garbage')).toBeNull();
  });
});

describe('formatIDR', () => {
  it('formats integer rupiah with thousand separators', () => {
    expect(formatIDR(65000)).toBe('Rp65.000');
    expect(formatIDR(123456789)).toBe('Rp123.456.789');
    expect(formatIDR(0)).toBe('Rp0');
  });
});

describe('formatDate', () => {
  it('formats Indonesian date from ISO ms string', () => {
    expect(formatDate('2026-07-01T12:00:00.500Z', 'id')).toBe('1 Juli 2026');
  });
  it('formats English date', () => {
    expect(formatDate('2026-07-01T12:00:00.500Z', 'en')).toBe('1 July 2026');
  });
});
```

- [ ] **Step 5: Run to verify they fail**

Run: `cd /Users/rafif/Developer/personal/pawly/mobile && npx vitest run src/lib`
Expected: FAIL — module `../format` not found.

- [ ] **Step 6: Implement `format.ts`**

Create `mobile/src/lib/format.ts`:

```ts
// The server's canonical timestamp format: RFC3339 UTC, fixed-width
// millisecond precision. Date.toISOString() emits exactly this.
export const ISO_MS_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function toIsoMs(date: Date): string {
  return date.toISOString();
}

export function parseIsoMs(value: string): Date | null {
  if (!ISO_MS_REGEX.test(value)) {
    return null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatIDR(price: number): string {
  return 'Rp' + price.toLocaleString('id-ID').replace(/,/g, '.');
}

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatDate(isoMs: string, locale: 'id' | 'en'): string {
  const d = parseIsoMs(isoMs);
  if (!d) {
    return isoMs;
  }
  const months = locale === 'id' ? MONTHS_ID : MONTHS_EN;
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
```

- [ ] **Step 7: Run to verify they pass**

Run: `cd /Users/rafif/Developer/personal/pawly/mobile && npm test`
Expected: PASS (all format tests).

- [ ] **Step 8: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): vitest setup and timestamp/currency/date format helpers"
```

---

### Task 3: DB adapter + schema (phone local SQLite)

**Files:**
- Create: `mobile/src/db/types.ts`, `mobile/src/db/schema.ts`, `mobile/src/db/expoAdapter.ts`, `mobile/src/db/sqljsAdapter.ts`
- Test: `mobile/src/db/__tests__/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `mobile/src/db/__tests__/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb, migrate } from '../schema';
import { TABLES } from '../types';

describe('schema migrations', () => {
  it('creates all synced tables plus phone-only tables', async () => {
    const db = await openTestDb();
    await migrate(db);
    const rows = await db.all<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    );
    const names = rows.map((r) => r.name).sort();
    const expected = [...TABLES, 'dirty', 'photo_cache', 'sync_state'].sort();
    expect(names).toEqual(expected);
  });

  it('migrate is idempotent', async () => {
    const db = await openTestDb();
    await migrate(db);
    await migrate(db);
    const row = await db.first<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(1);
  });

  it('enforces the timestamp format check constraint via application schema', async () => {
    const db = await openTestDb();
    await migrate(db);
    await expect(
      db.run(`INSERT INTO cats (id, name, sex, status, created_at, updated_at) VALUES ('c1','M','male','alive','2026-07-01T00:00:00.000Z','2026-07-01T00:00:00Z')`)
    ).rejects.toThrow(/updated_at/);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /Users/rafif/Developer/personal/pawly/mobile && npx vitest run src/db`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement types**

Create `mobile/src/db/types.ts`:

```ts
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

// Minimal DB facade. Implemented by expoAdapter (app) and sqljsAdapter (tests).
export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  first<T = Row>(sql: string, params?: unknown[]): Promise<T | null>;
}
```

- [ ] **Step 4: Implement schema + test DB**

Create `mobile/src/db/schema.ts`:

```ts
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { COLUMNS, type Db, type TableName } from './types';

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
      return Promise.resolve({ changes: res.reduce((n, r) => n + (r.length ?? 0), 0) });
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
```

- [ ] **Step 5: Implement the expo adapter (app-only)**

Create `mobile/src/db/expoAdapter.ts`:

```ts
import * as SQLite from 'expo-sqlite';
import type { Db } from './types';

// Wraps the expo-sqlite database in the app's Db facade.
export function expoDb(database: SQLite.SQLiteDatabase): Db {
  return {
    exec: (sql) => database.execAsync(sql),
    run: async (sql, params = []) => {
      const result = await database.runAsync(sql, params);
      return { changes: result.changes };
    },
    all: (sql, params = []) => database.getAllAsync(sql, params),
    first: (sql, params = []) => database.getFirstAsync(sql, params),
  };
}
```

- [ ] **Step 6: Run to verify they pass**

Run: `cd /Users/rafif/Developer/personal/pawly/mobile && npx vitest run src/db`
Expected: PASS. If the CHECK-constraint test fails because sql.js raises a different error shape, adjust the assertion in the test to match what sql.js actually throws (`/updated_at/` should still appear in the message) — do not weaken the check itself.

- [ ] **Step 7: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): local SQLite schema, Db facade, expo and sql.js adapters"
```

---

### Task 4: Repository (sync store + local writes)

**Files:**
- Create: `mobile/src/db/repository.ts`
- Test: `mobile/src/db/__tests__/repository.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `mobile/src/db/__tests__/repository.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Repository } from '../repository';
import { migrate, openTestDb } from '../schema';
import type { Row } from '../types';

async function makeRepo() {
  const db = await openTestDb();
  await migrate(db);
  return new Repository(db);
}

const catRow = (id: string, updatedAt: string, overrides: Row = {}): Row => ({
  id,
  name: 'Miko',
  sex: 'male',
  status: 'alive',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: updatedAt,
  ...overrides,
});

describe('Repository', () => {
  it('upsertLocal inserts and marks dirty', async () => {
    const r = await makeRepo();
    await r.upsertLocal('cats', catRow('c1', '2026-07-01T00:00:00.000Z'));
    const dirty = await r.getDirtyRows();
    expect(dirty).toEqual([{ table: 'cats', row: expect.objectContaining({ id: 'c1' }) }]);
  });

  it('upsertLocal last-write-wins locally', async () => {
    const r = await makeRepo();
    await r.upsertLocal('cats', catRow('c1', '2026-07-01T00:00:00.000Z', { name: 'v1' }));
    await r.upsertLocal('cats', catRow('c1', '2026-06-30T00:00:00.000Z', { name: 'older' }));
    await r.upsertLocal('cats', catRow('c1', '2026-07-02T00:00:00.000Z', { name: 'newer' }));
    const cats = await r.allCats();
    expect(cats[0].name).toBe('newer');
    expect(cats).toHaveLength(1);
  });

  it('clearDirty removes pushed rows', async () => {
    const r = await makeRepo();
    await r.upsertLocal('cats', catRow('c1', '2026-07-01T00:00:00.000Z'));
    await r.clearDirty([{ table: 'cats', id: 'c1' }]);
    expect(await r.getDirtyRows()).toEqual([]);
  });

  it('applyChanges upserts pulled rows without dirtying them, LWW against local edits', async () => {
    const r = await makeRepo();
    // local newer edit stays
    await r.upsertLocal('cats', catRow('c1', '2026-07-10T00:00:00.000Z', { name: 'local' }));
    await r.applyChanges({
      cats: [catRow('c1', '2026-07-05T00:00:00.000Z', { name: 'server' })],
    });
    const cats = await r.allCats();
    expect(cats[0].name).toBe('local');
    expect(await r.getDirtyRows()).toHaveLength(1); // still dirty, not yet pushed
  });

  it('applyChanges returns the max updated_at seen', async () => {
    const r = await makeRepo();
    const res = await r.applyChanges({
      cats: [
        catRow('c1', '2026-07-01T00:00:00.000Z'),
        catRow('c2', '2026-07-03T00:00:00.000Z'),
      ],
      moments: [{ id: 'm1', kind: 'milestone', occurred_at: '2026-07-02T00:00:00.000Z', created_at: '2026-07-02T00:00:00.000Z', updated_at: '2026-07-02T00:00:00.000Z' }],
    });
    expect(res.maxUpdatedAt).toBe('2026-07-03T00:00:00.000Z');
  });

  it('photo flow: pending upload then cached', async () => {
    const r = await makeRepo();
    await r.upsertLocal('photos', {
      id: 'ph1', taken_at: '2026-07-01T00:00:00.000Z',
      created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z',
    });
    await r.addPendingPhoto('ph1', 'file:///tmp/photo.jpg');
    expect(await r.getPendingPhotos()).toEqual([{ id: 'ph1', localUri: 'file:///tmp/photo.jpg' }]);
    await r.markPhotoCached('ph1');
    expect(await r.getPendingPhotos()).toEqual([]);
  });

  it('getMissingPhotos returns synced photo rows without a local file', async () => {
    const r = await makeRepo();
    await r.applyChanges({
      photos: [
        { id: 'phA', taken_at: '2026-07-01T00:00:00.000Z', created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
        { id: 'phB', taken_at: '2026-07-01T00:00:00.000Z', created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
      ],
    });
    await r.addPendingPhoto('phB', 'file:///tmp/b.jpg');
    await r.markPhotoCached('phB');
    expect(await r.getMissingPhotos()).toEqual(['phA']);
  });

  it('cursor round-trips and defaults to null', async () => {
    const r = await makeRepo();
    expect(await r.getCursor()).toBeNull();
    await r.setCursor('2026-07-05T00:00:00.000Z');
    expect(await r.getCursor()).toBe('2026-07-05T00:00:00.000Z');
  });

  it('savePhotoFile records a downloaded file', async () => {
    const r = await makeRepo();
    await r.savePhotoFile('phX', 'file:///cache/phX.jpg');
    const missing = await r.getMissingPhotos();
    expect(missing).not.toContain('phX');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /Users/rafif/Developer/personal/pawly/mobile && npx vitest run src/db`
Expected: FAIL — `../repository` not found.

- [ ] **Step 3: Implement the repository**

Create `mobile/src/db/repository.ts`:

```ts
import { COLUMNS, type Db, type Row, type TableName } from './types';
import { upsertSql } from './schema';

export interface DirtyRow {
  table: TableName;
  row: Row;
}

export interface ApplyResult {
  maxUpdatedAt: string | null;
}

// All phone-side data access. Takes the Db facade so tests run on sql.js.
export class Repository {
  constructor(private readonly db: Db) {}

  // --- local writes (dirty tracking) ---

  async upsertLocal(table: TableName, row: Row): Promise<void> {
    const id = row.id as string;
    await this.db.exec('BEGIN');
    try {
      await this.db.run(upsertSql(table), this.valuesFor(table, row));
      await this.db.run(
        `INSERT INTO dirty (table_name, id) VALUES (?, ?)
         ON CONFLICT(table_name, id) DO NOTHING`,
        [table, id]
      );
      await this.db.exec('COMMIT');
    } catch (e) {
      await this.db.exec('ROLLBACK');
      throw e;
    }
  }

  async getDirtyRows(): Promise<DirtyRow[]> {
    const rows = await this.db.all<{ table_name: TableName; id: string }>(
      'SELECT table_name, id FROM dirty'
    );
    const out: DirtyRow[] = [];
    for (const d of rows) {
      const row = await this.db.first<Row>(
        `SELECT ${COLUMNS[d.table_name].join(', ')} FROM ${d.table_name} WHERE id = ?`,
        [d.id]
      );
      if (row) {
        out.push({ table: d.table_name, row });
      }
    }
    return out;
  }

  async clearDirty(ids: { table: TableName; id: string }[]): Promise<void> {
    for (const d of ids) {
      await this.db.run('DELETE FROM dirty WHERE table_name = ? AND id = ?', [d.table, d.id]);
    }
  }

  // --- sync application (no dirty marking) ---

  async applyChanges(changes: Record<TableName, Row[]>): Promise<ApplyResult> {
    let maxUpdatedAt: string | null = null;
    await this.db.exec('BEGIN');
    try {
      for (const table of Object.keys(changes) as TableName[]) {
        for (const row of changes[table]) {
          const res = await this.db.run(upsertSql(table), this.valuesFor(table, row));
          if (res.changes > 0) {
            const up = row.updated_at as string;
            if (!maxUpdatedAt || up > maxUpdatedAt) {
              maxUpdatedAt = up;
            }
          }
        }
      }
      await this.db.exec('COMMIT');
    } catch (e) {
      await this.db.exec('ROLLBACK');
      throw e;
    }
    return { maxUpdatedAt };
  }

  // --- cursor ---

  async getCursor(): Promise<string | null> {
    const row = await this.db.first<{ cursor: string }>('SELECT cursor FROM sync_state WHERE id = 1');
    return row?.cursor ?? null;
  }

  async setCursor(cursor: string): Promise<void> {
    await this.db.run(
      `INSERT INTO sync_state (id, cursor) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET cursor = excluded.cursor`,
      [cursor]
    );
  }

  // --- photos ---

  async addPendingPhoto(id: string, localUri: string): Promise<void> {
    await this.db.run(
      `INSERT INTO photo_cache (photo_id, local_uri, status) VALUES (?, ?, 'pending')
       ON CONFLICT(photo_id) DO UPDATE SET local_uri = excluded.local_uri, status = 'pending'`,
      [id, localUri]
    );
  }

  async getPendingPhotos(): Promise<{ id: string; localUri: string }[]> {
    const rows = await this.db.all<{ photo_id: string; local_uri: string }>(
      `SELECT photo_id, local_uri FROM photo_cache WHERE status = 'pending'`
    );
    return rows.map((r) => ({ id: r.photo_id, localUri: r.local_uri }));
  }

  async markPhotoCached(id: string): Promise<void> {
    await this.db.run(`UPDATE photo_cache SET status = 'cached' WHERE photo_id = ?`, [id]);
  }

  async getMissingPhotos(): Promise<string[]> {
    const rows = await this.db.all<{ id: string }>(
      `SELECT p.id FROM photos p
       WHERE p.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM photo_cache c WHERE c.photo_id = p.id)`
    );
    return rows.map((r) => r.id);
  }

  async savePhotoFile(id: string, localUri: string): Promise<void> {
    await this.db.run(
      `INSERT INTO photo_cache (photo_id, local_uri, status) VALUES (?, ?, 'cached')
       ON CONFLICT(photo_id) DO UPDATE SET local_uri = excluded.local_uri, status = 'cached'`,
      [id, localUri]
    );
  }

  // --- app queries (Plan 3 builds screens on these) ---

  async allCats(): Promise<Row[]> {
    return this.db.all(
      `SELECT ${COLUMNS.cats.join(', ')} FROM cats WHERE deleted_at IS NULL ORDER BY name`
    );
  }

  private valuesFor(table: TableName, row: Row): unknown[] {
    return COLUMNS[table].map((c) => row[c] ?? null);
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd /Users/rafif/Developer/personal/pawly/mobile && npx vitest run src/db`
Expected: PASS (8 repository tests + 3 schema tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): repository with dirty tracking, LWW apply, cursor, photo cache"
```

---

### Task 5: Sync client (pure orchestration)

**Files:**
- Create: `mobile/src/sync/types.ts`, `mobile/src/sync/client.ts`
- Test: `mobile/src/sync/__tests__/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `mobile/src/sync/__tests__/client.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { SyncClient, type SyncStore, type SyncTransport } from '../client';
import type { Changes, Row, TableName } from '../../db/types';

function fakeStore(overrides: Partial<SyncStore> = {}): SyncStore {
  return {
    getCursor: vi.fn(async () => null),
    setCursor: vi.fn(async () => {}),
    getDirtyRows: vi.fn(async () => []),
    clearDirty: vi.fn(async () => {}),
    applyChanges: vi.fn(async () => ({ maxUpdatedAt: null })),
    getPendingPhotos: vi.fn(async () => []),
    markPhotoCached: vi.fn(async () => {}),
    getMissingPhotos: vi.fn(async () => []),
    savePhotoFile: vi.fn(async () => {}),
    ...overrides,
  };
}

function fakeTransport(overrides: Partial<SyncTransport> = {}): SyncTransport {
  return {
    pull: vi.fn(async () => ({ server_time: '2026-07-05T00:00:00.000Z', changes: {} as Changes })),
    push: vi.fn(async () => {}),
    putPhoto: vi.fn(async () => {}),
    getPhoto: vi.fn(async () => 'file:///cache/x.jpg'),
    ...overrides,
  };
}

const catRow = (id: string, updatedAt: string, overrides: Row = {}): Row => ({
  id, name: 'Miko', sex: 'male', status: 'alive',
  created_at: '2026-07-01T00:00:00.000Z', updated_at: updatedAt, ...overrides,
});

const emptyChanges: Changes = {
  cats: [], moments: [], purchases: [], reminders: [], reminder_completions: [], photos: [],
};

describe('SyncClient', () => {
  it('pushes dirty rows, clears them only on success, and pulls with the cursor', async () => {
    const store = fakeStore({
      getDirtyRows: vi.fn(async () => [{ table: 'cats' as TableName, row: catRow('c1', '2026-07-01T00:00:00.000Z') }]),
    });
    const transport = fakeTransport();
    const client = new SyncClient(store, transport);

    const result = await client.sync();

    expect(transport.push).toHaveBeenCalledWith(
      expect.objectContaining({ cats: [expect.objectContaining({ id: 'c1' })] })
    );
    expect(store.clearDirty).toHaveBeenCalledWith([{ table: 'cats', id: 'c1' }]);
    expect(transport.pull).toHaveBeenCalledWith(null);
    expect(result.pushed).toBe(1);
  });

  it('keeps dirty rows and does not pull when push fails (server down / 4xx)', async () => {
    const store = fakeStore({
      getDirtyRows: vi.fn(async () => [{ table: 'cats' as TableName, row: catRow('c1', '2026-07-01T00:00:00.000Z') }]),
    });
    const transport = fakeTransport({ push: vi.fn(async () => { throw new Error('server down'); }) });
    const client = new SyncClient(store, transport);

    await expect(client.sync()).rejects.toThrow('server down');
    expect(store.clearDirty).not.toHaveBeenCalled();
    expect(transport.pull).not.toHaveBeenCalled();
  });

  it('advances the cursor to max(server_time, max pulled updated_at)', async () => {
    const store = fakeStore({
      getCursor: vi.fn(async () => '2026-07-01T00:00:00.000Z'),
      applyChanges: vi.fn(async () => ({ maxUpdatedAt: '2026-07-09T00:00:00.000Z' })),
    });
    const transport = fakeTransport({
      pull: vi.fn(async () => ({
        server_time: '2026-07-05T00:00:00.000Z',
        changes: { cats: [catRow('c9', '2026-07-09T00:00:00.000Z')] } as Changes,
      })),
    });
    const client = new SyncClient(store, transport);

    await client.sync();

    expect(store.setCursor).toHaveBeenCalledWith('2026-07-09T00:00:00.000Z');
  });

  it('does not regress the cursor (never moves backwards)', async () => {
    const store = fakeStore({
      getCursor: vi.fn(async () => '2026-07-10T00:00:00.000Z'),
      applyChanges: vi.fn(async () => ({ maxUpdatedAt: null })),
    });
    const transport = fakeTransport({
      pull: vi.fn(async () => ({ server_time: '2026-07-05T00:00:00.000Z', changes: {} as Changes })),
    });
    const client = new SyncClient(store, transport);
    await client.sync();
    expect(store.setCursor).toHaveBeenCalledWith('2026-07-10T00:00:00.000Z');
  });

  it('uploads pending photos after pushing, tolerating per-photo failures', async () => {
    const store = fakeStore({
      getPendingPhotos: vi.fn(async () => [
        { id: 'ph1', localUri: 'file:///a.jpg' },
        { id: 'ph2', localUri: 'file:///b.jpg' },
      ]),
    });
    const transport = fakeTransport({
      putPhoto: vi.fn(async (id: string) => {
        if (id === 'ph2') throw new Error('boom');
      }),
    });
    const client = new SyncClient(store, transport);

    await client.sync();

    expect(transport.putPhoto).toHaveBeenCalledWith('ph1', 'file:///a.jpg');
    expect(store.markPhotoCached).toHaveBeenCalledWith('ph1');
    expect(store.markPhotoCached).not.toHaveBeenCalledWith('ph2');
  });

  it('downloads missing photos, tolerating per-photo failures', async () => {
    const store = fakeStore({
      getMissingPhotos: vi.fn(async () => ['phA', 'phB']),
    });
    const transport = fakeTransport({
      getPhoto: vi.fn(async (id: string) => {
        if (id === 'phB') throw new Error('nope');
        return 'file:///cache/phA.jpg';
      }),
    });
    const client = new SyncClient(store, transport);

    await client.sync();

    expect(store.savePhotoFile).toHaveBeenCalledWith('phA', 'file:///cache/phA.jpg');
    expect(store.savePhotoFile).not.toHaveBeenCalledWith('phB', expect.anything());
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /Users/rafif/Developer/personal/pawly/mobile && npx vitest run src/sync`
Expected: FAIL — `../client` not found.

- [ ] **Step 3: Implement types and the client**

Create `mobile/src/sync/types.ts`:

```ts
import type { Changes, Row, TableName } from '../db/types';

export type PullResponse = {
  server_time: string;
  changes: Changes;
};

export interface SyncStore {
  getCursor(): Promise<string | null>;
  setCursor(cursor: string): Promise<void>;
  getDirtyRows(): Promise<{ table: TableName; row: Row }[]>;
  clearDirty(ids: { table: TableName; id: string }[]): Promise<void>;
  applyChanges(changes: Changes): Promise<{ maxUpdatedAt: string | null }>;
  getPendingPhotos(): Promise<{ id: string; localUri: string }[]>;
  markPhotoCached(id: string): Promise<void>;
  getMissingPhotos(): Promise<string[]>;
  savePhotoFile(id: string, localUri: string): Promise<void>;
}

export interface SyncTransport {
  pull(since: string | null): Promise<PullResponse>;
  push(changes: Changes): Promise<void>;
  putPhoto(id: string, localUri: string): Promise<void>;
  getPhoto(id: string): Promise<string>;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
}
```

Create `mobile/src/sync/client.ts`:

```ts
import type { Changes, Row, TableName } from '../db/types';
import type { PullResponse, SyncResult, SyncStore, SyncTransport } from './types';

export type { PullResponse, SyncResult, SyncStore, SyncTransport };

// Orchestrates one sync pass: push dirty rows → upload pending photos →
// pull changes → download missing photos. Pure orchestration with no I/O
// of its own; all effects go through the injected store and transport.
export class SyncClient {
  constructor(
    private readonly store: SyncStore,
    private readonly transport: SyncTransport
  ) {}

  async sync(): Promise<SyncResult> {
    const pushed = await this.pushDirty();
    await this.uploadPhotos();
    const pulled = await this.pull();
    await this.downloadPhotos();
    return { pushed, pulled };
  }

  private async pushDirty(): Promise<number> {
    const dirty = await this.store.getDirtyRows();
    if (dirty.length === 0) {
      return 0;
    }
    const changes: Changes = {
      cats: [], moments: [], purchases: [], reminders: [], reminder_completions: [], photos: [],
    };
    for (const d of dirty) {
      changes[d.table].push(d.row);
    }
    await this.transport.push(changes); // throws → caller keeps dirty rows
    await this.store.clearDirty(dirty.map((d) => ({ table: d.table, id: d.id as string })));
    return dirty.length;
  }

  private async uploadPhotos(): Promise<void> {
    for (const p of await this.store.getPendingPhotos()) {
      try {
        await this.transport.putPhoto(p.id, p.localUri);
        await this.store.markPhotoCached(p.id);
      } catch {
        // keep pending; retried next sync
      }
    }
  }

  private async pull(): Promise<number> {
    const cursor = await this.store.getCursor();
    const resp: PullResponse = await this.transport.pull(cursor);
    const { maxUpdatedAt } = await this.store.applyChanges(resp.changes);

    let next = resp.server_time;
    if (maxUpdatedAt && maxUpdatedAt > next) {
      next = maxUpdatedAt;
    }
    if (cursor && cursor > next) {
      next = cursor;
    }
    await this.store.setCursor(next);

    let count = 0;
    for (const rows of Object.values(resp.changes)) {
      count += rows.length;
    }
    return count;
  }

  private async downloadPhotos(): Promise<void> {
    for (const id of await this.store.getMissingPhotos()) {
      try {
        const localUri = await this.transport.getPhoto(id);
        await this.store.savePhotoFile(id, localUri);
      } catch {
        // keep missing; retried next sync
      }
    }
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd /Users/rafif/Developer/personal/pawly/mobile && npx vitest run src/sync`
Expected: PASS (6 client tests).

- [ ] **Step 5: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): sync client orchestration with dirty tracking and photo transfer"
```

---

### Task 6: HTTP transport + end-to-end test against the real Go server

**Files:**
- Create: `mobile/src/sync/transport.ts`
- Test: `mobile/src/sync/__tests__/transport.test.ts`
- Test: `mobile/src/sync/__tests__/server-e2e.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `mobile/src/sync/__tests__/transport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { HttpTransport } from '../transport';

function nodeFetchBase(base: string): typeof fetch {
  return async (input: any, init?: any) => {
    const url = typeof input === 'string' ? new URL(input, base) : input;
    const headers = new Headers(init?.headers);
    const body =
      init?.body instanceof Blob
        ? Buffer.from(await init.body.arrayBuffer())
        : (init?.body as BodyInit | undefined);
    return fetch(url.toString(), { ...init, body, headers });
  } as unknown as typeof fetch;
}

function startMockServer() {
  const calls: { url: string; method: string }[] = [];
  const server = createServer((req, res) => {
    calls.push({ url: req.url ?? '', method: req.method ?? '' });
    if (req.method === 'POST' && req.url === '/sync/push') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok', applied: 1 }));
      });
      return;
    }
    if (req.method === 'GET' && req.url?.startsWith('/sync/pull')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ server_time: '2026-07-05T00:00:00.000Z', changes: {} }));
      return;
    }
    if (req.method === 'PUT' && req.url?.startsWith('/photos/')) {
      let size = 0;
      req.on('data', (c) => (size += c.length));
      req.on('end', () => {
        res.statusCode = size > 0 ? 204 : 400;
        res.end();
      });
      return;
    }
    if (req.method === 'GET' && req.url?.startsWith('/photos/')) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.end(Buffer.from('JPEGDATA'));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  return new Promise<{ base: string; calls: typeof calls; close: () => void }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        base: `http://127.0.0.1:${port}`,
        calls,
        close: () => server.close(),
      });
    });
  });
}

describe('HttpTransport', () => {
  it('pull sends since param and parses the response', async () => {
    const srv = await startMockServer();
    try {
      const t = new HttpTransport({ baseUrl: srv.base, fetch: nodeFetchBase(srv.base) });
      const resp = await t.pull('2026-07-01T00:00:00.000Z');
      expect(resp.server_time).toBe('2026-07-05T00:00:00.000Z');
      expect(srv.calls[0].url).toBe('/sync/pull?since=2026-07-01T00:00:00.000Z');
    } finally {
      srv.close();
    }
  });

  it('pull with null since omits the param', async () => {
    const srv = await startMockServer();
    try {
      const t = new HttpTransport({ baseUrl: srv.base, fetch: nodeFetchBase(srv.base) });
      await t.pull(null);
      expect(srv.calls[0].url).toBe('/sync/pull');
    } finally {
      srv.close();
    }
  });

  it('push posts changes as JSON', async () => {
    const srv = await startMockServer();
    try {
      const t = new HttpTransport({ baseUrl: srv.base, fetch: nodeFetchBase(srv.base) });
      await t.push(emptyChanges);
      expect(srv.calls[0].method).toBe('POST');
    } finally {
      srv.close();
    }
  });

  it('putPhoto sends the file bytes and succeeds on 204', async () => {
    const srv = await startMockServer();
    try {
      const t = new HttpTransport({
        baseUrl: srv.base,
        fetch: nodeFetchBase(srv.base),
        fileToBlob: async () => new Blob([Buffer.from('JPEGBYTES')], { type: 'image/jpeg' }),
      });
      await t.putPhoto('ph1', 'file:///unused-in-test.jpg');
      expect(srv.calls[0].method).toBe('PUT');
    } finally {
      srv.close();
    }
  });

  it('putPhoto rejects when the server rejects (no row)', async () => {
    const srv = await startMockServer();
    try {
      const t = new HttpTransport({
        baseUrl: srv.base,
        fetch: nodeFetchBase(srv.base),
        fileToBlob: async () => new Blob([]),
      });
      await expect(t.putPhoto('ghost', 'file:///x.jpg')).rejects.toThrow();
    } finally {
      srv.close();
    }
  });

  it('getPhoto saves bytes to the local filesystem', async () => {
    const srv = await startMockServer();
    try {
      const saved: { uri: string; data: Uint8Array }[] = [];
      const t = new HttpTransport({
        baseUrl: srv.base,
        fetch: nodeFetchBase(srv.base),
        saveBytes: async (uri, data) => {
          saved.push({ uri, data });
        },
      });
      const uri = await t.getPhoto('ph1');
      expect(uri).toBe('file:///cache/ph1.jpg');
      expect(new TextDecoder().decode(saved[0].data)).toBe('JPEGDATA');
    } finally {
      srv.close();
    }
  });

  it('surfaces non-2xx responses as errors', async () => {
    const srv = await startMockServer();
    try {
      const t = new HttpTransport({ baseUrl: srv.base + '/wrong-base', fetch: nodeFetchBase(srv.base) });
      await expect(t.pull(null)).rejects.toThrow();
    } finally {
      srv.close();
    }
  });
});
```

Also add at the top of `transport.test.ts`, after the imports:

```ts
import type { Changes } from '../../db/types';

const emptyChanges: Changes = {
  cats: [], moments: [], purchases: [], reminders: [], reminder_completions: [], photos: [],
};
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd /Users/rafif/Developer/personal/pawly/mobile && npx vitest run src/sync/__tests__/transport.test.ts`
Expected: FAIL — `../transport` not found.

- [ ] **Step 3: Implement the transport**

Create `mobile/src/sync/transport.ts`:

```ts
import type { Changes } from '../db/types';
import type { PullResponse } from './types';

export interface TransportDeps {
  baseUrl: string;
  fetch: typeof fetch;
  // In the app: expo-file-system's File(path).blob(); in tests: node Blob.
  fileToBlob?: (uri: string) => Promise<Blob>;
  // In the app: new File(uri).write(data); in tests: node fs write.
  saveBytes?: (uri: string, data: Uint8Array) => Promise<void>;
}

// HTTP implementation of SyncTransport against the Pawly Go server.
export class HttpTransport {
  private readonly deps: Required<TransportDeps>;

  constructor(deps: TransportDeps) {
    this.deps = {
      fileToBlob: async () => {
        throw new Error('fileToBlob not configured');
      },
      saveBytes: async () => {
        throw new Error('saveBytes not configured');
      },
      ...deps,
    };
  }

  private base(path: string): string {
    return this.deps.baseUrl.replace(/\/+$/, '') + path;
  }

  private async check(res: Response, what: string): Promise<Response> {
    if (!res.ok) {
      throw new Error(`${what} failed: HTTP ${res.status}`);
    }
    return res;
  }

  async pull(since: string | null): Promise<PullResponse> {
    const url = since ? this.base(`/sync/pull?since=${encodeURIComponent(since)}`) : this.base('/sync/pull');
    const res = await this.check(await this.deps.fetch(url), 'pull');
    return (await res.json()) as PullResponse;
  }

  async push(changes: Changes): Promise<void> {
    const res = await this.check(
      await this.deps.fetch(this.base('/sync/push'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      }),
      'push'
    );
    const body = (await res.json()) as { status?: string };
    if (body.status !== 'ok') {
      throw new Error(`push rejected: ${JSON.stringify(body)}`);
    }
  }

  async putPhoto(id: string, localUri: string): Promise<void> {
    const blob = await this.deps.fileToBlob(localUri);
    const res = await this.check(
      await this.deps.fetch(this.base(`/photos/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      }),
      'photo upload'
    );
    void res;
  }

  async getPhoto(id: string): Promise<string> {
    const res = await this.check(
      await this.deps.fetch(this.base(`/photos/${encodeURIComponent(id)}`)),
      'photo download'
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    const uri = `file:///cache/photos/${id}`;
    await this.deps.saveBytes(uri, bytes);
    return uri;
  }
}
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `cd /Users/rafif/Developer/personal/pawly/mobile && npx vitest run src/sync/__tests__/transport.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the end-to-end test against the real Go server**

Create `mobile/src/sync/__tests__/server-e2e.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from '../../db/repository';
import { migrate, openTestDb } from '../../db/schema';
import { HttpTransport } from '../transport';
import { SyncClient } from '../client';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..'); // mobile/../.. = repo root
const SERVER_BINARY = '/tmp/pawly-e2e';
const CACHE_DIR = join(tmpdir(), 'pawly-e2e-cache');

// The transport used by the app in production: node fetch + node Blob +
// node fs writes. Runs against the REAL Go server binary. IMPORTANT: all
// fixture timestamps are future-dated (2030) so the server's stale-clock
// clamp never fires and LWW is tested purely.
const e2eDeps = (baseUrl: string) => ({
  baseUrl,
  fetch: fetch as typeof fetch,
  fileToBlob: async (uri: string) => new Blob([readFileSync(uri.replace('file://', ''))], { type: 'image/jpeg' }),
  saveBytes: async (uri: string, data: Uint8Array) => {
    // HttpTransport.getPhoto writes to file:///cache/photos/<id>; map that
    // to a writable temp dir in the Node test environment.
    const path = uri.replace('file:///cache/photos', CACHE_DIR);
    writeFileSync(path, data);
  },
});

describe('E2E: mobile sync client against the real Pawly Go server', () => {
  let server: ChildProcess;
  let baseUrl: string;
  let dataDir: string;
  let port: number;

  beforeAll(async () => {
    if (!existsSync(SERVER_BINARY)) {
      throw new Error(
        `Missing ${SERVER_BINARY}. Run: cd ${join(REPO_ROOT, 'server')} && go build -o ${SERVER_BINARY} ./cmd/pawly`
      );
    }
    port = 18090 + Math.floor(Math.random() * 100);
    dataDir = mkdtempSync(join(tmpdir(), 'pawly-e2e-'));
    baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(SERVER_BINARY, ['-port', String(port), '-data-dir', dataDir], {
      stdio: 'ignore',
    });
    // wait for healthz
    for (let i = 0; i < 50; i++) {
      try {
        execSync(`curl -sf ${baseUrl}/healthz`, { stdio: 'ignore' });
        return;
      } catch {
        // server not up yet
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('Go server did not become healthy');
  });

  afterAll(() => {
    server?.kill();
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(CACHE_DIR, { recursive: true, force: true });
  });

  it('full sync round trip: two devices converge through the real server', async () => {
    // --- device A ---
    const dbA = await openTestDb();
    await migrate(dbA);
    const repoA = new Repository(dbA);
    const clientA = new SyncClient(repoA, new HttpTransport(e2eDeps(baseUrl)));

    // A creates a cat offline and syncs it up. (2030 dates: the server
    // clamps stale timestamps to its own clock, which would interfere.)
    await repoA.upsertLocal('cats', {
      id: 'cat-1', name: 'Miko', sex: 'male', status: 'alive',
      created_at: '2030-07-01T00:00:00.000Z', updated_at: '2030-07-01T00:00:00.000Z',
    });
    await clientA.sync();

    // --- device B: fresh install pulls everything ---
    const dbB = await openTestDb();
    await migrate(dbB);
    const repoB = new Repository(dbB);
    const clientB = new SyncClient(repoB, new HttpTransport(e2eDeps(baseUrl)));
    await clientB.sync();
    expect((await repoB.allCats()).map((c) => c.name)).toContain('Miko');

    // --- B edits the cat and adds a purchase, syncs ---
    await repoB.upsertLocal('cats', {
      id: 'cat-1', name: 'Miko (Bella)', sex: 'male', status: 'alive',
      created_at: '2030-07-01T00:00:00.000Z', updated_at: '2030-07-02T00:00:00.000Z',
    });
    await repoB.upsertLocal('purchases', {
      id: 'p-1', item: 'Whiskas 1.2kg', price: 65000, category: 'food', date: '2030-07-28',
      created_at: '2030-07-28T00:00:00.000Z', updated_at: '2030-07-28T00:00:00.000Z',
    });
    await clientB.sync();

    // --- A pulls and must converge ---
    await clientA.sync();
    const catsA = await repoA.allCats();
    expect(catsA).toHaveLength(1);
    expect(catsA[0].name).toBe('Miko (Bella)');

    // --- photo flow: A adds a photo row + local file, syncs; B downloads it ---
    await repoA.upsertLocal('photos', {
      id: 'ph-1', taken_at: '2030-07-20T00:00:00.000Z',
      created_at: '2030-07-20T00:00:00.000Z', updated_at: '2030-07-20T00:00:00.000Z',
    });
    const photoFile = join(tmpdir(), 'pawly-e2e-photo.jpg');
    writeFileSync(photoFile, Buffer.from('E2EPHOTO'));
    await repoA.addPendingPhoto('ph-1', `file://${photoFile}`);
    await clientA.sync();

    await clientB.sync();
    const missingB = await repoB.getMissingPhotos();
    expect(missingB).not.toContain('ph-1');

    // cleanup the temp photo
    rmSync(photoFile, { force: true });
  });
});
```

Note: `HttpTransport.getPhoto` writes to `file:///cache/photos/{id}`; in this test `e2eDeps.saveBytes` maps that path into `CACHE_DIR` under the OS tmpdir (see the deps definition above).

- [ ] **Step 6: Build the Go server and run the E2E test**

```bash
cd /Users/rafif/Developer/personal/pawly/server
go build -o /tmp/pawly-e2e ./cmd/pawly
cd /Users/rafif/Developer/personal/pawly/mobile
npx vitest run src/sync/__tests__/server-e2e.test.ts
```

Expected: PASS — proves the mobile transport speaks the real server's contract (push, pull, LWW, photo upload/download).

- [ ] **Step 7: Run the whole mobile suite**

Run: `cd /Users/rafif/Developer/personal/pawly/mobile && npm test`
Expected: PASS — all tests.

- [ ] **Step 8: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): HTTP transport and E2E sync test against the Go server"
```

---

### Task 7: Settings store + i18n

**Files:**
- Create: `mobile/src/settings/settings.ts`
- Create: `mobile/src/i18n/index.ts`, `mobile/src/i18n/id.json`, `mobile/src/i18n/en.json`
- Test: `mobile/src/settings/__tests__/settings.test.ts`, `mobile/src/i18n/__tests__/i18n.test.ts`

- [ ] **Step 1: Install i18n dependencies**

```bash
cd /Users/rafif/Developer/personal/pawly/mobile
npx expo install expo-localization
npm i i18next react-i18next
```

- [ ] **Step 2: Write the failing tests**

Create `mobile/src/settings/__tests__/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { getLanguage, getServerUrl, setLanguage, setServerUrl } from '../settings';

describe('settings', () => {
  it('defaults: no server URL, Indonesian language', async () => {
    expect(await getServerUrl()).toBeNull();
    expect(await getLanguage()).toBe('id');
  });

  it('round-trips server URL and language', async () => {
    await setServerUrl('http://192.168.1.50:8080');
    await setLanguage('en');
    expect(await getServerUrl()).toBe('http://192.168.1.50:8080');
    expect(await getLanguage()).toBe('en');
  });

  it('normalizes server URL (strips trailing slash, requires scheme)', async () => {
    await setServerUrl('192.168.1.50:8080/');
    expect(await getServerUrl()).toBe('http://192.168.1.50:8080');
  });

  it('rejects invalid server URLs', async () => {
    await expect(setServerUrl('not a url')).rejects.toThrow();
  });

  it('accepts https server URLs unchanged', async () => {
    await setServerUrl('https://pawly.example.com');
    expect(await getServerUrl()).toBe('https://pawly.example.com');
  });
});
```

Create `mobile/src/i18n/__tests__/i18n.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import id from '../id.json';
import en from '../en.json';

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
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd /Users/rafif/Developer/personal/pawly/mobile && npx vitest run src/settings src/i18n`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement the settings store**

Create `mobile/src/settings/settings.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_SERVER_URL = 'pawly.serverUrl';
const KEY_LANGUAGE = 'pawly.language';

export async function getServerUrl(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_SERVER_URL);
}

// Normalizes: adds http:// when the scheme is missing, strips trailing
// slashes. Rejects anything that still isn't a valid http(s) URL.
export async function setServerUrl(value: string): Promise<void> {
  let normalized = value.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'http://' + normalized;
  }
  normalized = normalized.replace(/\/+$/, '');
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('invalid server URL');
  }
  if (!parsed.hostname) {
    throw new Error('invalid server URL');
  }
  await AsyncStorage.setItem(KEY_SERVER_URL, normalized);
}

export async function getLanguage(): Promise<'id' | 'en'> {
  const lang = await AsyncStorage.getItem(KEY_LANGUAGE);
  return lang === 'en' ? 'en' : 'id';
}

export async function setLanguage(lang: 'id' | 'en'): Promise<void> {
  await AsyncStorage.setItem(KEY_LANGUAGE, lang);
}
```

(Note: `new URL('http://192.168.1.50:8080')` works in Hermes via expo's URL polyfill; on older runtimes it is also fine in Node for tests.)

- [ ] **Step 5: Implement i18n**

Create `mobile/src/i18n/id.json`:

```json
{
  "common": {
    "save": "Simpan",
    "cancel": "Batal",
    "delete": "Hapus",
    "loading": "Memuat..."
  },
  "settings": {
    "title": "Pengaturan",
    "serverUrl": "Alamat server",
    "serverUrlHint": "Contoh: 192.168.1.50:8080",
    "language": "Bahasa",
    "sync": "Sinkronkan sekarang",
    "syncStatus": "Status sinkronisasi",
    "synced": "Terakhir disinkronkan: {{time}}",
    "never": "Belum pernah disinkronkan",
    "syncing": "Menyinkronkan...",
    "serverOffline": "Server tidak terjangkau",
    "saved": "Tersimpan"
  },
  "home": {
    "title": "Beranda"
  }
}
```

Create `mobile/src/i18n/en.json` (same keys, English values):

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "loading": "Loading..."
  },
  "settings": {
    "title": "Settings",
    "serverUrl": "Server address",
    "serverUrlHint": "Example: 192.168.1.50:8080",
    "language": "Language",
    "sync": "Sync now",
    "syncStatus": "Sync status",
    "synced": "Last synced: {{time}}",
    "never": "Never synced",
    "syncing": "Syncing...",
    "serverOffline": "Server unreachable",
    "saved": "Saved"
  },
  "home": {
    "title": "Home"
  }
}
```

Create `mobile/src/i18n/index.ts`:

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import id from './id.json';
import en from './en.json';

i18n.use(initReactI18next).init({
  resources: {
    id: { translation: id },
    en: { translation: en },
  },
  lng: 'id',
  fallbackLng: 'id',
  interpolation: { escapeValue: false },
});

export function detectLanguage(): 'id' | 'en' {
  const locale = getLocales()[0]?.languageCode ?? 'id';
  return locale === 'en' ? 'en' : 'id';
}

export async function setAppLanguage(lang: 'id' | 'en'): Promise<void> {
  await i18n.changeLanguage(lang);
}

export default i18n;
```

- [ ] **Step 6: Configure the vitest mock for AsyncStorage**

The settings test imports the async-storage jest mock directly. To keep that working, ensure `test/setup.ts` does NOT auto-mock AsyncStorage (it doesn't). Run:

```bash
cd /Users/rafif/Developer/personal/pawly/mobile
npx vitest run src/settings src/i18n
```

Expected: PASS (5 settings tests + 1 i18n test). If the AsyncStorage mock import path fails, install the peer it needs: `npm i -D @testing-library/jest-dom` and re-run.

- [ ] **Step 7: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): settings store (server URL, language) and i18n with id/en resources"
```

---

### Task 8: Sync engine hook + Settings screen

**Files:**
- Create: `mobile/src/hooks/useSync.tsx`
- Create: `mobile/app/settings.tsx`
- Modify: `mobile/app/_layout.tsx` (wrap with SyncProvider)

- [ ] **Step 1: Implement the sync engine hook**

Create `mobile/src/hooks/useSync.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { expoDb } from '../db/expoAdapter';
import { migrate } from '../db/schema';
import { Repository } from '../db/repository';
import { HttpTransport } from '../sync/transport';
import { SyncClient } from '../sync/client';
import { getServerUrl } from '../settings/settings';

export type SyncStatus =
  | { state: 'idle'; lastSync: string | null; error: string | null }
  | { state: 'syncing'; lastSync: string | null }
  | { state: 'error'; lastSync: string | null; error: string };

interface SyncContextValue {
  status: SyncStatus;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue>({
  status: { state: 'idle', lastSync: null, error: null },
  syncNow: async () => {},
});

async function buildClient(): Promise<{ client: SyncClient; repo: Repository } | null> {
  const baseUrl = await getServerUrl();
  if (!baseUrl) {
    return null;
  }
  // In this task we keep the app's DB access simple: the SQLiteProvider
  // below opens 'pawly.db'; the repository is created per sync with the
  // same database name so all queries share one file.
  const db = await import('expo-sqlite').then((m) => m.openDatabaseAsync('pawly.db'));
  const adapter = expoDb(db);
  await migrate(adapter);
  const repo = new Repository(adapter);
  const transport = new HttpTransport({
    baseUrl,
    fetch: (await import('expo/fetch')).fetch,
    fileToBlob: async (uri: string) => (new FileSystem.File(uri)).blob(),
    saveBytes: async (uri: string, data: Uint8Array) => {
      const file = new FileSystem.File(uri);
      await file.write(new Uint8Array(data));
    },
  });
  return { client: new SyncClient(repo, transport), repo };
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle', lastSync: null, error: null });
  const lastSyncRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  const router = useRouter();

  const syncNow = useCallback(async () => {
    if (syncingRef.current) {
      return;
    }
    syncingRef.current = true;
    setStatus({ state: 'syncing', lastSync: lastSyncRef.current });
    try {
      const built = await buildClient();
      if (!built) {
        router.push('/settings');
        setStatus({ state: 'idle', lastSync: lastSyncRef.current, error: null });
        return;
      }
      await built.client.sync();
      const now = new Date().toISOString();
      lastSyncRef.current = now;
      setStatus({ state: 'idle', lastSync: now, error: null });
    } catch {
      setStatus({ state: 'error', lastSync: lastSyncRef.current, error: 'sync failed' });
    } finally {
      syncingRef.current = false;
    }
  }, [router]);

  // Sync on app foreground + network connect.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncNow();
      }
    });
    return () => sub.remove();
  }, [syncNow]);

  useEffect(() => {
    const net = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void syncNow();
      }
    });
    void syncNow();
    return () => net.remove();
  }, [syncNow]);

  const value = useMemo(() => ({ status, syncNow }), [status, syncNow]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}
```

Note on the double `openDatabaseAsync`: the SQLiteProvider in the root layout also opens `pawly.db`. expo-sqlite shares one connection per database name, so this is safe. If the SQLiteProvider is removed for simplicity, drop its usage in the root layout too — see Step 2.

- [ ] **Step 2: Wrap the app with SyncProvider**

Replace `mobile/app/_layout.tsx` with:

```tsx
import { Stack } from 'expo-router';
import { SyncProvider } from '../src/hooks/useSync';

export default function RootLayout() {
  return (
    <SyncProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Pengaturan' }} />
      </Stack>
    </SyncProvider>
  );
}
```

- [ ] **Step 3: Implement the Settings screen**

Create `mobile/app/settings.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getLanguage, getServerUrl, setLanguage, setServerUrl } from '../src/settings/settings';
import { detectLanguage, setAppLanguage } from '../src/i18n';
import { useSync } from '../src/hooks/useSync';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { status, syncNow } = useSync();
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [lang, setLang] = useState<'id' | 'en'>('id');

  useEffect(() => {
    void (async () => {
      setUrl((await getServerUrl()) ?? '');
      setLang(await getLanguage());
    })();
  }, []);

  const save = async () => {
    try {
      await setServerUrl(url);
      await setLanguage(lang);
      await setAppLanguage(lang);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // invalid URL: surface via the saved flag staying false; a real form
      // validation hint can be added in Plan 3
    }
  };

  const lastSync = status.lastSync
    ? t('settings.synced', { time: new Date(status.lastSync).toLocaleTimeString() })
    : t('settings.never');

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('settings.serverUrl')}</Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder={t('settings.serverUrlHint')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <Text style={styles.label}>{t('settings.language')}</Text>
      <View style={styles.row}>
        {(['id', 'en'] as const).map((l) => (
          <Pressable
            key={l}
            style={[styles.chip, lang === l && styles.chipActive]}
            onPress={() => setLang(l)}
          >
            <Text style={lang === l ? styles.chipActiveText : undefined}>{l === 'id' ? 'Bahasa Indonesia' : 'English'}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.button} onPress={save}>
        <Text style={styles.buttonText}>{t('common.save')}</Text>
      </Pressable>
      {saved && <Text style={styles.hint}>{t('settings.saved')}</Text>}

      <Text style={styles.label}>{t('settings.syncStatus')}</Text>
      {status.state === 'syncing' ? (
        <ActivityIndicator />
      ) : (
        <Text style={styles.hint}>
          {status.state === 'error' ? t('settings.serverOffline') : lastSync}
        </Text>
      )}
      <Pressable style={styles.button} onPress={() => void syncNow()}>
        <Text style={styles.buttonText}>{t('settings.sync')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#ccc' },
  chipActive: { backgroundColor: '#4a6cf7', borderColor: '#4a6cf7' },
  chipActiveText: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: '#4a6cf7', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  hint: { color: '#666', fontSize: 13 },
});
```

- [ ] **Step 4: Add the Settings shortcut to the home tab header**

In `mobile/app/(tabs)/_layout.tsx`, add a header right button linking to `/settings`:

```tsx
import { Tabs, Link } from 'expo-router';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable style={{ marginRight: 16 }}>
                <Ionicons name="settings-outline" size={22} color="#4a6cf7" />
              </Pressable>
            </Link>
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 5: Verify typecheck and suite**

Run:

```bash
cd /Users/rafif/Developer/personal/pawly/mobile
npx tsc --noEmit
npm test
```

Expected: typecheck clean; all tests pass.

- [ ] **Step 6: Manual smoke check on a device (optional but recommended)**

With the Go server running on the Mac Mini (or `go run` locally on port 8080), run `npx expo start` and in Expo Go on the Android phone: open the app → tap ⚙️ → enter the server address → tap Simpan → tap Sinkronkan sekarang → status shows "Terakhir disinkronkan". If the server is unreachable, the status shows "Server tidak terjangkau" and nothing crashes.

- [ ] **Step 7: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): sync engine hook with foreground/network triggers and settings screen"
```

---

## After this plan

The mobile foundation is complete: local SQLite with the sync contract, a tested SyncClient, HTTP transport proven against the real Go server, settings, and i18n. **Plan 3 (`docs/superpowers/plans/2026-08-01-pawly-mobile-features.md`)** builds the five tabs on top: cats CRUD + family tree, moments + photo timeline, reminders with local notifications and check-off, purchases with weekly/monthly summaries, and the home dashboard.

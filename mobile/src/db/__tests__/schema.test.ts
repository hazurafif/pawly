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
    expect(() =>
      db.run(`INSERT INTO cats (id, name, sex, status, created_at, updated_at) VALUES ('c1','M','male','alive','2026-07-01T00:00:00.000Z','2026-07-01T00:00:00Z')`)
    ).toThrow(/updated_at/);
  });
});

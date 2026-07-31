import { describe, expect, it } from 'vitest';
import { openTestDb } from '../testDb';
import { migrate, upsertSql } from '../schema';
import { COLUMNS, TABLES } from '../types';

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

  it('migrate refuses to run on a newer schema', async () => {
    const db = await openTestDb();
    await migrate(db);
    await db.exec('PRAGMA user_version = 99');
    await expect(migrate(db)).rejects.toThrow(/newer than this app supports/);
  });

  it('enforces the timestamp format check constraint via application schema', async () => {
    const db = await openTestDb();
    await migrate(db);
    await expect(
      db.run(`INSERT INTO cats (id, name, sex, status, created_at, updated_at) VALUES ('c1','M','male','alive','2026-07-01T00:00:00.000Z','2026-07-01T00:00:00Z')`)
    ).rejects.toThrow(/updated_at/);
  });
});

describe('upsertSql', () => {
  it('generates LWW upsert SQL for every table', () => {
    for (const table of TABLES) {
      const sql = upsertSql(table);
      expect(sql).toContain(`INSERT INTO ${table}`);
      expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
      expect(sql).toContain(`${table}.updated_at < excluded.updated_at`);
      const cols = COLUMNS[table];
      for (const c of cols) {
        if (c !== 'id') expect(sql).toContain(`${c} = excluded.${c}`);
      }
      const placeholders = (sql.match(/\?/g) ?? []).length;
      expect(placeholders).toBe(cols.length);
    }
  });

  it('applies newer rows and ignores older rows (LWW)', async () => {
    const db = await openTestDb();
    await migrate(db);
    const sql = upsertSql('cats');
    const older = [
      'c1', 'M', 'male', null, 0, null, 0, 'unknown', null, 'alive',
      null, null, null, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', null,
    ];
    const newer = [
      'c1', 'M', 'male', null, 0, null, 0, 'unknown', 'grew up', 'alive',
      null, null, null, '2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z', null,
    ];

    await db.run(sql, older);
    expect(await db.first<{ name: string; story: string }>('SELECT name, story FROM cats WHERE id = ?', ['c1']))
      .toEqual({ name: 'M', story: null });

    await db.run(sql, newer);
    expect(await db.first<{ story: string }>('SELECT story FROM cats WHERE id = ?', ['c1']))
      .toEqual({ story: 'grew up' });

    await db.run(sql, older);
    expect(await db.first<{ story: string }>('SELECT story FROM cats WHERE id = ?', ['c1']))
      .toEqual({ story: 'grew up' });
  });
});

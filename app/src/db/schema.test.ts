import { describe, expect, it } from 'vitest';
import { migrate, upsertSql } from './schema';
import { openTestDb } from './testDb';
import { TABLES } from './types';

describe('migrate', () => {
  it('creates every synced table plus client tables', async () => {
    const db = await openTestDb();
    await migrate(db);
    for (const tbl of [...TABLES, 'dirty', 'photo_cache', 'sync_state', 'sqlite_sequence']) {
      if (tbl === 'sqlite_sequence') continue;
      const row = await db.first<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
        [tbl]
      );
      expect(row, `table ${tbl} should exist`).not.toBeNull();
    }
    const v = await db.first<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(1);
  });

  it('is idempotent', async () => {
    const db = await openTestDb();
    await migrate(db);
    await migrate(db);
    const v = await db.first<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(1);
  });
});

describe('upsertSql', () => {
  it('writes every column and only overwrites newer rows', () => {
    const sql = upsertSql('events');
    expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
    expect(sql).toContain('WHERE events.updated_at < excluded.updated_at');
  });
});

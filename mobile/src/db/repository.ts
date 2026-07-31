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

  async applyChanges(changes: Partial<Record<TableName, Row[]>>): Promise<ApplyResult> {
    let maxUpdatedAt: string | null = null;
    await this.db.exec('BEGIN');
    try {
      for (const table of Object.keys(changes) as TableName[]) {
        for (const row of changes[table]!) {
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

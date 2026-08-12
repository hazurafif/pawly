import { COLUMNS, type Db, type Row, type TableName } from './types';
import type { Event, EventWithPet, Pet, PhotoWithUri, ReminderRule, RuleWithPet } from './types';
import { forceUpsertSql, migrate, upsertSql } from './schema';
import { notifyDataChanged } from './notify';

export interface DirtyRow {
  table: TableName;
  row: Row & { id: string };
}

export interface ApplyResult {
  maxUpdatedAt: string | null;
}

// NOT NULL columns without defaults: a row missing any of these must not be
// written (an absent key is NOT "unchanged" — it would NULL the column).
const REQUIRED_COLUMNS: Record<TableName, readonly string[]> = {
  pets: ['name', 'created_at', 'updated_at'],
  events: ['kind', 'occurred_at', 'created_at', 'updated_at'],
  photos: ['created_at', 'updated_at'],
  reminder_rules: ['title', 'due', 'repeat', 'created_at', 'updated_at'],
};

export interface EventFilter {
  kinds?: readonly string[];
  q?: string;
  limit?: number;
}

// All phone-side data access. Takes the Db facade so tests run on sql.js.
export class Repository {
  constructor(private readonly db: Db) {}

  // The Db facade is a single shared connection: BEGIN/COMMIT calls must not
  // overlap, or a nested BEGIN rejects. This promise chain serializes the
  // transactional methods.
  private txQueue: Promise<unknown> = Promise.resolve();

  private withTx<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.txQueue.then(() => fn());
    // keep the chain alive even when fn rejects
    this.txQueue = run.catch(() => {});
    return run;
  }

  // --- local writes (dirty tracking) ---

  // Invariant: callers pass FULL rows (load-then-save). Absent keys are NOT
  // treated as "unchanged" — valuesFor rejects rows missing required columns.
  // `object` (not Row) so typed row interfaces are accepted at call sites.
  async upsertLocal(table: TableName, row: object): Promise<void> {
    return this.withTx(async () => {
      const r = row as Row;
      const id = r.id as string;
      await this.db.exec('BEGIN');
      try {
        await this.db.run(upsertSql(table), this.valuesFor(table, r));
        await this.db.run(
          `INSERT INTO dirty (table_name, id) VALUES (?, ?)
           ON CONFLICT(table_name, id) DO NOTHING`,
          [table, id]
        );
        await this.db.exec('COMMIT');
      } catch (e) {
        try {
          await this.db.exec('ROLLBACK');
        } catch {
          // rollback failure must not mask the original error
        }
        throw e;
      }
      notifyDataChanged();
    });
  }

  async getDirtyRows(): Promise<DirtyRow[]> {
    const rows = await this.db.all<{ table_name: TableName; id: string }>(
      'SELECT table_name, id FROM dirty'
    );
    const out: DirtyRow[] = [];
    for (const d of rows) {
      const row = await this.db.first<Row & { id: string }>(
        `SELECT ${COLUMNS[d.table_name].join(', ')} FROM ${d.table_name} WHERE id = ?`,
        [d.id]
      );
      if (row) {
        out.push({ table: d.table_name, row });
      }
    }
    return out;
  }

  // Returns one row by table + id (including tombstoned rows), or null
  // when it doesn't exist locally. Used by the sync client to attach
  // parent rows to a push batch.
  async getRow(table: TableName, id: string): Promise<(Row & { id: string }) | null> {
    return this.db.first<Row & { id: string }>(
      `SELECT ${COLUMNS[table].join(', ')} FROM ${table} WHERE id = ?`,
      [id]
    );
  }

  // Deletes dirty rows only when the row's CURRENT updated_at still matches
  // the one that was pushed: an edit made mid-sync bumps updated_at, so the
  // dirty row survives and the newer state is pushed on the next pass.
  async clearDirty(ids: { table: TableName; id: string; updatedAt: string }[]): Promise<void> {
    for (const d of ids) {
      await this.db.run(
        `DELETE FROM dirty WHERE table_name = ? AND id = ?
         AND (SELECT updated_at FROM ${d.table} WHERE id = ?) = ?`,
        [d.table, d.id, d.id, d.updatedAt]
      );
    }
  }

  // --- sync application (no dirty marking) ---

  async applyChanges(changes: Partial<Record<TableName, Row[]>>): Promise<ApplyResult> {
    return this.withTx(async () => {
      let maxUpdatedAt: string | null = null;
      await this.db.exec('BEGIN');
      try {
        for (const table of Object.keys(changes) as TableName[]) {
          for (const row of changes[table]!) {
            // Deletes are final in Pawly: a stale pull of a live row must
            // never resurrect a locally tombstoned row. (A push in flight
            // during a delete has its updated_at clamped to server time,
            // which can land after the tombstone and win LWW otherwise.)
            if (!row.deleted_at) {
              const local = await this.db.first<{ deleted_at: string | null }>(
                `SELECT deleted_at FROM ${table} WHERE id = ?`,
                [row.id as string]
              );
              if (local?.deleted_at) {
                continue;
              }
            }
            const res = await this.db.run(upsertSql(table), this.valuesFor(table, row));
            // Only APPLIED rows advance the cursor: a row that loses LWW
            // locally is already present locally, so refetching it is
            // pointless. (A lost row with updated_at > server time is the
            // only refetch-loop edge, self-healing once the local push
            // bumps past it.)
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
        try {
          await this.db.exec('ROLLBACK');
        } catch {
          // rollback failure must not mask the original error
        }
        throw e;
      }
      return { maxUpdatedAt };
    });
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
    notifyDataChanged();
  }

  async getPendingPhotos(): Promise<{ id: string; localUri: string }[]> {
    const rows = await this.db.all<{ photo_id: string; local_uri: string }>(
      `SELECT photo_id, local_uri FROM photo_cache WHERE status = 'pending'`
    );
    return rows.map((r) => ({ id: r.photo_id, localUri: r.local_uri }));
  }

  async markPhotoCached(id: string): Promise<void> {
    await this.db.run(`UPDATE photo_cache SET status = 'cached' WHERE photo_id = ?`, [id]);
    notifyDataChanged();
  }

  async getMissingPhotos(): Promise<string[]> {
    const rows = await this.db.all<{ id: string }>(
      `SELECT p.id FROM photos p
       WHERE p.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM photo_cache c WHERE c.photo_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM dirty d WHERE d.table_name = 'photos' AND d.id = p.id)`
    );
    return rows.map((r) => r.id);
  }

  async savePhotoFile(id: string, localUri: string): Promise<void> {
    await this.db.run(
      `INSERT INTO photo_cache (photo_id, local_uri, status) VALUES (?, ?, 'cached')
       ON CONFLICT(photo_id) DO UPDATE SET local_uri = excluded.local_uri, status = 'cached'`,
      [id, localUri]
    );
    notifyDataChanged();
  }

  // --- pets ---

  async allPets(): Promise<Pet[]> {
    return this.db.all(
      `SELECT ${COLUMNS.pets.join(', ')} FROM pets WHERE deleted_at IS NULL ORDER BY name`
    );
  }

  async getPet(id: string): Promise<Pet | null> {
    return this.db.first(
      `SELECT ${COLUMNS.pets.join(', ')} FROM pets WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
  }

  // --- events (the unified journal stream) ---

  async eventsForPet(petId: string, filter: EventFilter = {}): Promise<Event[]> {
    const where: string[] = ['pet_id = ?', 'deleted_at IS NULL'];
    const params: unknown[] = [petId];
    if (filter.kinds && filter.kinds.length > 0) {
      where.push(`kind IN (${filter.kinds.map(() => '?').join(', ')})`);
      params.push(...filter.kinds);
    }
    if (filter.q && filter.q.trim() !== '') {
      where.push('(title LIKE ? OR text LIKE ?)');
      const like = `%${filter.q.trim()}%`;
      params.push(like, like);
    }
    let sql = `SELECT ${COLUMNS.events.join(', ')} FROM events
      WHERE ${where.join(' AND ')}
      ORDER BY occurred_at DESC, created_at DESC`;
    if (filter.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }
    return this.db.all(sql, params);
  }

  async allEvents(): Promise<EventWithPet[]> {
    return this.db.all(
      `SELECT e.${COLUMNS.events.join(', e.')}, p.name AS pet_name
       FROM events e LEFT JOIN pets p ON p.id = e.pet_id AND p.deleted_at IS NULL
       WHERE e.deleted_at IS NULL
       ORDER BY e.occurred_at DESC, e.created_at DESC`
    );
  }

  // Text search across EVERY pet's journal (title + text), for the global
  // search mode of the Journal tab.
  async searchEvents(q: string): Promise<EventWithPet[]> {
    const like = `%${q.trim()}%`;
    return this.db.all(
      `SELECT e.${COLUMNS.events.join(', e.')}, p.name AS pet_name
       FROM events e LEFT JOIN pets p ON p.id = e.pet_id AND p.deleted_at IS NULL
       WHERE e.deleted_at IS NULL AND (e.title LIKE ? OR e.text LIKE ?)
       ORDER BY e.occurred_at DESC, e.created_at DESC`,
      [like, like]
    );
  }

  async eventsSince(petId: string, isoMs: string): Promise<Event[]> {
    return this.db.all(
      `SELECT ${COLUMNS.events.join(', ')} FROM events
       WHERE pet_id = ? AND deleted_at IS NULL AND occurred_at >= ?
       ORDER BY occurred_at DESC, created_at DESC`,
      [petId, isoMs]
    );
  }

  async favoritesForPet(petId: string): Promise<Event[]> {
    return this.db.all(
      `SELECT ${COLUMNS.events.join(', ')} FROM events
       WHERE pet_id = ? AND deleted_at IS NULL AND favorite = 1
       ORDER BY occurred_at DESC`,
      [petId]
    );
  }

  async setFavorite(eventId: string, favorite: boolean): Promise<void> {
    const row = await this.db.first<Row & { id: string }>(
      `SELECT ${COLUMNS.events.join(', ')} FROM events WHERE id = ?`,
      [eventId]
    );
    if (!row || row.deleted_at) {
      return;
    }
    const now = new Date().toISOString();
    row.favorite = favorite ? 1 : 0;
    row.updated_at = now;
    await this.upsertLocal('events', row);
  }

  // --- photos by event/pet ---

  async photosForPet(petId: string): Promise<PhotoWithUri[]> {
    return this.db.all(
      `SELECT p.${COLUMNS.photos.join(', p.')}, c.local_uri
       FROM photos p
       LEFT JOIN photo_cache c ON c.photo_id = p.id
       WHERE p.deleted_at IS NULL
         AND p.event_id IN (SELECT id FROM events WHERE pet_id = ? AND deleted_at IS NULL)
       ORDER BY p.taken_at DESC, p.created_at DESC`,
      [petId]
    );
  }

  async photosForEvent(eventId: string): Promise<PhotoWithUri[]> {
    return this.db.all(
      `SELECT p.${COLUMNS.photos.join(', p.')}, c.local_uri
       FROM photos p LEFT JOIN photo_cache c ON c.photo_id = p.id
       WHERE p.event_id = ? AND p.deleted_at IS NULL
       ORDER BY p.taken_at DESC, p.created_at DESC`,
      [eventId]
    );
  }

  // Newest photo for a pet — used as the pet's avatar.
  async latestPhotoForPet(petId: string): Promise<PhotoWithUri | null> {
    return this.db.first(
      `SELECT p.${COLUMNS.photos.join(', p.')}, c.local_uri
       FROM photos p
       LEFT JOIN photo_cache c ON c.photo_id = p.id
       WHERE p.deleted_at IS NULL
         AND p.event_id IN (SELECT id FROM events WHERE pet_id = ? AND deleted_at IS NULL)
       ORDER BY p.taken_at DESC, p.created_at DESC
       LIMIT 1`,
      [petId]
    );
  }

  // --- reminder rules ---

  async allRules(): Promise<RuleWithPet[]> {
    return this.db.all(
      `SELECT r.${COLUMNS.reminder_rules.join(', r.')}, p.name AS pet_name
       FROM reminder_rules r LEFT JOIN pets p ON p.id = r.pet_id AND p.deleted_at IS NULL
       WHERE r.deleted_at IS NULL
       ORDER BY r.due ASC, r.title ASC`
    );
  }

  async rulesForPet(petId: string): Promise<ReminderRule[]> {
    return this.db.all(
      `SELECT ${COLUMNS.reminder_rules.join(', ')} FROM reminder_rules
       WHERE pet_id = ? AND deleted_at IS NULL
       ORDER BY due ASC, title ASC`,
      [petId]
    );
  }

  // --- soft delete (tombstone): keeps the row for sync, marks it dirty so the
  // server and every other device learn about it. ---

  async softDelete(table: TableName, id: string): Promise<void> {
    return this.withTx(async () => {
      const row = await this.db.first<Row & { id: string }>(
        `SELECT ${COLUMNS[table].join(', ')} FROM ${table} WHERE id = ?`,
        [id]
      );
      if (!row || row.deleted_at) {
        return;
      }
      const now = new Date().toISOString();
      row.deleted_at = now;
      row.updated_at = now;
      await this.db.exec('BEGIN');
      try {
        // Force-apply: a stale pulled row with a server-clamped timestamp
        // must never block the tombstone (deletes are final).
        await this.db.run(forceUpsertSql(table), this.valuesFor(table, row));
        await this.db.run(
          `INSERT INTO dirty (table_name, id) VALUES (?, ?)
           ON CONFLICT(table_name, id) DO NOTHING`,
          [table, id]
        );
        if (table === 'photos') {
          // The cached binary is unreachable once the row is gone.
          await this.db.run('DELETE FROM photo_cache WHERE photo_id = ?', [id]);
        }
        await this.db.exec('COMMIT');
      } catch (e) {
        try {
          await this.db.exec('ROLLBACK');
        } catch {
          // rollback failure must not mask the original error
        }
        throw e;
      }
      notifyDataChanged();
    });
  }

  // Deleting a pet cascades to everything owned by it: events, their photos,
  // and its reminder rules. All soft-deleted, all dirty — other devices and
  // the server converge on the same tombstones.
  async deletePetCascade(petId: string): Promise<void> {
        return this.withTx(async () => {
      const pet = await this.db.first<Row & { id: string }>(
        `SELECT ${COLUMNS.pets.join(', ')} FROM pets WHERE id = ?`,
        [petId]
      );
            if (!pet || pet.deleted_at) {
        return;
      }
            const now = new Date().toISOString();
      const tombstone = async (table: TableName, row: Row & { id: string }) => {
        row.deleted_at = now;
        row.updated_at = now;
        // Force-apply: see softDelete — deletes are final.
        await this.db.run(forceUpsertSql(table), this.valuesFor(table, row));
        await this.db.run(
          `INSERT INTO dirty (table_name, id) VALUES (?, ?)
           ON CONFLICT(table_name, id) DO NOTHING`,
          [table, row.id]
        );
      };

            const events = await this.db.all<Row & { id: string }>(
        `SELECT ${COLUMNS.events.join(', ')} FROM events WHERE pet_id = ? AND deleted_at IS NULL`,
        [petId]
      );
            const eventIds = events.map((e) => e.id);
      const photos = eventIds.length
        ? await this.db.all<Row & { id: string }>(
            `SELECT ${COLUMNS.photos.join(', ')} FROM photos
             WHERE event_id IN (${eventIds.map(() => '?').join(', ')}) AND deleted_at IS NULL`,
            eventIds
          )
        : [];
            const rules = await this.db.all<Row & { id: string }>(
        `SELECT ${COLUMNS.reminder_rules.join(', ')} FROM reminder_rules
         WHERE pet_id = ? AND deleted_at IS NULL`,
        [petId]
      );
      
      await this.db.exec('BEGIN');
      try {
        await tombstone('pets', pet);
        for (const e of events) {
          await tombstone('events', e);
        }
        for (const p of photos) {
          await tombstone('photos', p);
          await this.db.run('DELETE FROM photo_cache WHERE photo_id = ?', [p.id]);
        }
        for (const r of rules) {
          await tombstone('reminder_rules', r);
        }
        await this.db.exec('COMMIT');
      } catch (e) {
        try {
          await this.db.exec('ROLLBACK');
        } catch {
          // rollback failure must not mask the original error
        }
        throw e;
      }
      notifyDataChanged();
    });
  }

  private valuesFor(table: TableName, row: Row): unknown[] {
    for (const c of REQUIRED_COLUMNS[table]) {
      if (row[c] === undefined) {
        throw new Error('incomplete row for ' + table + ': missing ' + c);
      }
    }
    return COLUMNS[table].map((c) => row[c] ?? null);
  }
}

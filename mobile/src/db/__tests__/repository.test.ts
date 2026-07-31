import { describe, expect, it } from 'vitest';
import { Repository } from '../repository';
import { migrate } from '../schema';
import { openTestDb } from '../testDb';
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
  birth_date_is_estimated: 0,
  rescue_date_is_estimated: 0,
  is_neutered: 'unknown',
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
    await r.clearDirty([{ table: 'cats', id: 'c1', updatedAt: '2026-07-01T00:00:00.000Z' }]);
    expect(await r.getDirtyRows()).toEqual([]);
  });

  it('clearDirty keeps the row when it was edited after being pushed (updated_at changed)', async () => {
    const r = await makeRepo();
    await r.upsertLocal('cats', catRow('c1', '2026-07-01T00:00:00.000Z', { name: 'v1' }));
    // "push" happened with updated_at 07-01; user edits during push → 07-02
    await r.upsertLocal('cats', catRow('c1', '2026-07-02T00:00:00.000Z', { name: 'v2' }));
    await r.clearDirty([{ table: 'cats', id: 'c1', updatedAt: '2026-07-01T00:00:00.000Z' }]);
    expect(await r.getDirtyRows()).toHaveLength(1);
  });

  it('clearDirty removes the row when updated_at is unchanged', async () => {
    const r = await makeRepo();
    await r.upsertLocal('cats', catRow('c1', '2026-07-01T00:00:00.000Z'));
    await r.clearDirty([{ table: 'cats', id: 'c1', updatedAt: '2026-07-01T00:00:00.000Z' }]);
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
      id: 'ph1', taken_at: '2026-07-01T00:00:00.000Z', content_type: 'image/jpeg',
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
        { id: 'phA', taken_at: '2026-07-01T00:00:00.000Z', content_type: 'image/jpeg', created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
        { id: 'phB', taken_at: '2026-07-01T00:00:00.000Z', content_type: 'image/jpeg', created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z' },
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

  it('applyChanges does not advance maxUpdatedAt for lost-LWW rows', async () => {
    const r = await makeRepo();
    await r.upsertLocal('cats', catRow('c1', '2026-07-10T00:00:00.000Z'));
    const res = await r.applyChanges({ cats: [catRow('c1', '2026-07-05T00:00:00.000Z')] });
    expect(res.maxUpdatedAt).toBeNull();
  });

  it('upsertLocal rolls back on failure', async () => {
    const r = await makeRepo();
    await expect(r.upsertLocal('cats', catRow('c1', 'bad-format'))).rejects.toThrow();
    expect(await r.allCats()).toEqual([]);
    expect(await r.getDirtyRows()).toEqual([]);
  });
});

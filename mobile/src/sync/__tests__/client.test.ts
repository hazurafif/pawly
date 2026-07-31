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

const catRow = (id: string, updatedAt: string, overrides: Row = {}): Row & { id: string } => ({
  id, name: 'Miko', sex: 'male', status: 'alive',
  birth_date_is_estimated: 0, rescue_date_is_estimated: 0, is_neutered: 'unknown',
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
    expect(store.clearDirty).toHaveBeenCalledWith([
      { table: 'cats', id: 'c1', updatedAt: '2026-07-01T00:00:00.000Z' },
    ]);
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
        changes: { cats: [catRow('c9', '2026-07-09T00:00:00.000Z')], moments: [], purchases: [], reminders: [], reminder_completions: [], photos: [] } as Changes,
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

  it('skips pushing when there are no dirty rows', async () => {
    const store = fakeStore();
    const transport = fakeTransport();
    const client = new SyncClient(store, transport);

    const result = await client.sync();

    expect(transport.push).not.toHaveBeenCalled();
    expect(transport.pull).toHaveBeenCalled();
    expect(result.pushed).toBe(0);
  });

  it('sends changes with all six table keys, empty arrays for untouched tables', async () => {
    const store = fakeStore({
      getDirtyRows: vi.fn(async () => [{ table: 'purchases' as TableName, row: { id: 'p1', item: 'Whiskas', price: 65000, category: 'food', date: '2026-07-28', created_at: '2026-07-28T00:00:00.000Z', updated_at: '2026-07-28T00:00:00.000Z' } }]),
    });
    const transport = fakeTransport();
    const client = new SyncClient(store, transport);

    await client.sync();

    const pushArg = (transport.push as ReturnType<typeof vi.fn>).mock.calls[0][0] as Changes;
    expect(Object.keys(pushArg).sort()).toEqual(emptyChangesKeys().sort());
  });

  it('first sync sets the cursor to server_time (no dirty rows, empty changes)', async () => {
    const store = fakeStore();
    const transport = fakeTransport({
      pull: vi.fn(async () => ({ server_time: '2026-07-05T00:00:00.000Z', changes: emptyChanges })),
    });
    const client = new SyncClient(store, transport);
    await client.sync();
    expect(store.setCursor).toHaveBeenCalledWith('2026-07-05T00:00:00.000Z');
  });

  it('reports the number of pulled rows', async () => {
    const transport = fakeTransport({
      pull: vi.fn(async () => ({
        server_time: '2026-07-05T00:00:00.000Z',
        changes: { cats: [catRow('c1', '2026-07-01T00:00:00.000Z'), catRow('c2', '2026-07-02T00:00:00.000Z')], moments: [], purchases: [], reminders: [], reminder_completions: [], photos: [] } as Changes,
      })),
    });
    const client = new SyncClient(fakeStore(), transport);
    const result = await client.sync();
    expect(result.pulled).toBe(2);
  });

  it('does not advance the cursor when applying pulled changes fails', async () => {
    const store = fakeStore({
      applyChanges: vi.fn(async () => { throw new Error('apply failed'); }),
    });
    const transport = fakeTransport();
    const client = new SyncClient(store, transport);
    await expect(client.sync()).rejects.toThrow('apply failed');
    expect(store.setCursor).not.toHaveBeenCalled();
  });
});

function emptyChangesKeys(): string[] {
  return Object.keys(emptyChanges);
}

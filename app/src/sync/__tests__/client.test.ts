import { describe, expect, it, vi } from 'vitest';
import { SyncClient, type SyncStore, type SyncTransport } from '../client';
import type { Changes, Row, TableName } from '../../db/types';

function fakeStore(overrides: Partial<SyncStore> = {}): SyncStore {
  return {
    getCursor: vi.fn(async () => null),
    setCursor: vi.fn(async () => {}),
    getDirtyRows: vi.fn(async () => []),
    getRow: vi.fn(async () => null),
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

const petRow = (id: string, updatedAt: string, overrides: Row = {}): Row & { id: string } => ({
  id, name: 'Miko', species: 'cat', sex: 'male', status: 'alive',
  birth_date_is_estimated: 0, rescue_date_is_estimated: 0, is_neutered: 'unknown',
  created_at: '2026-07-01T00:00:00.000Z', updated_at: updatedAt, ...overrides,
});

const emptyChanges: Changes = {
  pets: [], events: [], photos: [], reminder_rules: [],
};

describe('SyncClient', () => {
  it('pushes dirty rows, clears them only on success, and pulls with the cursor', async () => {
    const store = fakeStore({
      getDirtyRows: vi.fn(async () => [{ table: 'pets' as TableName, row: petRow('p1', '2026-07-01T00:00:00.000Z') }]),
    });
    const transport = fakeTransport();
    const client = new SyncClient(store, transport);

    const result = await client.sync();

    expect(transport.push).toHaveBeenCalledWith(
      expect.objectContaining({ pets: [expect.objectContaining({ id: 'p1' })] })
    );
    expect(store.clearDirty).toHaveBeenCalledWith([
      { table: 'pets', id: 'p1', updatedAt: '2026-07-01T00:00:00.000Z' },
    ]);
    expect(transport.pull).toHaveBeenCalledWith(null);
    expect(result.pushed).toBe(1);
  });

  it('attaches clean parent rows to dirty children so the server can satisfy FK checks', async () => {
    const pet = petRow('p1', '2026-06-01T00:00:00.000Z');
    const store = fakeStore({
      getDirtyRows: vi.fn(async () => [
        {
          table: 'events' as TableName,
          row: {
            id: 'e1', pet_id: 'p1', kind: 'feed', title: null, text: null,
            occurred_at: '2026-07-02T00:00:00.000Z', next_due_at: null, data: null,
            favorite: 0, created_at: '2026-07-02T00:00:00.000Z',
            updated_at: '2026-07-02T00:00:00.000Z', deleted_at: null,
          },
        },
        {
          table: 'reminder_rules' as TableName,
          row: {
            id: 'r1', pet_id: 'p1', title: 'Rabies', kind: 'vaccine',
            due: '2026-09-01T00:00:00.000Z', repeat: 'once', dose: null, note: null,
            created_at: '2026-07-28T00:00:00.000Z', updated_at: '2026-07-28T00:00:00.000Z',
            deleted_at: null,
          },
        },
        {
          table: 'photos' as TableName,
          row: {
            id: 'ph1', event_id: 'e1', taken_at: '2026-07-02T00:00:00.000Z',
            content_type: 'image/jpeg', created_at: '2026-07-02T00:00:00.000Z',
            updated_at: '2026-07-02T00:00:00.000Z', deleted_at: null,
          },
        },
      ]),
      // p1 is clean locally (never dirty), so only getRow can surface it.
      getRow: vi.fn(async (table: TableName) =>
        table === 'pets' ? pet : table === 'events' ? {
          id: 'e1', pet_id: 'p1', kind: 'photo', title: null, text: null,
          occurred_at: '2026-07-02T00:00:00.000Z', next_due_at: null, data: null,
          favorite: 0, created_at: '2026-07-02T00:00:00.000Z',
          updated_at: '2026-07-02T00:00:00.000Z', deleted_at: null,
        } : null
      ),
    });
    const transport = fakeTransport();
    const client = new SyncClient(store, transport);

    await client.sync();

    const pushArg = (transport.push as ReturnType<typeof vi.fn>).mock.calls[0][0] as Changes;
    expect(pushArg.pets.map((r) => r.id)).toEqual(['p1']); // deduped: once for event, once for rule, once via photo's event
    expect(pushArg.events.map((r) => r.id)).toEqual(['e1']);
    expect(pushArg.photos.map((r) => r.id)).toEqual(['ph1']);
    expect(pushArg.reminder_rules.map((r) => r.id)).toEqual(['r1']);
    // only the dirty rows are cleared; the attached parents stay clean
    expect(store.clearDirty).toHaveBeenCalledWith([
      { table: 'events', id: 'e1', updatedAt: '2026-07-02T00:00:00.000Z' },
      { table: 'reminder_rules', id: 'r1', updatedAt: '2026-07-28T00:00:00.000Z' },
      { table: 'photos', id: 'ph1', updatedAt: '2026-07-02T00:00:00.000Z' },
    ]);
  });

  it('pushes a dirty pet untouched when its row has no references', async () => {
    const store = fakeStore({
      getDirtyRows: vi.fn(async () => [{ table: 'pets' as TableName, row: petRow('p1', '2026-07-01T00:00:00.000Z') }]),
    });
    const transport = fakeTransport();
    const client = new SyncClient(store, transport);

    await client.sync();

    const pushArg = (transport.push as ReturnType<typeof vi.fn>).mock.calls[0][0] as Changes;
    expect(pushArg.pets).toHaveLength(1);
    expect(pushArg.events).toHaveLength(0);
    expect(store.getRow).not.toHaveBeenCalled();
  });

  it('keeps dirty rows and does not pull when push fails (server down / 4xx)', async () => {
    const store = fakeStore({
      getDirtyRows: vi.fn(async () => [{ table: 'pets' as TableName, row: petRow('p1', '2026-07-01T00:00:00.000Z') }]),
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
        changes: { pets: [petRow('p9', '2026-07-09T00:00:00.000Z')], events: [], photos: [], reminder_rules: [] } as Changes,
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

  it('sends changes with all four table keys, empty arrays for untouched tables', async () => {
    const store = fakeStore({
      getDirtyRows: vi.fn(async () => [{ table: 'reminder_rules' as TableName, row: { id: 'r1', pet_id: null, title: 'Rabies booster', kind: 'vaccine', due: '2026-09-01T00:00:00.000Z', repeat: 'once', dose: null, note: null, created_at: '2026-07-28T00:00:00.000Z', updated_at: '2026-07-28T00:00:00.000Z' } }]),
    });
    const transport = fakeTransport();
    const client = new SyncClient(store, transport);

    await client.sync();

    const pushArg = (transport.push as ReturnType<typeof vi.fn>).mock.calls[0][0] as Changes;
    expect(Object.keys(pushArg).sort()).toEqual(Object.keys(emptyChanges).sort());
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
        changes: { pets: [petRow('p1', '2026-07-01T00:00:00.000Z'), petRow('p2', '2026-07-02T00:00:00.000Z')], events: [], photos: [], reminder_rules: [] } as Changes,
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

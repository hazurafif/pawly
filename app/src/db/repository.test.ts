import { describe, expect, it } from 'vitest';
import { migrate } from './schema';
import { openTestDb } from './testDb';
import { Repository } from './repository';
import type { Db, Event, Pet, Row } from './types';

async function newRepo(): Promise<{ db: Db; repo: Repository }> {
  const db = await openTestDb();
  await migrate(db);
  return { db, repo: new Repository(db) };
}

// applyChanges takes untyped rows; typed helpers are structurally identical.
const rows = <T,>(...items: T[]): Row[] => items as Row[];

function pet(id: string, name: string, extra: Partial<Pet> = {}): Pet {
  return {
    id,
    name,
    species: 'cat',
    sex: 'unknown',
    birth_date: null,
    birth_date_is_estimated: 0,
    rescue_date: null,
    rescue_date_is_estimated: 0,
    is_neutered: 'unknown',
    story: null,
    status: 'alive',
    passed_away_date: null,
    vet_clinic: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    deleted_at: null,
    ...extra,
  };
}

function event(id: string, petId: string, kind: string, occurredAt: string, extra: Partial<Event> = {}): Event {
  return {
    id,
    pet_id: petId,
    kind,
    title: null,
    text: null,
    occurred_at: occurredAt,
    next_due_at: null,
    data: null,
    favorite: 0,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    deleted_at: null,
    ...extra,
  };
}

describe('local writes + dirty tracking', () => {
  it('upserts and marks the row dirty', async () => {
    const { repo } = await newRepo();
    await repo.upsertLocal('pets', pet('p-1', 'Miko'));
    const dirty = await repo.getDirtyRows();
    expect(dirty).toEqual([{ table: 'pets', row: expect.objectContaining({ id: 'p-1' }) }]);
  });

  it('clearDirty only removes rows whose updated_at is unchanged', async () => {
    const { repo } = await newRepo();
    const p = pet('p-1', 'Miko');
    await repo.upsertLocal('pets', p);
    // Push happens: dirty cleared for the pushed timestamp.
    await repo.clearDirty([{ table: 'pets', id: 'p-1', updatedAt: p.updated_at }]);
    expect(await repo.getDirtyRows()).toEqual([]);
  });

  it('a mid-sync edit keeps the dirty row alive', async () => {
    const { repo } = await newRepo();
    const p = pet('p-1', 'Miko');
    await repo.upsertLocal('pets', p);
    // Edited after "push": updated_at bumped, old clear is a no-op.
    const edited = { ...p, name: 'Miko 2', updated_at: '2026-08-02T00:00:00.000Z' };
    await repo.upsertLocal('pets', edited);
    await repo.clearDirty([{ table: 'pets', id: 'p-1', updatedAt: p.updated_at }]);
    const dirty = await repo.getDirtyRows();
    expect(dirty).toHaveLength(1);
    expect(dirty[0].row.updated_at).toBe(edited.updated_at);
  });
});

describe('sync application', () => {
  it('applies changes without marking dirty', async () => {
    const { repo } = await newRepo();
    await repo.applyChanges({
      pets: rows(pet('p-1', 'Miko')),
    });
    expect(await repo.getDirtyRows()).toEqual([]);
    const pets = await repo.allPets();
    expect(pets).toHaveLength(1);
    expect(pets[0].name).toBe('Miko');
  });

  it('last-write-wins keeps the newer row', async () => {
    const { repo } = await newRepo();
    await repo.applyChanges({
      pets: rows(pet('p-1', 'Miko', { updated_at: '2026-08-02T00:00:00.000Z' })),
    });
    await repo.applyChanges({
      pets: rows(pet('p-1', 'STALE', { updated_at: '2026-08-01T00:00:00.000Z' })),
    });
    const pets = await repo.allPets();
    expect(pets[0].name).toBe('Miko');
  });

  it('tracks the cursor', async () => {
    const { repo } = await newRepo();
    expect(await repo.getCursor()).toBeNull();
    await repo.setCursor('2026-08-02T00:00:00.000Z');
    expect(await repo.getCursor()).toBe('2026-08-02T00:00:00.000Z');
  });
});

describe('events (journal stream)', () => {
  it('lists events newest first and filters by kind and search', async () => {
    const { repo } = await newRepo();
    await repo.applyChanges({
      pets: rows(pet('p-1', 'Miko')),
      events: rows(
        event('e-1', 'p-1', 'feed', '2026-08-01T07:00:00.000Z', { title: 'Breakfast', text: 'wet food' }),
        event('e-2', 'p-1', 'walk', '2026-08-01T08:00:00.000Z', { title: 'Morning walk' }),
        event('e-3', 'p-1', 'feed', '2026-08-01T18:00:00.000Z', { title: 'Dinner' })
      ),
    });

    const all = await repo.eventsForPet('p-1');
    expect(all.map((e) => e.id)).toEqual(['e-3', 'e-2', 'e-1']);

    const feeds = await repo.eventsForPet('p-1', { kinds: ['feed'] });
    expect(feeds.map((e) => e.id)).toEqual(['e-3', 'e-1']);

    const search = await repo.eventsForPet('p-1', { q: 'breakfast' });
    expect(search.map((e) => e.id)).toEqual(['e-1']);

    const limited = await repo.eventsForPet('p-1', { limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it('eventsSince returns only events at or after the instant', async () => {
    const { repo } = await newRepo();
    await repo.applyChanges({
      events: rows(
        event('e-1', 'p-1', 'feed', '2026-08-01T07:00:00.000Z'),
        event('e-2', 'p-1', 'feed', '2026-08-01T18:00:00.000Z')
      ),
    });
    const today = await repo.eventsSince('p-1', '2026-08-01T12:00:00.000Z');
    expect(today.map((e) => e.id)).toEqual(['e-2']);
  });

  it('favorites roundtrip and join pet names across pets', async () => {
    const { repo } = await newRepo();
    await repo.applyChanges({
      pets: rows(pet('p-1', 'Miko'), pet('p-2', 'Bella')),
      events: rows(event('e-1', 'p-1', 'milestone', '2026-08-01T07:00:00.000Z')),
    });
    await repo.setFavorite('e-1', true);
    const favs = await repo.favoritesForPet('p-1');
    expect(favs.map((e) => e.id)).toEqual(['e-1']);

    const all = await repo.allEvents();
    expect(all[0].pet_name).toBe('Miko');

    const dirty = await repo.getDirtyRows();
    expect(dirty.some((d) => d.table === 'events' && d.row.id === 'e-1')).toBe(true);
  });
});

describe('photos', () => {
  it('tracks pending uploads, cache state, and missing photos', async () => {
    const { repo } = await newRepo();
    await repo.applyChanges({
      events: rows(event('e-1', 'p-1', 'photo', '2026-08-01T07:00:00.000Z')),
      photos: rows(
        { id: 'ph-1', event_id: 'e-1', taken_at: null, content_type: 'image/jpeg', created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z', deleted_at: null },
        { id: 'ph-2', event_id: 'e-1', taken_at: null, content_type: 'image/jpeg', created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z', deleted_at: null }
      ),
    });
    await repo.addPendingPhoto('ph-1', 'file:///a.jpg');
    expect(await repo.getPendingPhotos()).toEqual([{ id: 'ph-1', localUri: 'file:///a.jpg' }]);
    await repo.markPhotoCached('ph-1');
    expect(await repo.getPendingPhotos()).toEqual([]);
    await repo.savePhotoFile('ph-2', 'file:///b.jpg');
    expect(await repo.getMissingPhotos()).toEqual([]);

    const photos = await repo.photosForPet('p-1');
    expect(photos).toHaveLength(2);
    expect(photos.find((p) => p.id === 'ph-1')?.local_uri).toBe('file:///a.jpg');
  });
});

describe('reminder rules', () => {
  it('lists rules with pet names, scoped and global', async () => {
    const { repo } = await newRepo();
    await repo.applyChanges({
      pets: rows(pet('p-1', 'Miko')),
      reminder_rules: rows({
        id: 'r-1', pet_id: 'p-1', title: 'Rabies booster', kind: 'vaccine', due: '2026-09-01T00:00:00.000Z', repeat: 'yearly', dose: null, note: null, created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z', deleted_at: null,
      }),
    });
    const rules = await repo.rulesForPet('p-1');
    expect(rules).toHaveLength(1);
    expect(rules[0].title).toBe('Rabies booster');
    const all = await repo.allRules();
    expect(all[0].pet_name).toBe('Miko');
  });
});

describe('soft delete', () => {
  it('tombstones a row and keeps it for sync', async () => {
    const { repo } = await newRepo();
    await repo.upsertLocal('events', event('e-1', 'p-1', 'feed', '2026-08-01T07:00:00.000Z'));
    await repo.softDelete('events', 'e-1');
    const all = await repo.allEvents();
    expect(all).toEqual([]);
    const dirty = await repo.getDirtyRows();
    const d = dirty.find((x) => x.table === 'events' && x.row.id === 'e-1');
    expect(d).toBeDefined();
    expect(d?.row.deleted_at).not.toBeNull();
  });

  it('deletePetCascade tombstones pet, events, photos, and rules', async () => {
    const { repo } = await newRepo();
    await repo.upsertLocal('pets', pet('p-1', 'Miko'));
    await repo.upsertLocal('events', event('e-1', 'p-1', 'photo', '2026-08-01T07:00:00.000Z'));
    await repo.upsertLocal('photos', {
      id: 'ph-1', event_id: 'e-1', taken_at: null, content_type: 'image/jpeg',
      created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z', deleted_at: null,
    });
    await repo.upsertLocal('reminder_rules', {
      id: 'r-1', pet_id: 'p-1', title: 'Vaccine', kind: 'vaccine', due: '2026-09-01T00:00:00.000Z', repeat: 'once', dose: null, note: null,
      created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z', deleted_at: null,
    });
    await repo.addPendingPhoto('ph-1', 'file:///a.jpg');

    await repo.deletePetCascade('p-1');

    expect(await repo.allPets()).toEqual([]);
    expect(await repo.allEvents()).toEqual([]);
    expect(await repo.photosForPet('p-1')).toEqual([]);
    expect(await repo.allRules()).toEqual([]);
    // Photo cache entry must be dropped with the tombstone.
    expect(await repo.getPendingPhotos()).toEqual([]);

    const dirty = await repo.getDirtyRows();
    const ids = dirty.map((d) => `${d.table}:${d.row.id}`).sort();
    expect(ids).toEqual(['events:e-1', 'pets:p-1', 'photos:ph-1', 'reminder_rules:r-1']);
  });
});

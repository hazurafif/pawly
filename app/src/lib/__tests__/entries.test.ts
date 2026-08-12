import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrate } from '../../db/schema';
import { openTestDb } from '../../db/testDb';
import { Repository } from '../../db/repository';
import type { Db, Pet } from '../../db/types';
import { logEvent, logPhoto, newEventRow, petAgeLabel } from '../entries';

const mocks = vi.hoisted(() => {
  let n = 0;
  return { randomUUID: vi.fn(() => `uuid-${++n}`) };
});
vi.mock('expo-crypto', () => ({ randomUUID: mocks.randomUUID }));

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
    breed: null,
    microchip: null,
    allergies: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    deleted_at: null,
    ...extra,
  };
}

async function newRepo(): Promise<{ db: Db; repo: Repository }> {
  const db = await openTestDb();
  await migrate(db);
  return { db, repo: new Repository(db) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('newEventRow', () => {
  it('fills sync-safe defaults', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T00:00:00.000Z'));
    const row = newEventRow('p-1', 'feed');
    expect(row.pet_id).toBe('p-1');
    expect(row.kind).toBe('feed');
    expect(row.occurred_at).toBe('2026-08-08T00:00:00.000Z');
    expect(row.title).toBeNull();
    expect(row.text).toBeNull();
    expect(row.next_due_at).toBeNull();
    expect(row.data).toBeNull();
    expect(row.favorite).toBe(0);
    expect(row.created_at).toBe('2026-08-08T00:00:00.000Z');
    expect(row.updated_at).toBe('2026-08-08T00:00:00.000Z');
    expect(row.deleted_at).toBeNull();
  });

  it('applies field overrides and stores data as JSON', () => {
    const row = newEventRow('p-1', 'weight', {
      title: 'Weigh-in',
      occurredAt: '2026-08-01T07:00:00.000Z',
      nextDueAt: '2026-09-01T00:00:00.000Z',
      data: { kg: 4.3 },
    });
    expect(row.title).toBe('Weigh-in');
    expect(row.occurred_at).toBe('2026-08-01T07:00:00.000Z');
    expect(row.next_due_at).toBe('2026-09-01T00:00:00.000Z');
    expect(JSON.parse(row.data ?? '')).toEqual({ kg: 4.3 });
  });

  it('generates a unique id per row', () => {
    expect(newEventRow('p-1', 'feed').id).not.toBe(newEventRow('p-1', 'feed').id);
  });
});

describe('petAgeLabel', () => {
  it('renders years and months', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T00:00:00.000Z'));
    expect(petAgeLabel(pet('p-1', 'Miko', { birth_date: '2024-03-15T00:00:00.000Z' }))).toBe('2y 4m');
  });

  it('renders whole years and whole months', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T00:00:00.000Z'));
    expect(petAgeLabel(pet('p-1', 'Miko', { birth_date: '2024-08-08T00:00:00.000Z' }))).toBe('2y');
    expect(petAgeLabel(pet('p-1', 'Miko', { birth_date: '2026-07-01T00:00:00.000Z' }))).toBe('1m');
  });

  it('returns null when birth date is missing or invalid', () => {
    expect(petAgeLabel(pet('p-1', 'Miko'))).toBeNull();
    expect(petAgeLabel(pet('p-1', 'Miko', { birth_date: 'garbage' }))).toBeNull();
  });
});

describe('logEvent', () => {
  it('writes the event, dirty-marks it, and returns the row', async () => {
    const { db, repo } = await newRepo();
    const row = await logEvent(repo, 'p-1', 'feed', {
      title: 'Breakfast',
      text: 'Ate it all',
      data: { grams: 50 },
    });
    expect(row.kind).toBe('feed');
    const [stored] = await db.all(`SELECT * FROM events WHERE id = ?`, [row.id]);
    expect(stored.pet_id).toBe('p-1');
    expect(stored.title).toBe('Breakfast');
    expect(stored.data).toBe(JSON.stringify({ grams: 50 }));
    const dirty = await repo.getDirtyRows();
    expect(dirty.some((d) => d.table === 'events' && d.row.id === row.id)).toBe(true);
  });
});

describe('logPhoto', () => {
  it('creates the photo event, the photo row, and registers the upload', async () => {
    const { db, repo } = await newRepo();
    const { eventId, photoId } = await logPhoto(repo, 'p-1', {
      uri: 'file:///tmp/photo.jpg',
      takenAt: '2026-08-01T07:00:00.000Z',
      note: 'Bath day',
    });
    expect(eventId).not.toBe(photoId);
    const [ev] = await db.all(`SELECT * FROM events WHERE id = ?`, [eventId]);
    expect(ev.kind).toBe('photo');
    expect(ev.title).toBe('Bath day');
    const [ph] = await db.all(`SELECT * FROM photos WHERE id = ?`, [photoId]);
    expect(ph.event_id).toBe(eventId);
    expect(ph.taken_at).toBe('2026-08-01T07:00:00.000Z');
    expect(ph.content_type).toBe('image/jpeg');
    expect(await repo.getPendingPhotos()).toEqual([{ id: photoId, localUri: 'file:///tmp/photo.jpg' }]);
    const dirty = await repo.getDirtyRows();
    expect(dirty.map((d) => `${d.table}:${d.row.id}`)).toContain(`events:${eventId}`);
    expect(dirty.map((d) => `${d.table}:${d.row.id}`)).toContain(`photos:${photoId}`);
  });
});

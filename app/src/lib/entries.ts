import type { Event, Pet } from '../db/types';
import type { Repository } from '../db/repository';
import { newId } from './id';
import { toIsoMs } from './format';

export interface EventFields {
  title?: string | null;
  text?: string | null;
  occurredAt?: string;
  data?: Record<string, unknown> | null;
  nextDueAt?: string | null;
}

// Builds a full, sync-ready event row. `data` is stored as JSON.
export function newEventRow(
  petId: string,
  kind: string,
  fields: EventFields = {}
): Event {
  const now = toIsoMs(new Date());
  return {
    id: newId(),
    pet_id: petId,
    kind,
    title: fields.title ?? null,
    text: fields.text ?? null,
    occurred_at: fields.occurredAt ?? now,
    next_due_at: fields.nextDueAt ?? null,
    data: fields.data ? JSON.stringify(fields.data) : null,
    favorite: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

// Logs an event locally (dirty-marked for sync) and returns its row.
export async function logEvent(
  repo: Repository,
  petId: string,
  kind: string,
  fields: EventFields = {}
): Promise<Event> {
  const row = newEventRow(petId, kind, fields);
  await repo.upsertLocal('events', row);
  return row;
}

// Creates a photo event plus its photo row, and registers the local file
// for upload. Returns the photo id.
export async function logPhoto(
  repo: Repository,
  petId: string,
  fields: { uri: string; takenAt?: string; note?: string }
): Promise<{ eventId: string; photoId: string }> {
  const now = toIsoMs(new Date());
  const eventRow: Event = {
    id: newId(),
    pet_id: petId,
    kind: 'photo',
    title: fields.note ?? null,
    text: null,
    occurred_at: fields.takenAt ?? now,
    next_due_at: null,
    data: null,
    favorite: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  const photoId = newId();
  await repo.upsertLocal('events', eventRow);
  await repo.upsertLocal('photos', {
    id: photoId,
    event_id: eventRow.id,
    taken_at: fields.takenAt ?? now,
    content_type: 'image/jpeg',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  await repo.addPendingPhoto(photoId, fields.uri);
  return { eventId: eventRow.id, photoId };
}

// Attaches a photo to an EXISTING event (visit, vaccine, med, symptom...)
// without creating a photo event of its own. The photo row links straight
// to the event and syncs through the same pending/cache pipeline.
export async function attachPhotoToEvent(
  repo: Repository,
  petId: string,
  eventId: string,
  fields: { uri: string; takenAt?: string }
): Promise<{ photoId: string }> {
  const now = toIsoMs(new Date());
  const photoId = newId();
  await repo.upsertLocal('photos', {
    id: photoId,
    event_id: eventId,
    taken_at: fields.takenAt ?? now,
    content_type: 'image/jpeg',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  await repo.addPendingPhoto(photoId, fields.uri);
  return { photoId };
}

export function petAgeLabel(pet: Pet): string | null {
  if (!pet.birth_date) {
    return null;
  }
  const d = new Date(pet.birth_date);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    months = 0;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years > 0 && rem > 0) {
    return `${years}y ${rem}m`;
  }
  if (years > 0) {
    return `${years}y`;
  }
  return `${rem}m`;
}

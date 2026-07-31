import type { Changes, Row, TableName } from '../db/types';

export type PullResponse = {
  // RFC3339 UTC, millisecond precision (e.g. 2026-07-05T00:00:00.000Z) — lexicographic order == chronological order. Mixed formats would corrupt LWW and cursor comparisons.
  server_time: string;
  changes: Changes;
};

export interface SyncStore {
  getCursor(): Promise<string | null>;
  setCursor(cursor: string): Promise<void>;
  getDirtyRows(): Promise<{ table: TableName; row: Row & { id: string } }[]>;
  clearDirty(ids: { table: TableName; id: string; updatedAt: string }[]): Promise<void>;
  applyChanges(changes: Changes): Promise<{ maxUpdatedAt: string | null }>;
  getPendingPhotos(): Promise<{ id: string; localUri: string }[]>;
  markPhotoCached(id: string): Promise<void>;
  getMissingPhotos(): Promise<string[]>;
  savePhotoFile(id: string, localUri: string): Promise<void>;
}

export interface SyncTransport {
  pull(since: string | null): Promise<PullResponse>;
  push(changes: Changes): Promise<void>;
  putPhoto(id: string, localUri: string): Promise<void>;
  getPhoto(id: string): Promise<string>;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
}

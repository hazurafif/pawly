import type { Changes, Row, TableName } from '../db/types';

export type PullResponse = {
  server_time: string;
  changes: Changes;
};

export interface SyncStore {
  getCursor(): Promise<string | null>;
  setCursor(cursor: string): Promise<void>;
  getDirtyRows(): Promise<{ table: TableName; row: Row }[]>;
  clearDirty(ids: { table: TableName; id: string }[]): Promise<void>;
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

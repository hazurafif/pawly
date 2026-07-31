import type { Changes, Row, TableName } from '../db/types';
import type { PullResponse, SyncResult, SyncStore, SyncTransport } from './types';

export type { PullResponse, SyncResult, SyncStore, SyncTransport };

// Orchestrates one sync pass: push dirty rows → upload pending photos →
// pull changes → download missing photos. Pure orchestration with no I/O
// of its own; all effects go through the injected store and transport.
export class SyncClient {
  constructor(
    private readonly store: SyncStore,
    private readonly transport: SyncTransport
  ) {}

  async sync(): Promise<SyncResult> {
    const pushed = await this.pushDirty();
    await this.uploadPhotos();
    const pulled = await this.pull();
    await this.downloadPhotos();
    return { pushed, pulled };
  }

  private async pushDirty(): Promise<number> {
    const dirty = await this.store.getDirtyRows();
    if (dirty.length === 0) {
      return 0;
    }
    const changes: Changes = {
      cats: [], moments: [], purchases: [], reminders: [], reminder_completions: [], photos: [],
    };
    for (const d of dirty) {
      changes[d.table].push(d.row);
    }
    await this.transport.push(changes); // throws → caller keeps dirty rows
    await this.store.clearDirty(dirty.map((d) => ({ table: d.table, id: d.row.id })));
    return dirty.length;
  }

  private async uploadPhotos(): Promise<void> {
    for (const p of await this.store.getPendingPhotos()) {
      try {
        await this.transport.putPhoto(p.id, p.localUri);
        await this.store.markPhotoCached(p.id);
      } catch {
        // keep pending; retried next sync
      }
    }
  }

  private async pull(): Promise<number> {
    const cursor = await this.store.getCursor();
    const resp: PullResponse = await this.transport.pull(cursor);
    const { maxUpdatedAt } = await this.store.applyChanges(resp.changes);

    let next = resp.server_time;
    if (maxUpdatedAt && maxUpdatedAt > next) {
      next = maxUpdatedAt;
    }
    if (cursor && cursor > next) {
      next = cursor;
    }
    await this.store.setCursor(next);

    let count = 0;
    for (const rows of Object.values(resp.changes)) {
      count += rows.length;
    }
    return count;
  }

  private async downloadPhotos(): Promise<void> {
    for (const id of await this.store.getMissingPhotos()) {
      try {
        const localUri = await this.transport.getPhoto(id);
        await this.store.savePhotoFile(id, localUri);
      } catch {
        // keep missing; retried next sync
      }
    }
  }
}

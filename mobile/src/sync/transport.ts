import type { Changes } from '../db/types';
import type { PullResponse } from './types';

export interface TransportDeps {
  baseUrl: string;
  fetch: typeof fetch;
  // In the app: expo-file-system's File(path).blob(); in tests: node Blob.
  fileToBlob?: (uri: string) => Promise<Blob>;
  // In the app: new File(uri).write(data); in tests: node fs write.
  saveBytes?: (uri: string, data: Uint8Array) => Promise<void>;
}

// HTTP implementation of SyncTransport against the Pawly Go server.
export class HttpTransport {
  private readonly deps: Required<TransportDeps>;

  constructor(deps: TransportDeps) {
    this.deps = {
      fileToBlob: async () => {
        throw new Error('fileToBlob not configured');
      },
      saveBytes: async () => {
        throw new Error('saveBytes not configured');
      },
      ...deps,
    };
  }

  private base(path: string): string {
    return this.deps.baseUrl.replace(/\/+$/, '') + path;
  }

  private async check(res: Response, what: string): Promise<Response> {
    if (!res.ok) {
      throw new Error(`${what} failed: HTTP ${res.status}`);
    }
    return res;
  }

  async pull(since: string | null): Promise<PullResponse> {
    const url = since ? this.base(`/sync/pull?since=${encodeURIComponent(since)}`) : this.base('/sync/pull');
    const res = await this.check(await this.deps.fetch(url), 'pull');
    return (await res.json()) as PullResponse;
  }

  async push(changes: Changes): Promise<void> {
    const res = await this.check(
      await this.deps.fetch(this.base('/sync/push'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      }),
      'push'
    );
    const body = (await res.json()) as { status?: string };
    if (body.status !== 'ok') {
      throw new Error(`push rejected: ${JSON.stringify(body)}`);
    }
  }

  async putPhoto(id: string, localUri: string): Promise<void> {
    const blob = await this.deps.fileToBlob(localUri);
    const res = await this.check(
      await this.deps.fetch(this.base(`/photos/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      }),
      'photo upload'
    );
    void res;
  }

  async getPhoto(id: string): Promise<string> {
    const res = await this.check(
      await this.deps.fetch(this.base(`/photos/${encodeURIComponent(id)}`)),
      'photo download'
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    const uri = `file:///cache/photos/${id}`;
    await this.deps.saveBytes(uri, bytes);
    return uri;
  }
}

import type { Changes } from '../db/types';
import type { PullResponse } from './types';

export interface TransportDeps {
  baseUrl: string;
  fetch: typeof fetch;
  timeoutMs?: number;
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
      timeoutMs: 15000,
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

  // A hung server must fail a sync pass, never stall it (the engine's
  // status depends on this). Combines the timeout with any caller signal.
  private async fetchWithTimeout(url: string | URL, init?: RequestInit): Promise<Response> {
    const { signal } = init ?? {};
    const timeout = AbortSignal.timeout(this.deps.timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    return this.deps.fetch(url, { ...init, signal: combined });
  }

  private async check(res: Response, what: string): Promise<Response> {
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`${what} failed: HTTP ${res.status}${detail ? ' ' + detail.slice(0, 200) : ''}`);
    }
    return res;
  }

  async pull(since: string | null): Promise<PullResponse> {
    const url = since ? this.base(`/sync/pull?since=${encodeURIComponent(since)}`) : this.base('/sync/pull');
    const res = await this.check(await this.fetchWithTimeout(url), 'pull');
    return (await res.json()) as PullResponse;
  }

  async push(changes: Changes): Promise<void> {
    const res = await this.check(
      await this.fetchWithTimeout(this.base('/sync/push'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      }),
      'push'
    );
    const body = (await res.json()) as { status?: string };
    if (body.status !== 'ok') {
      throw new Error(`push rejected: ${JSON.stringify(body).slice(0, 200)}`);
    }
  }

  async putPhoto(id: string, localUri: string): Promise<void> {
    const blob = await this.deps.fileToBlob(localUri);
    const res = await this.check(
      await this.fetchWithTimeout(this.base(`/photos/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: { 'Content-Type': blob.type || 'image/jpeg' },
        body: blob,
      }),
      'photo upload'
    );
    void res;
  }

  async getPhoto(id: string): Promise<string> {
    const res = await this.check(
      await this.fetchWithTimeout(this.base(`/photos/${encodeURIComponent(id)}`)),
      'photo download'
    );
    const bytes = new Uint8Array(await res.arrayBuffer());
    const uri = `file:///cache/photos/${id}`;
    await this.deps.saveBytes(uri, bytes);
    return uri;
  }
}

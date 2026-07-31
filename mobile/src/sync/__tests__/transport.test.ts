import { describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Changes } from '../../db/types';
import { HttpTransport } from '../transport';

const emptyChanges: Changes = {
  cats: [], moments: [], purchases: [], reminders: [], reminder_completions: [], photos: [],
};

function nodeFetchBase(base: string): typeof fetch {
  const impl = async (input: any, init?: any) => {
    const url = typeof input === 'string' ? new URL(input, base) : input;
    const headers = new Headers(init?.headers);
    const body =
      init?.body instanceof Blob
        ? Buffer.from(await init.body.arrayBuffer())
        : (init?.body as BodyInit | undefined);
    return fetch(url.toString(), { ...init, body, headers });
  };
  return impl as typeof fetch;
}

function startMockServer(opts: { pushRejects?: boolean } = {}) {
  const calls: { url: string; method: string }[] = [];
  const server = createServer((req, res) => {
    calls.push({ url: req.url ?? '', method: req.method ?? '' });
    if (req.method === 'POST' && req.url === '/sync/push') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(opts.pushRejects ? { status: 'error', error: 'boom' } : { status: 'ok', applied: 1 }));
      });
      return;
    }
    if (req.method === 'GET' && req.url?.startsWith('/sync/pull')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ server_time: '2026-07-05T00:00:00.000Z', changes: {} }));
      return;
    }
    if (req.method === 'PUT' && req.url?.startsWith('/photos/')) {
      let size = 0;
      req.on('data', (c) => (size += c.length));
      req.on('end', () => {
        res.statusCode = size > 0 ? 204 : 400;
        res.end();
      });
      return;
    }
    if (req.method === 'GET' && req.url?.startsWith('/photos/')) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.end(Buffer.from('JPEGDATA'));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  return new Promise<{ base: string; calls: typeof calls; close: () => void }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        base: `http://127.0.0.1:${port}`,
        calls,
        close: () => server.close(),
      });
    });
  });
}

describe('HttpTransport', () => {
  it('pull sends since param and parses the response', async () => {
    const srv = await startMockServer();
    try {
      const t = new HttpTransport({ baseUrl: srv.base, fetch: nodeFetchBase(srv.base) });
      const resp = await t.pull('2026-07-01T00:00:00.000Z');
      expect(resp.server_time).toBe('2026-07-05T00:00:00.000Z');
      expect(srv.calls[0].url).toBe('/sync/pull?since=2026-07-01T00%3A00%3A00.000Z');
    } finally {
      srv.close();
    }
  });

  it('pull with null since omits the param', async () => {
    const srv = await startMockServer();
    try {
      const t = new HttpTransport({ baseUrl: srv.base, fetch: nodeFetchBase(srv.base) });
      await t.pull(null);
      expect(srv.calls[0].url).toBe('/sync/pull');
    } finally {
      srv.close();
    }
  });

  it('push posts changes as JSON', async () => {
    const srv = await startMockServer();
    try {
      const t = new HttpTransport({ baseUrl: srv.base, fetch: nodeFetchBase(srv.base) });
      await t.push(emptyChanges);
      expect(srv.calls[0].method).toBe('POST');
    } finally {
      srv.close();
    }
  });

  it('push rejects when the server responds with a non-ok status', async () => {
    const srv = await startMockServer({ pushRejects: true });
    try {
      const t = new HttpTransport({ baseUrl: srv.base, fetch: nodeFetchBase(srv.base) });
      await expect(t.push(emptyChanges)).rejects.toThrow('push rejected');
    } finally {
      srv.close();
    }
  });

  it('putPhoto sends the file bytes and succeeds on 204', async () => {
    const srv = await startMockServer();
    try {
      const t = new HttpTransport({
        baseUrl: srv.base,
        fetch: nodeFetchBase(srv.base),
        fileToBlob: async () => new Blob([Buffer.from('JPEGBYTES')], { type: 'image/jpeg' }),
      });
      await t.putPhoto('ph1', 'file:///unused-in-test.jpg');
      expect(srv.calls[0].method).toBe('PUT');
    } finally {
      srv.close();
    }
  });

  it('putPhoto rejects when the server rejects (no row)', async () => {
    const srv = await startMockServer();
    try {
      const t = new HttpTransport({
        baseUrl: srv.base,
        fetch: nodeFetchBase(srv.base),
        fileToBlob: async () => new Blob([]),
      });
      await expect(t.putPhoto('ghost', 'file:///x.jpg')).rejects.toThrow();
    } finally {
      srv.close();
    }
  });

  it('getPhoto saves bytes to the local filesystem', async () => {
    const srv = await startMockServer();
    try {
      const saved: { uri: string; data: Uint8Array }[] = [];
      const t = new HttpTransport({
        baseUrl: srv.base,
        fetch: nodeFetchBase(srv.base),
        saveBytes: async (uri, data) => {
          saved.push({ uri, data });
        },
      });
      const uri = await t.getPhoto('ph1');
      expect(uri).toBe('file:///cache/photos/ph1');
      expect(new TextDecoder().decode(saved[0].data)).toBe('JPEGDATA');
    } finally {
      srv.close();
    }
  });

  it('surfaces non-2xx responses as errors', async () => {
    const srv = await startMockServer();
    try {
      const t = new HttpTransport({ baseUrl: srv.base + '/wrong-base', fetch: nodeFetchBase(srv.base) });
      await expect(t.pull(null)).rejects.toThrow();
    } finally {
      srv.close();
    }
  });

  it('aborts requests after the timeout', async () => {
    let aborted = false;
    const never = new Promise<Response>((resolve) => {
      const check = setInterval(() => {
        if (aborted) {
          clearInterval(check);
          resolve(new Response(null, { status: 200 }));
        }
      }, 5);
    });
    const fetchStub = async (_input: any, init?: any) => {
      init.signal.addEventListener('abort', () => {
        aborted = true;
      });
      return never;
    };
    const t = new HttpTransport({ baseUrl: 'http://x', fetch: fetchStub as typeof fetch, timeoutMs: 30 });
    await expect(t.pull(null)).rejects.toThrow();
    expect(aborted).toBe(true);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from '../../db/repository';
import { migrate } from '../../db/schema';
import { openTestDb } from '../../db/testDb';
import { HttpTransport } from '../transport';
import { SyncClient } from '../client';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..'); // mobile/../.. = repo root
const SERVER_BINARY = '/tmp/pawly-e2e';
const CACHE_DIR = join(tmpdir(), 'pawly-e2e-cache');

// The transport used by the app in production: node fetch + node Blob +
// node fs writes. Runs against the REAL Go server binary. IMPORTANT: all
// fixture timestamps are future-dated (2030) so the server's stale-clock
// clamp never fires and LWW is tested purely.
const e2eDeps = (baseUrl: string) => ({
  baseUrl,
  fetch: fetch as typeof fetch,
  fileToBlob: async (uri: string) => new Blob([readFileSync(uri.replace('file://', ''))], { type: 'image/jpeg' }),
  saveBytes: async (uri: string, data: Uint8Array) => {
    // HttpTransport.getPhoto writes to file:///cache/photos/<id>; map that
    // to a writable temp dir in the Node test environment.
    const path = uri.replace('file:///cache/photos', CACHE_DIR);
    writeFileSync(path, data);
  },
});

describe('E2E: mobile sync client against the real Pawly Go server', () => {
  let server: ChildProcess;
  let baseUrl: string;
  let dataDir: string;
  let port: number;

  beforeAll(async () => {
    if (!existsSync(SERVER_BINARY)) {
      throw new Error(
        `Missing ${SERVER_BINARY}. Run: cd ${join(REPO_ROOT, 'server')} && go build -o ${SERVER_BINARY} ./cmd/pawly`
      );
    }
    mkdirSync(CACHE_DIR, { recursive: true }); // saveBytes writes into it
    port = 18090 + Math.floor(Math.random() * 100);
    dataDir = mkdtempSync(join(tmpdir(), 'pawly-e2e-'));
    baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(SERVER_BINARY, ['-port', String(port), '-data-dir', dataDir], {
      stdio: 'ignore',
    });
    // wait for healthz
    for (let i = 0; i < 50; i++) {
      try {
        execSync(`curl -sf ${baseUrl}/healthz`, { stdio: 'ignore' });
        return;
      } catch {
        // server not up yet
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('Go server did not become healthy');
  });

  afterAll(() => {
    server?.kill();
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(CACHE_DIR, { recursive: true, force: true });
  });

  it('full sync round trip: two devices converge through the real server', async () => {
    // --- device A ---
    const dbA = await openTestDb();
    await migrate(dbA);
    const repoA = new Repository(dbA);
    const clientA = new SyncClient(repoA, new HttpTransport(e2eDeps(baseUrl)));

    // A creates a cat offline and syncs it up. (2030 dates: the server
    // clamps stale timestamps to its own clock, which would interfere.)
    await repoA.upsertLocal('cats', {
      id: 'cat-1', name: 'Miko', sex: 'male', status: 'alive',
      birth_date_is_estimated: 0, rescue_date_is_estimated: 0, is_neutered: 'unknown',
      created_at: '2030-07-01T00:00:00.000Z', updated_at: '2030-07-01T00:00:00.000Z',
    });
    await clientA.sync();

    // --- device B: fresh install pulls everything ---
    const dbB = await openTestDb();
    await migrate(dbB);
    const repoB = new Repository(dbB);
    const clientB = new SyncClient(repoB, new HttpTransport(e2eDeps(baseUrl)));
    await clientB.sync();
    expect((await repoB.allCats()).map((c) => c.name)).toContain('Miko');

    // --- B edits the cat and adds a purchase, syncs ---
    await repoB.upsertLocal('cats', {
      id: 'cat-1', name: 'Miko (Bella)', sex: 'male', status: 'alive',
      birth_date_is_estimated: 0, rescue_date_is_estimated: 0, is_neutered: 'unknown',
      created_at: '2030-07-01T00:00:00.000Z', updated_at: '2030-07-02T00:00:00.000Z',
    });
    await repoB.upsertLocal('purchases', {
      id: 'p-1', item: 'Whiskas 1.2kg', price: 65000, category: 'food', date: '2030-07-28',
      created_at: '2030-07-28T00:00:00.000Z', updated_at: '2030-07-28T00:00:00.000Z',
    });
    await clientB.sync();

    // --- A pulls and must converge ---
    await clientA.sync();
    const catsA = await repoA.allCats();
    expect(catsA).toHaveLength(1);
    expect(catsA[0].name).toBe('Miko (Bella)');

    // --- photo flow: A adds a photo row + local file, syncs; B downloads it ---
    await repoA.upsertLocal('photos', {
      id: 'ph-1', taken_at: '2030-07-20T00:00:00.000Z', content_type: 'image/jpeg',
      created_at: '2030-07-20T00:00:00.000Z', updated_at: '2030-07-20T00:00:00.000Z',
    });
    const photoFile = join(tmpdir(), 'pawly-e2e-photo.jpg');
    writeFileSync(photoFile, Buffer.from('E2EPHOTO'));
    await repoA.addPendingPhoto('ph-1', `file://${photoFile}`);
    await clientA.sync();

    await clientB.sync();
    const missingB = await repoB.getMissingPhotos();
    expect(missingB).not.toContain('ph-1');

    // cleanup the temp photo
    rmSync(photoFile, { force: true });
  });
});

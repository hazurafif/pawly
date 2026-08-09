import { execSync } from 'node:child_process';
import path from 'node:path';
import { test as base } from '@playwright/test';

const root = path.resolve(__dirname, '../..');
const compose = ['docker-compose.yml', 'docker-compose.test.yml']
  .map((f) => `-f ${path.join(root, f)}`)
  .join(' ');

// The backend persists synced rows in its data dir, and the app auto-syncs
// on mount — without a wipe, tests would contaminate each other. The test
// override mounts a tmpfs data dir; recreating the container resets it.
// The sync's pull would otherwise hang against the restarting server and
// block repository writes behind its transaction mutex.
function resetBackend(): void {
  for (let attempt = 0; attempt < 3; attempt++) {
    execSync(`podman compose ${compose} up -d --force-recreate backend`, {
      cwd: root,
      stdio: 'pipe',
      timeout: 90_000,
    });
    waitForHealth();
    // The tmpfs wipe must actually have happened: if the server still holds
    // rows from a previous test, the app's sync pull would contaminate this
    // test. (Repeated force-recreates occasionally race podman's volume
    // teardown, leaving stale data.)
    try {
      const out = execSync(
        `curl -sf -m 3 'http://localhost:8083/sync/pull'`,
        { stdio: 'pipe', encoding: 'utf8' }
      );
      const changes = JSON.parse(out).changes ?? {};
      const total = Object.values(changes).reduce((n: number, rows: unknown) => n + (rows as unknown[]).length, 0);
      if (total === 0) {
        return;
      }
    } catch {
      // pull failed — treat as not ready, retry the whole reset
    }
  }
  throw new Error('backend did not reset to an empty state');
}

function waitForHealth(): void {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = execSync('curl -sf -m 2 http://localhost:8083/healthz', { stdio: 'pipe' });
      if (res.toString().includes('ok')) {
        return;
      }
    } catch {
      // backend still coming up
    }
    execSync('sleep 0.5');
  }
  throw new Error('backend did not become healthy after reset');
}

export const test = base.extend<{ resetBackend: void }>({
  resetBackend: [
    async ({}, use) => {
      resetBackend();
      await use();
    },
    { auto: true },
  ],
});
export { expect } from '@playwright/test';

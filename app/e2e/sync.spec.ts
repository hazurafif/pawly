import { expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';
import { createPet, setEnglish } from './helpers';

async function serverHasPet(request: APIRequestContext, name: string): Promise<boolean> {
  const res = await request.get('http://localhost:8080/sync/pull');
  if (!res.ok()) {
    return false;
  }
  const body = (await res.json()) as {
    changes?: { pets?: { name?: string }[] };
  };
  return (body.changes?.pets ?? []).some((p) => p.name === name);
}

test('pushes local writes to the backend via sync', async ({ page, request }) => {
  await setEnglish(page);
  await createPet(page, 'SyncPet');

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sync now', exact: true }).click();
  await expect(page.getByText(/Last synced:/)).toBeVisible();

  await expect.poll(() => serverHasPet(request, 'SyncPet'), { timeout: 10_000 }).toBe(true);
});

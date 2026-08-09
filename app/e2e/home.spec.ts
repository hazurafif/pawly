import { expect, test } from './fixtures';
import { createPet, setEnglish } from './helpers';

test.beforeEach(async ({ page }) => {
  await setEnglish(page);
  await createPet(page);
});

test('tapping a checklist item quick-logs that care kind', async ({ page }) => {
  await page.goto('/');

  const feeding = page.getByRole('button', { name: 'Feeding 0/2', exact: true });
  await expect(feeding).toBeVisible();
  await feeding.click();

  // The global toast confirms, with the item's counter bumped.
  await expect(page.getByText(/Logged .*· Feeding/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Feeding 1/2', exact: true })).toBeVisible();
});

test('undo restores the checklist after a mistaken tap', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Feeding 0/2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Feeding 1/2', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Feeding 0/2', exact: true })).toBeVisible();
});

test('completed checklist items are disabled', async ({ page }) => {
  await page.goto('/');

  // Two water logs fill the daily target (0/3 -> 2/3 stays enabled).
  await page.getByRole('button', { name: 'Walk 0/1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Walk 1/1', exact: true })).toBeVisible();

  // Target reached: the item is no longer pressable.
  await expect(page.getByRole('button', { name: 'Walk 1/1', exact: true })).toBeDisabled();
});

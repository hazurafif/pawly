import { expect, test } from './fixtures';
import { createPet, setEnglish } from './helpers';

// Every modal/stack screen must show a real, translated header title —
// not the route name ("entry-form") and not hardcoded English.

test.beforeEach(async ({ page }) => {
  await setEnglish(page);
  await createPet(page);
});

test('entry-form header shows Log something, then Edit entry when editing', async ({ page }) => {
  await page.goto('/journal');
  await page.getByRole('button', { name: 'Log something', exact: true }).click();
  await expect(page).toHaveURL(/entry-form/);
  await expect(page.getByRole('heading', { name: 'Log something', exact: true })).toBeVisible();

  await page.getByText('Water', { exact: true }).click();
  await page.getByLabel('Note').fill('Bowl topped up');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await page.getByRole('button', { name: 'Bowl topped up' }).click();
  await expect(page).toHaveURL(/entry-form\?id=/);
  await expect(page.getByRole('heading', { name: 'Edit entry', exact: true })).toBeVisible();
});

test('pet-form header shows Add your first pet, then Pet details when editing', async ({ page }) => {
  await page.goto('/pet-form');
  await expect(page.getByRole('heading', { name: 'Add your first pet', exact: true })).toBeVisible();
  // The old duplicate in-form heading is gone.
  await expect(page.getByRole('heading', { name: 'Add your first pet' })).toHaveCount(1);

  await page.goto('/settings');
  await page.getByText('Miko', { exact: true }).click();
  await expect(page).toHaveURL(/pet-form\?id=/);
  await expect(page.getByRole('heading', { name: 'Pet details', exact: true })).toBeVisible();
});

test('reminder-form, settings, and vet-report headers are translated', async ({ page }) => {
  await page.goto('/reminder-form');
  await expect(page.getByRole('heading', { name: 'Reminders', exact: true })).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

  await page.goto('/health');
  await page.getByRole('button', { name: 'Vet prep report', exact: true }).click();
  await expect(page).toHaveURL(/vet-report/);
  await expect(page.getByRole('heading', { name: 'Vet prep report', exact: true })).toBeVisible();
});

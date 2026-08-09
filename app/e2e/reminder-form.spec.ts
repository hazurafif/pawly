import { expect, test } from './fixtures';
import { createPet, setEnglish } from './helpers';

test.beforeEach(async ({ page }) => {
  await setEnglish(page);
  await createPet(page);
});

test('saving an empty reminder shows the title error', async ({ page }) => {
  await page.goto('/reminder-form');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();
  // No generic "Name is required" copy from the pet form leaks in.
  await expect(page.getByText('Name is required', { exact: true })).toHaveCount(0);
});

test('saving a reminder without a due date shows the date error', async ({ page }) => {
  await page.goto('/reminder-form');
  await page.getByLabel('Title').fill('Daily dewormer');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Enter the date as YYYY-MM-DD', { exact: true })).toBeVisible();
});

test('a valid reminder saves without errors', async ({ page }) => {
  await page.goto('/reminder-form');
  await page.getByLabel('Title').fill('Flea treatment');
  await page.getByLabel('Due date').fill('2026-08-20');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Title is required', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Enter the date as YYYY-MM-DD', { exact: true })).toHaveCount(0);
});

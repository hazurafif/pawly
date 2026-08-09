import { expect, test } from './fixtures';
import { createPet, setEnglish } from './helpers';

test.beforeEach(async ({ page }) => {
  await setEnglish(page);
  await createPet(page);
});

test('favorites appear in Memories', async ({ page }) => {
  await page.goto('/journal');
  await page.getByRole('button', { name: 'Add entry', exact: true }).click();
  await page.getByText('Photo', { exact: true }).click();
  await page.getByLabel('Note').fill('First beach trip');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await page.getByRole('button', { name: 'Favorite', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove favorite', exact: true })).toBeVisible();
  await page.goto('/memories');

  await expect(page.getByText('First beach trip', { exact: true })).toBeVisible();
});

test('unfavorited entries leave Memories', async ({ page }) => {
  await page.goto('/journal');
  await page.getByRole('button', { name: 'Add entry', exact: true }).click();
  await page.getByText('Milestone', { exact: true }).click();
  await page.getByLabel('Milestone').fill('Gotcha day!');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await page.getByRole('button', { name: 'Favorite', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove favorite', exact: true })).toBeVisible();
  await page.goto('/memories');
  await expect(page.getByText('Gotcha day!', { exact: true })).toBeVisible();

  await page.goto('/journal');
  await page.getByRole('button', { name: 'Remove favorite', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Favorite', exact: true })).toBeVisible();
  await page.goto('/memories');
  await expect(page.getByText('Gotcha day!', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Tap the heart on a journal entry to keep it here')).toBeVisible();
});

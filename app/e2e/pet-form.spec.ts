import { expect, test } from './fixtures';
import { createPet, setEnglish } from './helpers';

test('species, sex, and neutered chips translate to English', async ({ page }) => {
  await setEnglish(page);
  await page.goto('/pet-form');

  await expect(page.getByRole('button', { name: 'Cat', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dog', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Other', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Male', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Female', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yes', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'No', exact: true })).toBeVisible();
});

test('the same chips render in Indonesian under the id locale', async ({ page }) => {
  await page.goto('/settings');
  await page.getByText('Bahasa Indonesia', { exact: true }).click();
  await page.goto('/pet-form');

  await expect(page.getByRole('button', { name: 'Kucing', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anjing', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jantan', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Betina', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ya', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Belum', exact: true })).toBeVisible();
});

test('edit prefills the form and saves changes', async ({ page }) => {
  await setEnglish(page);
  await createPet(page);

  await page.goto('/settings');
  await page.getByText('Miko', { exact: true }).click();
  await expect(page).toHaveURL(/pet-form/);

  await expect(page.getByLabel('Name')).toHaveValue('Miko');
  await page.getByLabel('Name').fill('Miko Jr');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page).toHaveURL(/settings/);
  await expect(page.getByText('Miko Jr', { exact: true })).toBeVisible();
});

test('deleting a pet removes it everywhere', async ({ page }) => {
  await setEnglish(page);
  await createPet(page);

  page.on('dialog', (d) => void d.accept());
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click();

  await expect(page.getByText('Miko', { exact: true })).toHaveCount(0);
  await expect(page.getByText('No pets yet. Add your first one!')).toBeVisible();
});

test('birth and gotcha dates use a real date picker and persist', async ({ page }) => {
  await setEnglish(page);
  await createPet(page);

  await page.goto('/settings');
  await page.getByText('Miko', { exact: true }).click();
  await expect(page).toHaveURL(/pet-form/);

  // Date fields are real <input type="date"> controls on web, not free text.
  await expect(page.getByLabel('Birth date')).toHaveAttribute('type', 'date');
  await expect(page.getByLabel('Gotcha day')).toHaveAttribute('type', 'date');
  await page.getByLabel('Birth date').fill('2024-03-15');
  await page.getByLabel('Gotcha day').fill('2024-05-01');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/settings/);

  await page.getByText('Miko', { exact: true }).click();
  await expect(page.getByLabel('Birth date')).toHaveValue('2024-03-15');
  await expect(page.getByLabel('Gotcha day')).toHaveValue('2024-05-01');
});

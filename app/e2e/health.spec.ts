import { expect, test } from './fixtures';
import { addInSection, createPet, setEnglish } from './helpers';

test.beforeEach(async ({ page }) => {
  await setEnglish(page);
  await createPet(page);
});

test('adds a weight entry from Health with no kind grid', async ({ page }) => {
  await page.goto('/health');
  await addInSection(page, 'Weight');
  await expect(page).toHaveURL(/kind=weight/);

  // The kind is preselected by Health — no category grid.
  await expect(page.getByText('Feeding', { exact: true })).toHaveCount(0);

  await page.getByLabel('Weight (kg)').fill('4.2');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page).toHaveURL(/health/);
  await expect(page.getByText('4.2 kg', { exact: true })).toBeVisible();
});

test('adds a vaccine entry with dose', async ({ page }) => {
  await page.goto('/health');
  await addInSection(page, 'Vaccines');
  await expect(page).toHaveURL(/kind=vaccine/);

  await page.getByLabel('Antigen (e.g. Rabies)').fill('Rabies');
  await page.getByLabel('Dose').fill('1 ml');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page).toHaveURL(/health/);
  await expect(page.getByText('Rabies', { exact: true })).toBeVisible();
});

test('adds a daily check-in', async ({ page }) => {
  await page.goto('/health');
  await addInSection(page, 'Daily check-ins');
  await expect(page).toHaveURL(/kind=checkin/);

  await page.getByRole('button', { name: 'Good', exact: true }).click();
  await page.getByRole('button', { name: 'High', exact: true }).click();
  await page.getByLabel('Anything unusual?').fill('Zoomies at midnight');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page).toHaveURL(/health/);
  await expect(page.getByText('Zoomies at midnight', { exact: true })).toBeVisible();
});

test('creates a medication reminder from Health', async ({ page }) => {
  await page.goto('/health');
  await addInSection(page, 'Medications');
  await expect(page).toHaveURL(/reminder-form\?kind=med/);

  await page.getByLabel('Title').fill('Daily dewormer');
  await page.getByLabel('Due date').fill('2026-08-10');
  await page.getByRole('button', { name: 'Daily', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page).toHaveURL(/health/);
  await expect(page.getByText('Daily dewormer', { exact: true })).toBeVisible();
});

test('vet report renders with no data', async ({ page }) => {
  await page.goto('/health');
  await page.getByRole('button', { name: 'Vet prep report', exact: true }).click();
  await expect(page).toHaveURL(/vet-report/);
  await expect(page.getByText(/Vet prep report — Miko/)).toBeVisible();
  await expect(page.getByText(/Log a few entries first/)).toBeVisible();
});

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

test('blocks a second check-in on the same day', async ({ page }) => {
  await page.goto('/health');
  await addInSection(page, 'Daily check-ins');
  await expect(page).toHaveURL(/kind=checkin/);

  await page.getByRole('button', { name: 'Good', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/health/);

  // Same day again — the save must be rejected with a clear error.
  await addInSection(page, 'Daily check-ins');
  await expect(page).toHaveURL(/kind=checkin/);
  await page.getByRole('button', { name: 'Good', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Already checked in for this day', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/kind=checkin/);
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

test('logs a medication given straight from a med rule', async ({ page }) => {
  await page.goto('/health');
  await addInSection(page, 'Medications');
  await page.getByLabel('Title').fill('Daily dewormer');
  await page.getByLabel('Due date').fill('2026-08-10');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // The rule card carries its own one-tap logging entry point.
  await page.getByRole('button', { name: 'Log med', exact: true }).click();
  await expect(page).toHaveURL(/kind=med_given/);
  await expect(page.getByLabel('Medication')).toHaveValue('Daily dewormer');
  await page.getByLabel('Dose').fill('1 tablet');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page).toHaveURL(/health/);
  await expect(page.getByText('Recently given', { exact: true })).toBeVisible();
  await expect(page.getByText('Daily dewormer', { exact: true }).first()).toBeVisible();
});

test('weight form shows the last record with a live delta', async ({ page }) => {
  await page.goto('/health');
  await addInSection(page, 'Weight');
  await page.getByLabel('Weight (kg)').fill('4.2');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/health/);

  await addInSection(page, 'Weight');
  // The specialized form surfaces the previous record as context.
  await expect(page.getByText(/Last recorded: 4\.2 kg/)).toBeVisible();

  await page.getByLabel('Weight (kg)').fill('4.5');
  await expect(page.getByText(/▲ 0\.3 kg/)).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/health/);
});

test('vet report renders with no data', async ({ page }) => {
  await page.goto('/health');
  await page.getByRole('button', { name: 'Vet prep report', exact: true }).click();
  await expect(page).toHaveURL(/vet-report/);
  await expect(page.getByText(/Vet prep report — Miko/)).toBeVisible();
  await expect(page.getByText(/Log a few entries first/)).toBeVisible();
});

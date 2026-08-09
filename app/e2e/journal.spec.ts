import { expect, test } from './fixtures';
import { addInSection, createPet, setEnglish } from './helpers';

test.beforeEach(async ({ page }) => {
  await setEnglish(page);
  await createPet(page);
});

test('entry-form kind picker shows the curated care kinds only', async ({ page }) => {
  await page.goto('/entry-form');

  for (const label of ['Feeding', 'Water', 'Walk', 'Potty', 'Mood', 'Photo']) {
    await expect(page.getByText(label, { exact: true }), label).toBeVisible();
  }
  // Health kinds are added from the Health tab; milestones from Memories.
  for (const hidden of ['Vaccine', 'Weight', 'Vet visit', 'Symptom', 'Medication', 'Check-in', 'Milestone']) {
    await expect(page.getByText(hidden, { exact: true }), hidden).toHaveCount(0);
  }
});

test('journal header shows the active pet badge and switches pets from it', async ({ page }) => {
  // beforeEach already created Miko.
  await createPet(page, 'Bella');
  await page.goto('/journal');

  // Active pet (newest, the default) shows as a floating pill in the header.
  const badge = page.getByRole('button', { name: 'Switch pet', exact: true });
  await expect(badge).toBeVisible();
  await expect(badge).toContainText('Bella');

  // Tap it, pick the other pet, and the badge follows.
  await badge.click();
  await page.getByRole('button', { name: 'Switch pet to Miko', exact: true }).click();
  await expect(badge).toContainText('Miko');
});

test('entry-form has a date field', async ({ page }) => {
  await page.goto('/entry-form');
  await expect(page.getByLabel('Date')).toBeVisible();
  await expect(page.locator('input[type="date"]')).toBeVisible();
});

test('adds a feed entry with a note and a backdated date', async ({ page }) => {
  await page.goto('/journal');
  await page.getByRole('button', { name: 'New entry', exact: true }).click();
  await expect(page).toHaveURL(/entry-form/);

  await page.getByText('Feeding', { exact: true }).click();
  await page.getByLabel('Note').fill('Breakfast at 7');
  await page.locator('input[type="date"]').fill('2026-08-05');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page).toHaveURL(/journal/);
  await expect(page.getByRole('button', { name: 'Breakfast at 7' })).toBeVisible();
  await expect(page.getByText('5 August 2026', { exact: true })).toBeVisible();
});

test('editing an entry updates the journal', async ({ page }) => {
  await page.goto('/journal');
  await page.getByRole('button', { name: 'New entry', exact: true }).click();
  await page.getByText('Water', { exact: true }).click();
  await page.getByLabel('Note').fill('Filled the bowl');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await page.getByRole('button', { name: 'Filled the bowl' }).click();
  await expect(page).toHaveURL(/entry-form\?id=/);
  await expect(page.getByLabel('Note')).toHaveValue('Filled the bowl');
  await page.getByLabel('Note').fill('Filled the bowl twice');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Filled the bowl twice' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Filled the bowl', exact: true })).toHaveCount(0);
});

test('favoriting an entry surfaces it in Memories', async ({ page }) => {
  // Milestones are added from the Memories tab now, not the journal picker.
  await page.goto('/memories');
  await addInSection(page, 'Milestones');
  await expect(page).toHaveURL(/kind=milestone/);
  await page.getByLabel('Milestone').fill('First steps');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/memories/);
  await expect(page.getByText('First steps', { exact: true })).toBeVisible();

  await page.goto('/journal');
  await page.getByRole('button', { name: 'Favorite', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove favorite', exact: true })).toBeVisible();

  await page.goto('/memories');
  await expect(page.getByText('First steps', { exact: true })).toBeVisible();
});

test('feed form offers one-tap meal presets', async ({ page }) => {
  await page.goto('/journal');
  await page.getByRole('button', { name: 'New entry', exact: true }).click();
  await page.getByText('Feeding', { exact: true }).click();

  // A specialized feed form: quick-note presets fill the note field.
  await page.getByRole('button', { name: 'Breakfast', exact: true }).click();
  await expect(page.getByLabel('Note')).toHaveValue('Breakfast');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page).toHaveURL(/journal/);
  await expect(page.getByRole('button', { name: 'Breakfast', exact: true })).toBeVisible();
});

test('journal search filters entries', async ({ page }) => {
  await page.goto('/journal');
  await page.getByRole('button', { name: 'New entry', exact: true }).click();
  await page.getByText('Walk', { exact: true }).click();
  await page.getByLabel('Note').fill('Evening walk');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await page.getByLabel('Search').fill('nope-nothing-here');
  await expect(page.getByText('No entries match your search')).toBeVisible();
  await page.getByLabel('Search').fill('Evening');
  await expect(page.getByRole('button', { name: 'Evening walk' })).toBeVisible();
});

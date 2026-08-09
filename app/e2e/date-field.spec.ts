import { expect, test } from './fixtures';
import { createPet, setEnglish } from './helpers';

test.beforeEach(async ({ page }) => {
  await setEnglish(page);
  await createPet(page);
});

test('shows a themed placeholder instead of the raw dd/mm/yyyy text', async ({ page }) => {
  await page.goto('/entry-form');
  const input = page.locator('input[type="date"]');
  await expect(input).toBeVisible();

  // Empty field: our overlay placeholder shows the current date,
  // not the native dd/mm/yyyy text or a static "Now" label.
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  await expect(page.getByText(todayKey, { exact: true })).toBeVisible();

  await input.fill('2026-08-05');
  await expect(page.getByText(todayKey, { exact: true })).toHaveCount(0);
});

test('clicking anywhere on the field opens the picker', async ({ page }) => {
  await page.goto('/entry-form');
  const input = page.locator('input[type="date"]');
  // Clicking the field itself (not just the tiny native icon) invokes the
  // picker and keeps focus on the input.
  await input.click();
  await expect(input).toBeFocused();
});

test('pet and reminder forms show the themed select-date placeholder', async ({ page }) => {
  await page.goto('/pet-form');
  await expect(page.getByText('Select date', { exact: true })).toHaveCount(2); // birth + gotcha day

  await page.goto('/reminder-form');
  await expect(page.getByText('Select date', { exact: true })).toBeVisible();
});

test('date input colors follow the active theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/entry-form');
  const input = page.locator('input[type="date"]');

  // Native calendar popup + icon follow the dark palette.
  await expect(input).toHaveCSS('color-scheme', 'dark');
  await expect(input).toHaveCSS('accent-color', 'rgb(123, 150, 196)'); // darkColors.primary

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(input).toHaveCSS('color-scheme', 'light');
  await expect(input).toHaveCSS('accent-color', 'rgb(74, 109, 167)'); // colors.primary
});

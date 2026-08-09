import { expect, test } from './fixtures';
import { createPet, setEnglish } from './helpers';

// PetSwitcher renders a chip per pet: the active one is tinted (primarySoft),
// inactive ones use plain `surface`. `createPet` makes the newest pet active,
// so 'Miko' (created first) is always the inactive chip to measure.
const LIGHT = { surface: 'rgb(255, 255, 255)', primarySoft: 'rgb(211, 227, 253)' };
const DARK = { surface: 'rgb(30, 31, 32)', primarySoft: 'rgba(138, 180, 248, 0.16)' };

async function chipBackground(page: import('@playwright/test').Page, name: string): Promise<string> {
  const chip = page.locator(`[role="tab"]:has-text("${name}")`).first();
  await expect(chip).toBeVisible();
  return chip.evaluate((el) => getComputedStyle(el).backgroundColor);
}

test('light mode renders surfaces with the light palette', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await setEnglish(page);
  await createPet(page);
  await createPet(page, 'Bella');

  await expect.poll(() => chipBackground(page, 'Miko')).toBe(LIGHT.surface);
  await expect.poll(() => chipBackground(page, 'Bella')).toBe(LIGHT.primarySoft);
});

test('dark mode renders surfaces with the dark palette', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await setEnglish(page);
  await createPet(page);
  await createPet(page, 'Bella');

  await expect.poll(() => chipBackground(page, 'Miko')).toBe(DARK.surface);
  await expect.poll(() => chipBackground(page, 'Bella')).toBe(DARK.primarySoft);
});

test('theme switching re-renders surfaces live', async ({ page }) => {
  await setEnglish(page);
  await createPet(page);
  await createPet(page, 'Bella');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => chipBackground(page, 'Miko')).toBe(DARK.surface);

  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => chipBackground(page, 'Miko')).toBe(LIGHT.surface);
});

test('toast uses the inverted surface in both themes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await setEnglish(page);
  await createPet(page);

  await page.getByRole('button', { name: 'Feeding', exact: true }).first().click();
  const toast = page.locator('[aria-live="polite"]');
  await expect(toast).toBeVisible();
  // darkColors.text = #E8EAED (near-white toast) with dark text on top.
  await expect(toast).toHaveCSS('background-color', 'rgb(232, 234, 237)');
  await expect(page.getByText(/Logged .*· Feeding/)).toHaveCSS('color', 'rgb(19, 19, 20)');

  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('button', { name: 'Water', exact: true }).first().click();
  await expect(toast).toBeVisible();
  // colors.text = #202124 (dark toast) with light text on top.
  await expect(toast).toHaveCSS('background-color', 'rgb(32, 33, 36)');
  await expect(page.getByText(/Logged .*· Water/)).toHaveCSS('color', 'rgb(248, 249, 250)');
});

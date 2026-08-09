import { expect, test } from './fixtures';
import { createPet, setEnglish } from './helpers';

test('server address is prefilled from the baked .env URL', async ({ page }) => {
  await setEnglish(page);
  await expect(page.getByLabel('Server address')).toHaveValue('http://localhost:8083');
});

test('language switches between English and Indonesian', async ({ page }) => {
  await page.goto('/settings');
  // English is the default locale.
  await expect(page.getByText('Settings', { exact: true })).toBeVisible();

  await page.getByText('Bahasa Indonesia', { exact: true }).click();
  await expect(page.getByText('Alamat server', { exact: true })).toBeVisible();

  await page.getByText('English', { exact: true }).click();
  await expect(page.getByText('Server address', { exact: true })).toBeVisible();
});

test('language buttons highlight the active language', async ({ page }) => {
  await page.goto('/settings');
  // Default locale is English: primarySoft tint on the active button.
  await expect(page.getByRole('button', { name: 'English' })).toHaveCSS(
    'background-color',
    'rgb(233, 238, 245)'
  );
  await expect(page.getByRole('button', { name: 'Bahasa Indonesia' })).toHaveCSS(
    'background-color',
    'rgb(239, 239, 241)'
  );

  await page.getByText('Bahasa Indonesia', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bahasa Indonesia' })).toHaveCSS(
    'background-color',
    'rgb(233, 238, 245)'
  );
  await expect(page.getByRole('button', { name: 'English' })).toHaveCSS(
    'background-color',
    'rgb(239, 239, 241)'
  );
});

test('exports the journal as JSON', async ({ page }) => {
  await setEnglish(page);
  await createPet(page);

  const downloadPromise = page.waitForEvent('download');
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Export data (JSON)', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^pawly-export-\d{4}-\d{2}-\d{2}\.json$/);
});

test('sync status reflects a successful sync against the backend', async ({ page }) => {
  await setEnglish(page);
  await createPet(page);

  await page.goto('/settings');
  await expect(page.getByText(/Last synced:/)).toBeVisible();
  await expect(page.getByText('Server unreachable')).toHaveCount(0);
});

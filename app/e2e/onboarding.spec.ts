import { expect, test } from './fixtures';
import { setEnglish } from './helpers';

test('fresh install shows the empty state and walks through first pet', async ({ page }) => {
  await setEnglish(page);
  await page.goto('/');
  await expect(page.getByText('No pets yet. Add your first one!')).toBeVisible();
  await expect(page.getByText('Everything about your furry friends, in one place')).toBeVisible();

  await page.getByRole('button', { name: 'Add a pet', exact: true }).click();
  await expect(page).toHaveURL(/pet-form/);

  await page.getByLabel('Name').fill('Miko');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText('Miko', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('No pets yet. Add your first one!')).toHaveCount(0);
});
